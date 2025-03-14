// State variables
let pageToken = null
let isSearchMode = false
let currentSearchQuery = ""
let totalSearchResults = 0
let isAiMode = false
let aiQueryInProgress = false

// DOM Elements
const reportsList = document.getElementById("reportsList")
const loadMoreBtn = document.getElementById("loadMoreBtn")
const searchForm = document.getElementById("searchForm")
const searchInput = document.getElementById("searchInput")
const filtersForm = document.getElementById("filtersForm")
const applyFiltersBtn = document.getElementById("applyFiltersBtn")
const clearFiltersBtn = document.getElementById("clearFiltersBtn")
const clearFiltersHomeBtn = document.getElementById("clearFiltersHomeBtn")
const activeFilters = document.getElementById("activeFilters")
const activeFiltersCount = document.getElementById("activeFiltersCount")
const loadingIndicator = document.getElementById("loadingIndicator")
const noResultsMessage = document.getElementById("noResultsMessage")
const reportWebUrl = document.getElementById("reportWebUrl")
const copyToast = document.getElementById("copyToast")
const searchResultsContainer = document.getElementById("searchResultsContainer")
const searchTypeBtn = document.getElementById("searchTypeBtn")
const searchTypeDropdown = document.getElementById("searchTypeDropdown")
const aiQueryInput = document.getElementById("aiQueryInput")
const aiAnswerContainer = document.getElementById("aiAnswerContainer")
const aiAnswerContent = document.getElementById("aiAnswerContent")

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
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl))

  // Event Listeners
  searchForm.addEventListener("submit", handleSearch)
  loadMoreBtn.addEventListener("click", loadMoreReports)
  applyFiltersBtn.addEventListener("click", applyFilters)
  clearFiltersBtn.addEventListener("click", clearFilters)
  clearFiltersHomeBtn.addEventListener("click", clearFilters)

  // Set up search type dropdown
  searchTypeDropdown.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault()
      const searchType = e.target.getAttribute("data-search-type")
      setSearchMode(searchType)

      // Update active state in dropdown
      searchTypeDropdown.querySelectorAll(".dropdown-item").forEach((i) => i.classList.remove("active"))
      e.target.classList.add("active")
    })
  })

  // Auto-resize textarea for AI queries
  aiQueryInput.addEventListener("input", () => {
    // Reset height to auto to get the correct scrollHeight
    aiQueryInput.style.height = "auto"
    // Set the height to the scrollHeight
    aiQueryInput.style.height = aiQueryInput.scrollHeight + "px"
  })

  // Handle AI query submission with Enter key (but allow Shift+Enter for new lines)
  aiQueryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch(e)
    }
  })

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

// Update the createReportRow function to use report.num_iocs instead of calculating
function createReportRow(report) {
  const row = document.createElement("tr")

  const publishDate = new Date(report.publish_time)
  const formattedDate = publishDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })

  // Use the num_iocs field from the API
  const iocCount = report.num_iocs || 0

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
        <td>
            <span class="badge bg-secondary" title="Number of IOCs (excluding false positives)">${iocCount}</span>
        </td>
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
            <a href="/${report.id}" class="btn btn-sm btn-primary ms-1">
                Details
            </a>
        </td>
    `

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

function loadMoreReports() {
  showLoadMoreLoading(true)
  if (isSearchMode && currentSearchQuery) {
    searchReports(currentSearchQuery, true)
  } else {
    loadReports(getFilters())
  }
}

function setSearchMode(mode) {
  if (mode === "ai") {
    isAiMode = true
    searchTypeBtn.textContent = "Ask AI"
    searchInput.style.display = "none"
    aiQueryInput.style.display = "block"
    searchInput.placeholder = "Ask a question about threat intelligence..."
  } else {
    isAiMode = false
    searchTypeBtn.textContent = "Search"
    searchInput.style.display = "block"
    aiQueryInput.style.display = "none"
    searchInput.placeholder = "Search reports..."
  }
}

function handleSearch(e) {
  e.preventDefault()

  let query = ""

  if (isAiMode) {
    query = aiQueryInput.value.trim()
    if (query) {
      // Reset page token and clear feed for new AI query
      pageToken = null
      reportsList.innerHTML = ""
      isSearchMode = false
      currentSearchQuery = ""

      // Show the clear button
      clearFiltersHomeBtn.style.display = "inline-block"

      // Hide the search results count
      searchResultsContainer.style.display = "none"

      // Hide any previous AI answer
      aiAnswerContainer.style.display = "none"

      // Execute AI query
      executeAiQuery(query)
    }
  } else {
    query = searchInput.value.trim()

    if (query) {
      // Reset page token and clear feed for new search
      pageToken = null
      reportsList.innerHTML = ""
      isSearchMode = true
      currentSearchQuery = query

      // Hide any previous AI answer
      aiAnswerContainer.style.display = "none"

      // Execute regular search
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

      // Hide any previous AI answer
      aiAnswerContainer.style.display = "none"

      // Only hide the clear button if there are no active filters
      const filters = getFilters()
      const hasActiveFilters = Object.values(filters).some((value) => value !== null)
      if (!hasActiveFilters) {
        clearFiltersHomeBtn.style.display = "none"
      }

      loadReports(getFilters())
    }
  }
}

function executeAiQuery(query) {
  if (aiQueryInProgress) return

  aiQueryInProgress = true
  showLoading(true)
  showNoResults(false)

  // Show AI answer container with loading state
  aiAnswerContainer.style.display = "block"
  aiAnswerContent.innerHTML = `
    <div class="ai-loading">
      <span>Thinking</span>
      <div class="dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `

  // Create form data for the POST request
  const formData = new FormData()
  formData.append("query", query)

  fetch("/v1/reports/qanda", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      showLoading(false)
      aiQueryInProgress = false

      // Display the AI answer
      aiAnswerContent.innerHTML = data.answer

      // Display the related reports
      if (data.reports && data.reports.length > 0) {
        renderReports(data.reports, true)
        loadMoreBtn.style.display = "none" // No pagination for AI results
      } else {
        showNoResults(true)
      }
    })
    .catch((error) => {
      console.error("Error executing AI query:", error)
      showLoading(false)
      aiQueryInProgress = false

      aiAnswerContent.innerHTML = `
        <div class="alert alert-danger">
          Failed to get an answer. Please try again later or rephrase your question.
        </div>
      `

      showNoResults(true)
    })
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

  // Reset AI query input if in AI mode
  if (isAiMode) {
    aiQueryInput.value = ""
    aiQueryInput.style.height = "38px" // Reset height
  }

  // Also clear the search if in search mode
  if (isSearchMode) {
    searchInput.value = ""
    isSearchMode = false
    currentSearchQuery = ""
    searchResultsContainer.style.display = "none"
  }

  // Hide the AI answer container
  aiAnswerContainer.style.display = "none"

  // Hide the clear button
  clearFiltersHomeBtn.style.display = "none"

  // Apply filters (which will now be empty)
  applyFilters()
}
