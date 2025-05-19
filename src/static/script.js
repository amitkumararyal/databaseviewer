let currentPage = 1;
const rowsPerPage = 50;
let activeFilters = [];
let totalRecordsCount = 0;
let isDarkTheme = false;
let availableColumns = [];
let selectedColumns = new Set();
let currentSorts = [];
let currentTable = '';
let availableTables = [];

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('columnSelect').addEventListener('change', updateFilterTypes);
    document.getElementById('filterType').addEventListener('change', onFilterTypeChange);
    document.getElementById('prevBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchTableData();
        }
    });
    document.getElementById('nextBtn').addEventListener('click', () => {
        currentPage++;
        fetchTableData();
    });

    // Initialize by fetching available tables
    fetchAvailableTables();
});

async function fetchAvailableTables() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/tables');
        const data = await response.json();
        availableTables = data.tables;
        populateTableSelector();
    } catch (error) {
        console.error('Error fetching tables:', error);
        updateConnectionStatus(false);
    }
}

function populateTableSelector() {
    const container = document.getElementById('tableSelect') || createTableSelector();
    container.innerHTML = `
        <select onchange="handleTableSelection(this.value)">
            <option value="">Select Table</option>
            ${availableTables.map(table => `
                <option value="${table}" ${table === currentTable ? 'selected' : ''}>
                    ${table}
                </option>
            `).join('')}
        </select>
    `;
}

function createTableSelector() {
    const navbar = document.querySelector('.navbar-start');
    const container = document.createElement('div');
    container.id = 'tableSelect';
    container.className = 'navbar-item';
    navbar.insertBefore(container, navbar.firstChild);
    return container;
}

async function handleTableSelection(tableName) {
    currentTable = tableName;
    if (!tableName) return;

    try {
        // Fetch table structure
        const response = await fetch(`http://127.0.0.1:8000/api/table-structure/${tableName}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch table structure');
        }
        
        // Reset filters and pagination
        activeFilters = [];
        currentPage = 1;
        selectedColumns = new Set(data.columns.map(col => col.name));
        availableColumns = data.columns;
        
        // Update UI
        displayActiveFilters();
        populateColumnSelector(data.columns);
        updateFilterColumnDropdown();
        
        // Fetch initial data
        fetchTableData();
    } catch (error) {
        console.error('Error fetching table structure:', error);
        updateConnectionStatus(false);
    }
}

function updateFilterTypes() {
    const columnSelect = document.getElementById('columnSelect');
    const filterType = document.getElementById('filterType');
    const selectedOption = columnSelect.options[columnSelect.selectedIndex];
    
    if (!selectedOption.value) {
        filterType.innerHTML = '<option value="">Select Column First</option>';
        return;
    }

    const isText = selectedOption.dataset.isText === 'true';
    const isNumeric = selectedOption.dataset.isNumeric === 'true';
    const isDate = selectedOption.dataset.isDate === 'true';

    let options = [];
    
    // Common filters for all types
    options.push('<option value="equals">Equals</option>');
    
    if (isText) {
        options.push(
            '<option value="contains">Contains</option>',
            '<option value="startsWith">Starts With</option>',
            '<option value="endsWith">Ends With</option>'
        );
    }
    
    if (isNumeric || isDate) {
        options.push(
            '<option value="greaterThan">Greater Than</option>',
            '<option value="lessThan">Less Than</option>',
            '<option value="between">Between</option>'
        );
    }
    
    options.push('<option value="in">In List (comma separated)</option>');
    
    filterType.innerHTML = options.join('');
}

function onFilterTypeChange() {
    const filterType = document.getElementById('filterType').value;
    const additionalInputs = document.getElementById('additionalFilterInputs');

    if (filterType === 'between') {
        additionalInputs.innerHTML = `
            <input type="text" id="filterValueMin" placeholder="Minimum value">
            <input type="text" id="filterValueMax" placeholder="Maximum value">
        `;
        document.getElementById('filterValue').style.display = 'none';
    } else {
        additionalInputs.innerHTML = '';
        document.getElementById('filterValue').style.display = 'block';
    }
}

function addFilter() {
    const column = document.getElementById('columnSelect').value;
    const filterType = document.getElementById('filterType').value;
    let filterValue = document.getElementById('filterValue').value;

    if (!column || (!filterValue && filterType !== 'between')) return;

    const filter = {
        id: Date.now(),
        column,
        type: filterType,
        value: filterValue
    };

    if (filterType === 'between') {
        filter.value = {
            min: document.getElementById('filterValueMin').value,
            max: document.getElementById('filterValueMax').value
        };
    } else if (filterType === 'in') {
        filter.value = filterValue.split(',').map(v => v.trim());
    }

    activeFilters.push(filter);
    displayActiveFilters();
    currentPage = 1; // Reset to first page when filter is added
    fetchTableData();

    // Reset inputs
    document.getElementById('filterValue').value = '';
    document.getElementById('additionalFilterInputs').innerHTML = '';
}

function removeFilter(filterId) {
    activeFilters = activeFilters.filter(f => f.id !== filterId);
    displayActiveFilters();
    currentPage = 1; // Reset to first page when filter is removed
    fetchTableData();
}

function displayActiveFilters() {
    const container = document.getElementById('activeFilters');
    container.innerHTML = activeFilters.map(filter => {
        let filterText = `${filter.column}: ${filter.type} `;
        if (filter.type === 'between') {
            filterText += `${filter.value.min} - ${filter.value.max}`;
        } else if (filter.type === 'in') {
            filterText += `[${filter.value.join(', ')}]`;
        } else {
            filterText += `"${filter.value}"`;
        }

        return `
            <div class="filter-tag">
                <span>${filterText}</span>
                <button onclick="removeFilter(${filter.id})">×</button>
            </div>
        `;
    }).join('');
}

async function fetchTableData() {
    if (!currentTable) return;
    
    try {
        const filterString = activeFilters.map(f => JSON.stringify({
            column: f.column,
            type: f.type,
            value: f.value
        })).join('|');

        const url = new URL(`http://127.0.0.1:8000/api/table-data/${currentTable}`);
        url.searchParams.append('page', currentPage);
        url.searchParams.append('page_size', rowsPerPage);
        if (filterString) {
            url.searchParams.append('filters', filterString);
        }
        if (selectedColumns.size > 0) {
            url.searchParams.append('columns', Array.from(selectedColumns).join(','));
        }
        if (currentSorts.length > 0) {
            url.searchParams.append('sort', JSON.stringify(currentSorts));
        }

        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok) {
            totalRecordsCount = data.total;
            populateTable(data);
            updateConnectionStatus(true);
        } else {
            console.error('Error:', data.error);
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        updateConnectionStatus(false);
    }
}

function formatCellValue(value, columnType) {
    if (value === null || value === undefined) return '';
    
    const type = String(columnType).toLowerCase();
    
    // Format dates
    if (type.includes('date') || type.includes('time')) {
        try {
            const date = new Date(value);
            return date.toLocaleString();
        } catch (e) {
            return value;
        }
    }
    
    // Format numbers
    if (type.includes('decimal') || type.includes('numeric')) {
        return Number(value).toFixed(2);
    }
    
    return value;
}

function populateTable(data) {
    const table = document.getElementById('dataTable');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');

    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Only show selected columns
    const columnsToShow = Array.from(selectedColumns);
    const columnTypes = {};
    availableColumns.forEach(col => {
        columnTypes[col.name] = col.type;
    });
    
    // Add headers
    columnsToShow.forEach(column => {
        if (data.columns.includes(column)) {
            const th = document.createElement('th');
            th.textContent = column;
            th.addEventListener('click', (e) => handleSort(e, column));
            thead.appendChild(th);
        }
    });

    // Add rows with formatted values
    data.rows.forEach(row => {
        const tr = document.createElement('tr');
        columnsToShow.forEach(column => {
            if (data.columns.includes(column)) {
                const cellIndex = data.columns.indexOf(column);
                const td = document.createElement('td');
                td.textContent = formatCellValue(row[cellIndex], columnTypes[column]);
                tr.appendChild(td);
            }
        });
        tbody.appendChild(tr);
    });

    updatePaginationInfo(data);
}

function handleSort(event, column) {
    const isShiftHeld = event.shiftKey;
    
    // Find if the column is already being sorted
    const existingSortIndex = currentSorts.findIndex(s => s.column === column);
    
    if (existingSortIndex !== -1) {
        // Column is already being sorted
        if (currentSorts[existingSortIndex].direction === 'asc') {
            // Change to descending
            currentSorts[existingSortIndex].direction = 'desc';
        } else {
            // Remove sort if it's already descending
            currentSorts.splice(existingSortIndex, 1);
        }
    } else {
        // Add new sort
        const newSort = { column, direction: 'asc' };
        if (isShiftHeld) {
            // Add to existing sorts if shift is held
            currentSorts.push(newSort);
        } else {
            // Replace all sorts if shift is not held
            currentSorts = [newSort];
        }
    }

    // Refresh the table with new sort
    fetchTableData();
}

function updatePaginationInfo(data) {
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.page * data.pageSize, data.total);
    document.getElementById('paginationInfo').textContent = 
        data.total === 0 ? 'No results found' : `Showing ${start}-${end} of ${data.total} rows`;

    // Update pagination buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    prevBtn.disabled = data.page === 1;
    nextBtn.disabled = data.page === data.totalPages || data.totalPages === 0;
}

function updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById('connectionStatus');
    statusElement.className = isConnected ? 'connected' : 'disconnected';
    statusElement.innerHTML = `<i class="fas fa-database"></i> ${isConnected ? 'Connected' : 'Disconnected'}`;
}

async function downloadCSV() {
    try {
        // Show loading state
        const exportBtn = document.querySelector('.navbar-item[onclick="downloadCSV()"]');
        const originalContent = exportBtn.innerHTML;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
        
        // Prepare filter string
        const filterString = activeFilters.map(f => JSON.stringify({
            column: f.column,
            type: f.type,
            value: f.value
        })).join('|');

        const url = new URL('http://127.0.0.1:8001/api/get-table-data');
        url.searchParams.append('page', 1);
        url.searchParams.append('page_size', totalRecordsCount);
        if (filterString) {
            url.searchParams.append('filters', filterString);
        }

        const response = await fetch(url);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to fetch data for export');
        }

        // Generate CSV
        const headers = data.columns.join(',');
        const rows = data.rows.map(row => 
            row.map(cell => {
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',')
        ).join('\n');
        
        const csv = `${headers}\n${rows}`;
        downloadFile(csv, `table_data_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        
        // Restore original button state
        exportBtn.innerHTML = originalContent;
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data. Please try again.');
        
        // Restore original button state on error
        const exportBtn = document.querySelector('.navbar-item[onclick="downloadCSV()"]');
        exportBtn.innerHTML = '<i class="fas fa-download"></i> <span>Export</span>';
    }
}

function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    
    // Update CSS variables
    document.documentElement.style.setProperty('--sidebar-bg', isDarkTheme ? '#2d2d2d' : '#f4f4f4');
    document.documentElement.style.setProperty('--filter-controls-bg', isDarkTheme ? '#363636' : 'white');
    document.documentElement.style.setProperty('--input-border', isDarkTheme ? '#555' : '#ddd');
    document.documentElement.style.setProperty('--input-bg', isDarkTheme ? '#404040' : 'white');
    document.documentElement.style.setProperty('--input-color', isDarkTheme ? '#ffffff' : 'black');
    document.documentElement.style.setProperty('--filter-tag-bg', isDarkTheme ? '#404040' : '#e3f2fd');
    document.documentElement.style.setProperty('--filter-tag-color', isDarkTheme ? '#ffffff' : '#333');
    document.documentElement.style.setProperty('--table-bg', isDarkTheme ? '#2d2d2d' : 'white');
    document.documentElement.style.setProperty('--row-even-bg', isDarkTheme ? '#363636' : '#f8f9fa');
    document.documentElement.style.setProperty('--row-odd-bg', isDarkTheme ? '#2d2d2d' : 'white');
    document.documentElement.style.setProperty('--row-hover-bg', isDarkTheme ? '#404040' : '#f2f2f2');

    // Update body background
    document.body.style.backgroundColor = isDarkTheme ? '#1a1a1a' : 'white';
    document.body.style.color = isDarkTheme ? '#ffffff' : '#000000';
    
    // Update other elements
    updateThemeElements();
}

function updateThemeElements() {
    // Update filter controls text color
    document.querySelectorAll('.filter-controls h3, .active-filters h3').forEach(heading => {
        heading.style.color = isDarkTheme ? '#ffffff' : '#000000';
    });

    // Update select and input elements
    document.querySelectorAll('select, input').forEach(element => {
        element.style.color = isDarkTheme ? '#ffffff' : '#000000';
        element.style.backgroundColor = isDarkTheme ? '#404040' : 'white';
        element.style.borderColor = isDarkTheme ? '#555' : '#ddd';
    });
}

function showTableInfo() {
    const modal = document.getElementById('tableInfoModal');
    const content = document.getElementById('tableInfoContent');
    
    content.innerHTML = `
        <p><strong>Total Records:</strong> ${totalRecordsCount}</p>
        <p><strong>Columns:</strong> ${document.getElementById('dataTable').getElementsByTagName('th').length}</p>
        <p><strong>Active Filters:</strong> ${activeFilters.length}</p>
        <p><strong>Table:</strong> ${currentTable}</p>
        <p><strong>Last Refreshed:</strong> ${new Date().toLocaleString()}</p>
    `;
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('tableInfoModal').style.display = 'none';
}

function refreshData() {
    currentPage = 1;
    fetchTableData();
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('tableInfoModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
};

function toggleColumnSelector() {
    const content = document.getElementById('columnSelectorContent');
    content.classList.toggle('show');
}

function populateColumnSelector(columns) {
    const container = document.getElementById('columnOptions');
    container.innerHTML = columns.map((column, index) => `
        <div class="column-option" title="Type: ${column.type}${column.nullable ? ' (Nullable)' : ''}\n${column.primary_key ? 'Primary Key' : ''}">
            <input type="checkbox" 
                id="col_${index}" 
                value="${column.name}" 
                ${selectedColumns.has(column.name) ? 'checked' : ''}
                onchange="handleColumnSelection(this)">
            <label for="col_${index}">${column.name}</label>
        </div>
    `).join('');
}

function handleColumnSelection(checkbox) {
    if (checkbox.checked) {
        selectedColumns.add(checkbox.value);
    } else {
        selectedColumns.delete(checkbox.value);
    }
}

function toggleAllColumns(select) {
    const checkboxes = document.querySelectorAll('#columnOptions input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = select;
        if (select) {
            selectedColumns.add(checkbox.value);
        } else {
            selectedColumns.delete(checkbox.value);
        }
    });
}

function applyColumnSelection() {
    // Close the dropdown
    document.getElementById('columnSelectorContent').classList.remove('show');
    
    // Update the filter column dropdown to only show selected columns
    updateFilterColumnDropdown();
    
    // Refresh the table with selected columns
    fetchTableData();
}

function updateFilterColumnDropdown() {
    const columnSelect = document.getElementById('columnSelect');
    columnSelect.innerHTML = '<option value="">Select Column</option>';
    
    availableColumns.forEach(col => {
        const type = String(col.type).toLowerCase();
        const isTextType = type.includes('char') || type.includes('text');
        const isNumericType = type.includes('int') || type.includes('decimal') || type.includes('float');
        const isDateType = type.includes('date') || type.includes('time');
        
        columnSelect.innerHTML += `
            <option value="${col.name}" 
                    data-type="${type}"
                    data-is-text="${isTextType}"
                    data-is-numeric="${isNumericType}"
                    data-is-date="${isDateType}">
                ${col.name}
            </option>
        `;
    });
}