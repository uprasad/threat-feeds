// State variables
let pageToken = null
let isSearchMode = false
let currentSearchQuery = ""
let totalSearchResults = 0

// DOM Elements
const reportsList = document.getElementById("reportsList")
const loadMoreBtn = document.getElementById("loadMoreBtn")
const searchForm = document.getElementById("searchForm")
const searchInput = document.getElementById("searchInput")
const filtersForm = document.getElementById("filtersForm")
const applyFiltersBtn = document.getElementById("applyFiltersBtn")
const clearFiltersBtn = document.getElementById("clearFiltersHomeBtn")
const clearFiltersHomeBtn = document.getElementById("clearFiltersHomeBtn")
const activeFilters = document.getElementById("activeFilters")
const activeFiltersCount = document.getElementById("activeFiltersCount")
const loadingIndicator = document.getElementById("loadingIndicator")
const noResultsMessage = document.getElementById("noResultsMessage")
const reportWebUrl = document.getElementById("reportWebUrl")
const copyToast = document.getElementById("copyToast")
const searchResultsContainer = document.getElementById("searchResultsContainer")

// Initialize tooltips and toasts
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl))

  // Event Listeners
  searchForm.addEventListener("submit", handleSearch)
  loadMoreBtn.addEventListener("click", loadMoreReports)
  applyFiltersBtn.addEventListener("click", applyFilters)
  clearFiltersBtn.addEventListener("click", clearFilters)
  clearFiltersHomeBtn.addEventListener("click", clearFilters)

  // Initial load
  loadReports()
})

function showLoading(show) {
  loadingIndicator.style.display = show ? "block" : "none"
}

function showLoadMoreLoading(show) {
  if (show) {
    loadMoreBtn.innerHTML =
      '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading...'
    loadMoreBtn.disabled = true
  } else {
    loadMoreBtn.innerHTML = "Load More Reports"
    loadMoreBtn.disabled = false
  }
}

function showNoResults(show) {
  noResultsMessage.style.display = show ? "block" : "none"
}

function loadReports(params = {}) {
  showLoading(true)
  showNoResults(false)

  const url = new URL("/v1/reports", window.location.origin)

  // Add filters to URL
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.append(key, value)
  })

  // Add page token if available
  if (pageToken) {
    url.searchParams.append("page_token", pageToken)
  }

  // Set default limit
  if (!url.searchParams.has("limit")) {
    url.searchParams.append("limit", "20")
  }

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      showLoading(false)
      showLoadMoreLoading(false)

      if (data.reports && data.reports.length > 0) {
        renderReports(data.reports, !pageToken)
        pageToken = data.next_page_token
        loadMoreBtn.style.display = pageToken ? "inline-block" : "none"
      } else {
        if (!pageToken) {
          showNoResults(true)
        }
        loadMoreBtn.style.display = "none"
      }
    })
    .catch((error) => {
      console.error("Error loading reports:", error)
      showLoading(false)
      showLoadMoreLoading(false)
      alert("Failed to load reports. Please try again later.")
    })
}

function renderReports(reports, clearExisting = true) {
  if (clearExisting) {
    reportsList.innerHTML = ""
  }

  reports.forEach((report) => {
    const row = createReportRow(report)
    reportsList.appendChild(row)
  })

  // Re-initialize tooltips for new elements
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl))
}

function createReportRow(report) {
  const row = document.createElement("tr")

  const publishDate = new Date(report.publish_time)
  const formattedDate = publishDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  row.innerHTML = `
        <td>
            <div class="report-title" title="${escapeHtml(report.title)}">
                ${escapeHtml(report.title)}
            </div>
            ${
              report.highlights
                ? `
                <div class="report-highlights mt-2">
                    ${report.highlights}
                </div>
            `
                : ""
            }
        </td>
        <td>${escapeHtml(report.source)}</td>
        <td>${formattedDate}</td>
        <td class="action-buttons">
            ${
              report.web_url
                ? `
                <a href="${report.web_url}" target="_blank" 
                   class="btn btn-sm btn-outline-primary" 
                   data-bs-toggle="tooltip" 
                   data-bs-placement="top" 
                   title="Open Original Report">
                    <i class="bi bi-box-arrow-up-right"></i>
                </a>
            `
                : ""
            }
            <button class="btn btn-sm btn-primary ms-1 view-report" 
                    data-report-id="${report.id}">
                Details
            </button>
        </td>
    `

  // Add event listeners
  row.querySelector(".view-report").addEventListener("click", () => viewReportDetails(report.id))

  return row
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

// Update the viewReportDetails function to fetch data from both endpoints
function viewReportDetails(reportId) {
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
        return { mitre: {} }
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

      // Update the web URL link
      reportWebUrl.href = report.web_url || "#"
      reportWebUrl.style.display = report.web_url ? "inline-block" : "none"

      const modalContent = document.getElementById("reportDetailContent")

      let iocSections = ""

      // Create IOC sections if they exist
      if (report.sha1s && report.sha1s.length > 0) {
        iocSections += createIocSection("SHA1 Hashes", report.sha1s)
      }

      if (report.sha256s && report.sha256s.length > 0) {
        iocSections += createIocSection("SHA256 Hashes", report.sha256s)
      }

      if (report.md5s && report.md5s.length > 0) {
        iocSections += createIocSection("MD5 Hashes", report.md5s)
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

      modalContent.innerHTML = `
                <h2>${escapeHtml(report.title)}</h2>
                
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
            `

      // Add event listener for toggling report ID visibility
      const toggleButton = modalContent.querySelector("#toggleReportIdBtn")
      const reportIdSection = modalContent.querySelector("#reportIdSection")

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
      const tooltipTriggerList = [].slice.call(modalContent.querySelectorAll('[data-bs-toggle="tooltip"]'))
      tooltipTriggerList.map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl))

      const reportDetailModal = new bootstrap.Modal(document.getElementById("reportDetailModal"))
      reportDetailModal.show()

      // Fetch related reports after showing the modal
      fetchRelatedReports(report.id)
    })
    .catch((error) => {
      console.error("Error loading report details:", error)
      showLoading(false)
      alert("Failed to load report details. Please try again later.")
    })
}

// Add a new function to create the MITRE ATT&CK section
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
                <button class="btn btn-sm btn-primary view-related-report" data-report-id="${report.id}">
                  Details
                </button>
              </div>
            </div>
          `
        })

        relatedReportsHtml += "</div>"
        relatedReportsContent.innerHTML = relatedReportsHtml

        // Add event listeners to the "Details" buttons
        const detailButtons = relatedReportsContent.querySelectorAll(".view-related-report")
        detailButtons.forEach((button) => {
          button.addEventListener("click", () => {
            const relatedReportId = button.getAttribute("data-report-id")
            // Close current modal
            const currentModal = bootstrap.Modal.getInstance(document.getElementById("reportDetailModal"))
            currentModal.hide()
            // Show the new report details after a short delay
            setTimeout(() => {
              viewReportDetails(relatedReportId)
            }, 500)
          })
        })
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

// Update the createIocSection function to ensure consistent left-alignment and add tooltip to FP badge
function createIocSection(title, items, falsePositives = {}) {
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
    html += `<div class="ioc-item">${escapeHtml(item)}</div>`
  })

  // Add false positive IOCs with the same container class for consistent alignment
  // Add tooltip to the FP badge explaining what it means
  falsePositiveIocs.forEach((fp) => {
    html += `
      <div class="ioc-item">
        ${escapeHtml(fp.value)}
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
  })

  html += `
      </div>
    </div>
  `

  return html
}

function loadMoreReports() {
  showLoadMoreLoading(true)
  if (isSearchMode && currentSearchQuery) {
    searchReports(currentSearchQuery, true)
  } else {
    loadReports(getFilters())
  }
}

function handleSearch(e) {
  e.preventDefault()
  const query = searchInput.value.trim()

  if (query) {
    // Reset page token and clear feed for new search
    pageToken = null
    reportsList.innerHTML = ""
    isSearchMode = true
    currentSearchQuery = query
    searchReports(query)

    // Show the clear button when search is executed
    clearFiltersHomeBtn.style.display = "inline-block"
  } else {
    // If search is empty, go back to regular reports feed
    pageToken = null
    reportsList.innerHTML = ""
    isSearchMode = false
    currentSearchQuery = ""
    // Hide the search results count
    searchResultsContainer.style.display = "none"

    // Only hide the clear button if there are no active filters
    const filters = getFilters()
    const hasActiveFilters = Object.values(filters).some((value) => value !== null)
    if (!hasActiveFilters) {
      clearFiltersHomeBtn.style.display = "none"
    }

    loadReports(getFilters())
  }
}

function searchReports(query, isLoadMore = false) {
  showLoading(true)
  showNoResults(false)

  if (!isLoadMore) {
    // Hide the search results count when starting a new search
    searchResultsContainer.style.display = "none"
  }

  const url = new URL("/v1/reports/search", window.location.origin)
  url.searchParams.append("q", query)

  if (pageToken && isLoadMore) {
    url.searchParams.append("page_token", pageToken)
  }

  url.searchParams.append("limit", "20")

  fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      showLoading(false)
      showLoadMoreLoading(false)

      // Update total results count
      if (!isLoadMore && data.total !== undefined) {
        totalSearchResults = data.total
        document.getElementById("totalResultsCount").textContent = totalSearchResults
        searchResultsContainer.style.display = "block"
      }

      if (data.reports && data.reports.length > 0) {
        renderReports(data.reports, !isLoadMore)
        pageToken = data.next_page_token
        loadMoreBtn.style.display = pageToken ? "inline-block" : "none"
      } else {
        if (!isLoadMore) {
          showNoResults(true)
        }
        loadMoreBtn.style.display = "none"
      }
    })
    .catch((error) => {
      console.error("Error searching reports:", error)
      showLoading(false)
      showLoadMoreLoading(false)
      alert("Failed to search reports. Please try again later.")
    })
}

function applyFilters() {
  // Reset pagination
  pageToken = null

  // Reset search mode
  isSearchMode = false
  currentSearchQuery = ""
  searchInput.value = ""

  // Get and apply filters
  const filters = getFilters()
  updateActiveFilters(filters)

  // Clear existing reports and load with filters
  reportsList.innerHTML = ""
  loadReports(filters)

  // Close the modal
  const filtersModalElement = document.getElementById("filtersModal")
  const filtersModal = bootstrap.Modal.getInstance(filtersModalElement)
  if (filtersModal) {
    filtersModal.hide()
  }
}

function getFilters() {
  const titleValue = document.getElementById("titleFilter").value.trim()
  const sourceValue = document.getElementById("sourceFilter").value.trim()
  const publishedAfterValue = document.getElementById("publishedAfterFilter").value
  const publishedBeforeValue = document.getElementById("publishedBeforeFilter").value

  // Convert dates to Unix timestamps if they exist
  const publishedAfter = publishedAfterValue ? new Date(publishedAfterValue).getTime() / 1000 : null
  const publishedBefore = publishedBeforeValue ? new Date(publishedBeforeValue).getTime() / 1000 : null

  return {
    title: titleValue || null,
    source: sourceValue || null,
    published_after: publishedAfter,
    published_before: publishedBefore,
  }
}

function updateActiveFilters(filters) {
  activeFilters.innerHTML = ""
  let count = 0

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      count++

      let displayKey = key.replace("_", " ")
      displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1)

      let displayValue = value

      // Format date values
      if (key === "published_after" || key === "published_before") {
        displayValue = new Date(value * 1000).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      }

      const badge = document.createElement("span")
      badge.className = "badge bg-secondary me-2 mb-2 filter-badge"
      badge.innerHTML = `${displayKey}: ${displayValue} <i class="bi bi-x"></i>`
      badge.addEventListener("click", () => removeFilter(key))
      activeFilters.appendChild(badge)
    }
  })

  activeFiltersCount.textContent = count
  activeFiltersCount.style.display = count > 0 ? "inline-block" : "none"

  // Show/hide the clear filters home button based on whether there are active filters OR search mode
  clearFiltersHomeBtn.style.display = count > 0 || isSearchMode ? "inline-block" : "none"
}

function removeFilter(key) {
  switch (key) {
    case "title":
      document.getElementById("titleFilter").value = ""
      break
    case "source":
      document.getElementById("sourceFilter").value = ""
      break
    case "published_after":
      document.getElementById("publishedAfterFilter").value = ""
      break
    case "published_before":
      document.getElementById("publishedBeforeFilter").value = ""
      break
  }

  applyFilters()
}

function clearFilters() {
  // Reset the form
  filtersForm.reset()

  // Also clear the search if in search mode
  if (isSearchMode) {
    searchInput.value = ""
    isSearchMode = false
    currentSearchQuery = ""
    searchResultsContainer.style.display = "none"
  }

  // Hide the clear button
  clearFiltersHomeBtn.style.display = "none"

  // Apply filters (which will now be empty)
  applyFilters()
}
