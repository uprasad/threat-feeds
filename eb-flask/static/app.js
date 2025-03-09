// State variables
let pageToken = null;
let isSearchMode = false;
let currentSearchQuery = '';

// DOM Elements
const reportsFeed = document.getElementById('reportsFeed');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const filtersForm = document.getElementById('filtersForm');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const activeFilters = document.getElementById('activeFilters');
const activeFiltersCount = document.getElementById('activeFiltersCount');
const loadingIndicator = document.getElementById('loadingIndicator');
const noResultsMessage = document.getElementById('noResultsMessage');
const reportWebUrl = document.getElementById('reportWebUrl');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    searchForm.addEventListener('submit', handleSearch);
    loadMoreBtn.addEventListener('click', loadMoreReports);
    applyFiltersBtn.addEventListener('click', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);
    
    // Initial load
    loadReports();
});

function showLoading(show) {
    loadingIndicator.style.display = show ? 'block' : 'none';
}

function showNoResults(show) {
    noResultsMessage.style.display = show ? 'block' : 'none';
}

function loadReports(params = {}) {
    showLoading(true);
    showNoResults(false);
    
    const url = new URL('/v1/reports', window.location.origin);
    
    // Add filters to URL
    Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
    });
    
    // Add page token if available
    if (pageToken) {
        url.searchParams.append('page_token', pageToken);
    }
    
    // Set default limit
    if (!url.searchParams.has('limit')) {
        url.searchParams.append('limit', '10');
    }
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            showLoading(false);
            
            if (data.reports && data.reports.length > 0) {
                renderReports(data.reports, !pageToken);
                pageToken = data.next_page_token;
                loadMoreBtn.style.display = pageToken ? 'inline-block' : 'none';
            } else {
                if (!pageToken) {
                    showNoResults(true);
                }
                loadMoreBtn.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error loading reports:', error);
            showLoading(false);
            alert('Failed to load reports. Please try again later.');
        });
}

function renderReports(reports, clearExisting = true) {
    if (clearExisting) {
        reportsFeed.innerHTML = '';
    }
    
    reports.forEach(report => {
        const reportCard = createReportCard(report);
        reportsFeed.appendChild(reportCard);
    });
}

function createReportCard(report) {
    const col = document.createElement('div');
    col.className = 'col';
    
    const publishDate = new Date(report.publish_time);
    const formattedDate = publishDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    col.innerHTML = `
        <div class="card report-card">
            <div class="card-body">
                <h5 class="card-title">${escapeHtml(report.title)}</h5>
                <h6 class="card-subtitle mb-2 text-muted">
                    <i class="bi bi-calendar-event me-2"></i>${formattedDate}
                    <i class="bi bi-building ms-3 me-2"></i>${escapeHtml(report.source)}
                </h6>
                <p class="card-text">${report.summary ? escapeHtml(report.summary) : 'No summary available.'}</p>
            </div>
            <div class="card-footer bg-transparent d-flex justify-content-between align-items-center">
                <small class="text-muted">ID: ${report.id}</small>
                <button class="btn btn-primary btn-sm view-report" data-report-id="${report.id}">
                    View Details <i class="bi bi-arrow-right ms-1"></i>
                </button>
            </div>
        </div>
    `;
    
    col.querySelector('.view-report').addEventListener('click', () => viewReportDetails(report.id));
    return col;
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function viewReportDetails(reportId) {
    showLoading(true);
    
    fetch(`/v1/reports/${reportId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(report => {
            showLoading(false);
            
            const publishDate = new Date(report.publish_time);
            const formattedDate = publishDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Update the web URL link
            reportWebUrl.href = report.web_url || '#';
            reportWebUrl.style.display = report.web_url ? 'inline-block' : 'none';
            
            const modalContent = document.getElementById('reportDetailContent');
            
            let iocSections = '';
            
            // Create IOC sections if they exist
            if (report.sha1s && report.sha1s.length > 0) {
                iocSections += createIocSection('SHA1 Hashes', report.sha1s);
            }
            
            if (report.sha256s && report.sha256s.length > 0) {
                iocSections += createIocSection('SHA256 Hashes', report.sha256s);
            }
            
            if (report.md5s && report.md5s.length > 0) {
                iocSections += createIocSection('MD5 Hashes', report.md5s);
            }
            
            if (report.urls && report.urls.length > 0) {
                iocSections += createIocSection('URLs', report.urls);
            }
            
            if (report.ipv4s && report.ipv4s.length > 0) {
                iocSections += createIocSection('IPv4 Addresses', report.ipv4s);
            }
            
            if (report.ipv6s && report.ipv6s.length > 0) {
                iocSections += createIocSection('IPv6 Addresses', report.ipv6s);
            }
            
            if (report.cves && report.cves.length > 0) {
                iocSections += createIocSection('CVEs', report.cves);
            }
            
            // YARA rules might need special formatting
            let yaraSection = '';
            if (report.yara_rules && report.yara_rules.length > 0) {
                yaraSection = `
                    <div class="ioc-section">
                        <h5>YARA Rules</h5>
                        <div class="ioc-list">
                            <pre>${escapeHtml(report.yara_rules.join('\n\n'))}</pre>
                        </div>
                    </div>
                `;
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
                        <i class="bi bi-hash"></i>
                        <span>ID: ${report.id}</span>
                    </div>
                </div>
                
                ${report.summary ? `
                <div class="summary-section">
                    <h5>Summary</h5>
                    <p>${escapeHtml(report.summary)}</p>
                </div>
                ` : ''}
                
                ${iocSections}
                ${yaraSection}
            `;
            
            // Declare bootstrap variable
            const reportDetailModal = new bootstrap.Modal(document.getElementById('reportDetailModal'));
            reportDetailModal.show();
        })
        .catch(error => {
            console.error('Error loading report details:', error);
            showLoading(false);
            alert('Failed to load report details. Please try again later.');
        });
}

function createIocSection(title, items) {
    return `
        <div class="ioc-section">
            <h5>${title} (${items.length})</h5>
            <div class="ioc-list">
                ${items.map(item => `<div class="ioc-item">${escapeHtml(item)}</div>`).join('')}
            </div>
        </div>
    `;
}

function loadMoreReports() {
    if (isSearchMode && currentSearchQuery) {
        searchReports(currentSearchQuery, true);
    } else {
        loadReports(getFilters());
    }
}

function handleSearch(e) {
    e.preventDefault();
    const query = searchInput.value.trim();
    
    if (query) {
        // Reset page token and clear feed for new search
        pageToken = null;
        reportsFeed.innerHTML = '';
        isSearchMode = true;
        currentSearchQuery = query;
        searchReports(query);
    } else {
        // If search is empty, go back to regular reports feed
        pageToken = null;
        reportsFeed.innerHTML = '';
        isSearchMode = false;
        currentSearchQuery = '';
        loadReports(getFilters());
    }
}

function searchReports(query, isLoadMore = false) {
    showLoading(true);
    showNoResults(false);
    
    const url = new URL('/v1/reports/search', window.location.origin);
    url.searchParams.append('q', query);
    
    if (pageToken && isLoadMore) {
        url.searchParams.append('page_token', pageToken);
    }
    
    url.searchParams.append('limit', '10');
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            showLoading(false);
            
            if (data.reports && data.reports.length > 0) {
                renderReports(data.reports, !isLoadMore);
                pageToken = data.next_page_token;
                loadMoreBtn.style.display = pageToken ? 'inline-block' : 'none';
            } else {
                if (!isLoadMore) {
                    showNoResults(true);
                }
                loadMoreBtn.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error searching reports:', error);
            showLoading(false);
            alert('Failed to search reports. Please try again later.');
        });
}

function applyFilters() {
    // Reset pagination
    pageToken = null;
    
    // Reset search mode
    isSearchMode = false;
    currentSearchQuery = '';
    searchInput.value = '';
    
    // Get and apply filters
    const filters = getFilters();
    updateActiveFilters(filters);
    
    // Clear existing reports and load with filters
    reportsFeed.innerHTML = '';
    loadReports(filters);
    
    // Close the modal
    const filtersModalElement = document.getElementById('filtersModal');
    const filtersModal = bootstrap.Modal.getInstance(filtersModalElement);
    if (filtersModal) {
        filtersModal.hide();
    }
}

function getFilters() {
    const titleValue = document.getElementById('titleFilter').value.trim();
    const sourceValue = document.getElementById('sourceFilter').value.trim();
    const publishedAfterValue = document.getElementById('publishedAfterFilter').value;
    const publishedBeforeValue = document.getElementById('publishedBeforeFilter').value;
    
    // Convert dates to Unix timestamps if they exist
    const publishedAfter = publishedAfterValue ? new Date(publishedAfterValue).getTime() / 1000 : null;
    const publishedBefore = publishedBeforeValue ? new Date(publishedBeforeValue).getTime() / 1000 : null;
    
    return {
        title: titleValue || null,
        source: sourceValue || null,
        published_after: publishedAfter,
        published_before: publishedBefore
    };
}

function updateActiveFilters(filters) {
    activeFilters.innerHTML = '';
    let count = 0;
    
    Object.entries(filters).forEach(([key, value]) => {
        if (value) {
            count++;
            
            let displayKey = key.replace('_', ' ');
            displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1);
            
            let displayValue = value;
            
            // Format date values
            if (key === 'published_after' || key === 'published_before') {
                displayValue = new Date(value * 1000).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
            
            const badge = document.createElement('span');
            badge.className = 'badge bg-secondary me-2 mb-2 filter-badge';
            badge.innerHTML = `${displayKey}: ${displayValue} <i class="bi bi-x"></i>`;
            badge.addEventListener('click', () => removeFilter(key));
            activeFilters.appendChild(badge);
        }
    });
    
    activeFiltersCount.textContent = count;
    activeFiltersCount.style.display = count > 0 ? 'inline-block' : 'none';
}

function removeFilter(key) {
    switch (key) {
        case 'title':
            document.getElementById('titleFilter').value = '';
            break;
        case 'source':
            document.getElementById('sourceFilter').value = '';
            break;
        case 'published_after':
            document.getElementById('publishedAfterFilter').value = '';
            break;
        case 'published_before':
            document.getElementById('publishedBeforeFilter').value = '';
            break;
    }
    
    applyFilters();
}

function clearFilters() {
    filtersForm.reset();
    applyFilters();
}
