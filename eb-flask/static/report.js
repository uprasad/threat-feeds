// DOM Elements
const reportDetailContent = document.getElementById("reportDetailContent")
const loadingIndicator = document.getElementById("loadingIndicator")
const copyToast = document.getElementById("copyToast")

// Vendor abbreviations mapping
const vendorAbbreviations = {
  VirusTotal: "VT",
  "Hybrid-Analysis": "HA",
  MalwareBazaar: "MB",
  AnyRun: "AR",
  ThreatBook: "TB",
  AlienVault: "AV",
  Maltiverse: "MT",
  ThreatMiner: "TM",
  InQuest: "IQ",
  Triage: "TR",
  Intezer: "IN",
  URLhaus: "UH",
  "Cisco Talos": "CT",
  ReversingLabs: "RL",
  MalShare: "MS",
  "Joe Sandbox": "JS",
}

// Initialize tooltips and toasts
document.addEventListener("DOMContentLoaded", () => {
  // Load the report details when the page loads
  const reportId = window.location.pathname.slice(1) // Extract reportId from the URL
  loadReportDetails(reportId)
})

function showLoading(show) {
  loadingIndicator.style.display = show ? "block" : "none"
}

function escapeHtml(unsafe) {
  if (!unsafe) return ""
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function loadReportDetails(reportId) {
  showLoading(true)

  // Fetch both the main report details and the enriched data
  Promise.all([
    fetch(`/v1/reports/${reportId}`).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      return response.json()
    }),
    fetch(`/v1/reports/enrich/${reportId}`).then((response) => {
      if (!response.ok) {
        // If the enrich endpoint fails, we'll just use an empty object
        console.warn("Enrichment data not available")
        return { mitre: {}, md5s: {}, sha1s: {}, sha256s: {} }
      }
      return response.json()
    }),
  ])
    .then(([report, enrichedData]) => {
      showLoading(false)

      const publishDate = new Date(report.publish_time)
      const formattedDate = publishDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })

      // Update the page title
      document.title = `${report.title} | Threat Intelligence Report`

      let iocSections = ""

      // Create IOC sections if they exist
      if (report.sha1s && report.sha1s.length > 0) {
        iocSections += createIocSection("SHA1 Hashes", report.sha1s, report.false_positives, enrichedData.sha1s || {})
      }

      if (report.sha256s && report.sha256s.length > 0) {
        iocSections += createIocSection(
          "SHA256 Hashes",
          report.sha256s,
          report.false_positives,
          enrichedData.sha256s || {},
        )
      }

      if (report.md5s && report.md5s.length > 0) {
        iocSections += createIocSection("MD5 Hashes", report.md5s, report.false_positives, enrichedData.md5s || {})
      }

      if (report.urls && report.urls.length > 0) {
        iocSections += createIocSection("URLs", report.urls, report.false_positives)
      }

      if (report.ipv4s && report.ipv4s.length > 0) {
        iocSections += createIocSection("IPv4 Addresses", report.ipv4s, report.false_positives)
      }

      if (report.ipv6s && report.ipv6s.length > 0) {
        iocSections += createIocSection("IPv6 Addresses", report.ipv6s, report.false_positives)
      }

      if (report.cves && report.cves.length > 0) {
        iocSections += createIocSection("CVEs", report.cves)
      }

      // Create MITRE ATT&CK section if data exists
      let mitreSection = ""
      if (report.mitre) {
        mitreSection = createMitreSection(report.mitre, enrichedData.mitre || {})
      }

      // YARA rules might need special formatting
      let yaraSection = ""
      if (report.yara_rules && report.yara_rules.length > 0) {
        yaraSection = `
          <div class="ioc-section">
              <h5>YARA Rules</h5>
              <div class="ioc-list">
                  <pre>${escapeHtml(report.yara_rules.join("\n\n"))}</pre>
              </div>
          </div>
        `
      }

      reportDetailContent.innerHTML = `
        <div class="card mb-4">
          <div class="card-body">
            <h1 class="card-title">${escapeHtml(report.title)}</h1>
            
            <div class="report-metadata mt-3 mb-4">
                <div class="metadata-item">
                    <i class="bi bi-calendar-event"></i>
                    <span>${formattedDate}</span>
                </div>
                <div class="metadata-item">
                    <i class="bi bi-building"></i>
                    <span>${escapeHtml(report.source)}</span>
                </div>
                <div class="metadata-item">
                    <button id="toggleReportIdBtn" class="btn btn-sm btn-outline-secondary">
                        <i class="bi bi-eye"></i> Show ID
                    </button>
                </div>
                ${
                  report.web_url
                    ? `
                <div class="metadata-item">
                    <a href="${report.web_url}" target="_blank" class="btn btn-sm btn-primary">
                        <i class="bi bi-box-arrow-up-right"></i> View Original Report
                    </a>
                </div>
                `
                    : ""
                }
            </div>
            
            <!-- Report ID section (hidden by default) -->
            <div id="reportIdSection" class="alert alert-secondary mb-4" style="display: none;">
                <div class="d-flex align-items-center">
                    <strong class="me-2">Report ID:</strong>
                    <code id="reportIdDisplay" class="user-select-all">${report.id}</code>
                </div>
            </div>
            
            ${
              report.summary
                ? `
            <div class="summary-section">
                <h5>Summary</h5>
                <div class="summary-content">${report.summary}</div>
            </div>
            `
                : ""
            }
            
            ${mitreSection}
            ${iocSections}
            ${yaraSection}
            
            <!-- Related Reports Section (will be populated by fetchRelatedReports) -->
            <div id="relatedReportsSection" class="mt-4">
                <h5>Related Reports</h5>
                <div id="relatedReportsContent" class="related-reports-content">
                    <div class="text-center py-3">
                        <div class="spinner-border spinner-border-sm text-primary" role="status">
                            <span class="visually-hidden">Loading related reports...</span>
                        </div>
                        <span class="ms-2">Loading related reports...</span>
                    </div>
                </div>
            </div>
          </div>
        </div>
      `

      // Add event listener for toggling report ID visibility
      const toggleButton = reportDetailContent.querySelector("#toggleReportIdBtn")
      const reportIdSection = reportDetailContent.querySelector("#reportIdSection")

      if (toggleButton && reportIdSection) {
        toggleButton.addEventListener("click", () => {
          const isVisible = reportIdSection.style.display !== "none"

          // Toggle visibility
          reportIdSection.style.display = isVisible ? "none" : "block"

          // Update button text and icon
          toggleButton.innerHTML = isVisible
            ? '<i class="bi bi-eye"></i> Show ID'
            : '<i class="bi bi-eye-slash"></i> Hide ID'
        })
      }

      // Initialize tooltips for new elements in the modal
      const tooltipTriggerList = [].slice.call(reportDetailContent.querySelectorAll('[data-bs-toggle="tooltip"]'))
      const tooltipList = tooltipTriggerList.map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl))

      // Fetch related reports
      fetchRelatedReports(report.id)
    })
    .catch((error) => {
      console.error("Error loading report details:", error)
      showLoading(false)
      reportDetailContent.innerHTML = `
        <div class="alert alert-danger">
          <h4 class="alert-heading">Error Loading Report</h4>
          <p>Failed to load report details. The report may not exist or there was a server error.</p>
          <hr>
          <p class="mb-0">Please try again later or <a href="/">return to the reports list</a>.</p>
        </div>
      `
    })
}

// Function to fetch and display related reports
function fetchRelatedReports(reportId) {
  const relatedReportsContent = document.getElementById("relatedReportsContent")

  fetch(`/v1/reports/related/${reportId}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      if (data.reports && data.reports.length > 0) {
        // Create HTML for related reports
        let relatedReportsHtml = '<div class="list-group">'

        data.reports.forEach((report) => {
          const publishDate = new Date(report.publish_time)
          const formattedDate = publishDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })

          relatedReportsHtml += `
            <div class="list-group-item list-group-item-action">
              <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1">${escapeHtml(report.title)}</h6>
                <small>${formattedDate}</small>
              </div>
              <p class="mb-1 text-muted">${escapeHtml(report.source)}</p>
              <div class="d-flex mt-2">
                ${
                  report.web_url
                    ? `<a href="${report.web_url}" target="_blank" class="btn btn-sm btn-outline-primary me-2">
                    <i class="bi bi-box-arrow-up-right"></i> View Original
                  </a>`
                    : ""
                }
                <a href="/${report.id}" class="btn btn-sm btn-primary">
                  Details
                </a>
              </div>
            </div>
          `
        })

        relatedReportsHtml += "</div>"
        relatedReportsContent.innerHTML = relatedReportsHtml
      } else {
        // No related reports found
        relatedReportsContent.innerHTML = '<p class="text-muted">No related reports found.</p>'
      }
    })
    .catch((error) => {
      console.error("Error loading related reports:", error)
      relatedReportsContent.innerHTML = '<p class="text-danger">Failed to load related reports.</p>'
    })
}

// Create MITRE ATT&CK section
function createMitreSection(mitreData, enrichedMitreData) {
  // Check if there's any MITRE data to display
  const hasData = Object.values(mitreData).some((arr) => arr && arr.length > 0)

  if (!hasData) {
    return ""
  }

  let html = `
    <div class="mitre-section mb-4">
      <h4 class="mb-3">MITRE ATT&CK</h4>
      <div class="row">
  `

  // Define the fields and their display names
  const fields = [
    { key: "group_names", title: "Groups" },
    { key: "group_ids", title: "Group IDs" },
    { key: "campaign_names", title: "Campaigns" },
    { key: "campaign_ids", title: "Campaign IDs" },
    { key: "software_ids", title: "Software" },
    { key: "tactics", title: "Tactics" },
    { key: "techniques", title: "Techniques" },
    { key: "datasources", title: "Data Sources" },
  ]

  // Create a section for each field that has data
  fields.forEach((field) => {
    const values = mitreData[field.key]
    if (values && values.length > 0) {
      html += `
        <div class="col-md-6 mb-3">
          <div class="card h-100">
            <div class="card-header">
              <h5 class="mb-0">${field.title}</h5>
            </div>
            <div class="card-body">
              <ul class="list-group list-group-flush mitre-list">
      `

      // Add each value, with a link if enriched data is available
      values.forEach((value) => {
        const enrichedValue = enrichedMitreData[field.key] && enrichedMitreData[field.key][value]

        if (enrichedValue) {
          // We have enriched data for this value
          const displayName = enrichedValue.name || value
          html += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <span>${escapeHtml(displayName)}</span>
              <a href="${enrichedValue.url}" target="_blank" class="btn btn-sm btn-outline-primary">
                <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </li>
          `
        } else {
          // No enriched data, just show the value
          html += `
            <li class="list-group-item">${escapeHtml(value)}</li>
          `
        }
      })

      html += `
              </ul>
            </div>
          </div>
        </div>
      `
    }
  })

  html += `
      </div>
    </div>
  `

  return html
}

// Create IOC section
function createIocSection(title, items, falsePositives = {}, enrichmentData = {}) {
  // Separate regular IOCs from false positives
  const regularIocs = []
  const falsePositiveIocs = []

  items.forEach((item) => {
    if (falsePositives && falsePositives[item]) {
      falsePositiveIocs.push({ value: item, reason: falsePositives[item] })
    } else {
      regularIocs.push(item)
    }
  })

  // Sort to ensure false positives appear at the bottom
  const sortedItems = [...regularIocs, ...falsePositiveIocs.map((fp) => fp.value)]

  let html = `
    <div class="ioc-section">
      <h5>${title} (${items.length})</h5>
      <div class="ioc-list">
  `

  // Add regular IOCs
  regularIocs.forEach((item) => {
    // Check if this is a CVE section and create links for CVEs
    if (title === "CVEs") {
      html += `<div class="ioc-item">
        <a href="https://nvd.nist.gov/vuln/detail/${item}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(item)}
          <i class="bi bi-box-arrow-up-right ms-1 small"></i>
        </a>
      </div>`
    } else {
      // For hash types, check if we have enrichment data
      const enrichedItem = enrichmentData[item]

      html += `<div class="ioc-item">
        ${escapeHtml(item)}
        ${enrichedItem ? createEnrichmentBadges(enrichedItem) : ""}
      </div>`
    }
  })

  // Add false positive IOCs with the same container class for consistent alignment
  // Add tooltip to the FP badge explaining what it means
  falsePositiveIocs.forEach((fp) => {
    if (title === "CVEs") {
      html += `
      <div class="ioc-item">
        <a href="https://nvd.nist.gov/vuln/detail/${fp.value}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(fp.value)}
          <i class="bi bi-box-arrow-up-right ms-1 small"></i>
        </a>
        <span class="false-positive-badge" 
              data-bs-toggle="tooltip" 
              data-bs-placement="top" 
              title="False Positive: This indicator has been marked as a false positive">FP</span>
        <i class="bi bi-question-circle false-positive-reason-icon" 
           data-bs-toggle="tooltip" 
           data-bs-placement="top" 
           title="Reason: ${escapeHtml(fp.reason)}"></i>
      </div>
    `
    } else {
      // For hash types, check if we have enrichment data
      const enrichedItem = enrichmentData[fp.value]

      html += `
      <div class="ioc-item">
        ${escapeHtml(fp.value)}
        ${enrichedItem ? createEnrichmentBadges(enrichedItem) : ""}
        <span class="false-positive-badge" 
              data-bs-toggle="tooltip" 
              data-bs-placement="top" 
              title="False Positive: This indicator has been marked as a false positive">FP</span>
        <i class="bi bi-question-circle false-positive-reason-icon" 
           data-bs-toggle="tooltip" 
           data-bs-placement="top" 
           title="Reason: ${escapeHtml(fp.reason)}"></i>
      </div>
    `
    }
  })

  html += `
      </div>
    </div>
  `

  return html
}

// Helper function to create enrichment badges for a hash
function createEnrichmentBadges(enrichmentData) {
  let badgesHtml = ""

  Object.entries(enrichmentData).forEach(([vendor, url]) => {
    const abbreviation = vendorAbbreviations[vendor] || vendor.substring(0, 2)

    badgesHtml += `
      <a href="${url}" 
         target="_blank" 
         rel="noopener noreferrer" 
         class="vendor-badge" 
         data-bs-toggle="tooltip" 
         data-bs-placement="top" 
         title="View on ${vendor}">${abbreviation}</a>
    `
  })

  return badgesHtml
}
