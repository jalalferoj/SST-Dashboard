// Global variables
let currentData = [];
let currentCharts = [];
let isFullscreen = false;

// DOM elements
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const preview = document.getElementById("preview");
const dataTable = document.getElementById("dataTable");
const analysis = document.getElementById("analysis");
const chartsDiv = document.getElementById("charts");
const loadingState = document.getElementById("loadingState");
const summaryCards = document.getElementById("summaryCards");
const analysisControls = document.getElementById("analysisControls");
const statisticsPanel = document.getElementById("statisticsPanel");

// Color schemes
const colorSchemes = {
  blue: ['#3B82F6', '#1E40AF', '#60A5FA', '#93C5FD', '#DBEAFE'],
  gradient: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'],
  vibrant: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
  monochrome: ['#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6']
};

// Event listeners
fileInput.addEventListener("change", handleFileSelect);
dropzone.addEventListener("dragover", handleDragOver);
dropzone.addEventListener("dragleave", handleDragLeave);
dropzone.addEventListener("drop", handleDrop);

document.getElementById("chartTypeSelect").addEventListener("change", refreshVisualizations);
document.getElementById("colorScheme").addEventListener("change", refreshVisualizations);
document.getElementById("animationSpeed").addEventListener("change", refreshVisualizations);
document.getElementById("refreshCharts").addEventListener("click", refreshVisualizations);
document.getElementById("fullscreenMode").addEventListener("click", toggleFullscreen);
document.getElementById("exportBtn").addEventListener("click", exportReport);

// Drag and drop handlers
function handleDragOver(e) {
  e.preventDefault();
  dropzone.classList.add("dropzone-active");
}

function handleDragLeave(e) {
  e.preventDefault();
  dropzone.classList.remove("dropzone-active");
}

function handleDrop(e) {
  e.preventDefault();
  dropzone.classList.remove("dropzone-active");
  const files = Array.from(e.dataTransfer.files);
  processFiles(files);
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  processFiles(files);
}

// File processing
function processFiles(files) {
  if (files.length === 0) return;
  
  showLoading(true);
  showNotification("Processing files...", "info");
  
  // Process first file for now (can be extended for multiple files)
  const file = files[0];
  
  if (!isValidFileType(file)) {
    showNotification("Please upload a valid CSV or Excel file", "error");
    showLoading(false);
    return;
  }
  
  if (file.size > 50 * 1024 * 1024) { // 50MB limit
    showNotification("File size too large. Please upload files smaller than 50MB", "error");
    showLoading(false);
    return;
  }
  
  const reader = new FileReader();
  
  if (file.name.toLowerCase().endsWith(".csv")) {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: function(results) {
        if (results.errors.length > 0) {
          console.warn("CSV parsing warnings:", results.errors);
        }
        processData(results.data, file.name);
      },
      error: function(error) {
        showNotification("Error parsing CSV file: " + error.message, "error");
        showLoading(false);
      }
    });
  } else {
    reader.onload = function(event) {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          defval: "",
          raw: false,
          dateNF: 'yyyy-mm-dd'
        });
        processData(jsonData, file.name);
      } catch (error) {
        showNotification("Error reading Excel file: " + error.message, "error");
        showLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function isValidFileType(file) {
  const validTypes = ['.csv', '.xls', '.xlsx'];
  return validTypes.some(type => file.name.toLowerCase().endsWith(type));
}

function processData(data, filename) {
  if (!data || data.length === 0) {
    showNotification("No data found in the file", "error");
    showLoading(false);
    return;
  }
  
  // Clean and validate data
  currentData = cleanData(data);
  
  if (currentData.length === 0) {
    showNotification("No valid data rows found", "error");
    showLoading(false);
    return;
  }
  
  showLoading(false);
  displaySummaryCards();
  displayDataPreview();
  displayAnalysisControls();
  generateVisualizations();
  generateStatistics();
  showNotification(`Successfully loaded ${currentData.length} records from ${filename}`, "success");
  
  // Show export button
  document.getElementById("exportBtn").classList.remove("hidden");
}

function cleanData(data) {
  return data.filter(row => {
    // Remove completely empty rows
    return Object.values(row).some(value => 
      value !== null && value !== undefined && value !== ""
    );
  }).map(row => {
    // Clean individual values
    const cleanedRow = {};
    Object.keys(row).forEach(key => {
      let value = row[key];
      if (typeof value === 'string') {
        value = value.trim();
        // Try to convert numeric strings
        if (!isNaN(value) && value !== '') {
          value = parseFloat(value);
        }
      }
      cleanedRow[key] = value;
    });
    return cleanedRow;
  });
}

function displaySummaryCards() {
  if (currentData.length === 0) return;
  
  const headers = Object.keys(currentData[0]);
  const numericColumns = getNumericColumns();
  const dataQuality = calculateDataQuality();
  
  document.getElementById("totalRecords").textContent = currentData.length.toLocaleString();
  document.getElementById("totalColumns").textContent = headers.length;
  document.getElementById("numericFields").textContent = numericColumns.length;
  document.getElementById("dataQuality").textContent = dataQuality + "%";
  
  summaryCards.classList.remove("hidden");
}

function calculateDataQuality() {
  if (currentData.length === 0) return 0;
  
  const headers = Object.keys(currentData[0]);
  let totalCells = currentData.length * headers.length;
  let filledCells = 0;
  
  currentData.forEach(row => {
    headers.forEach(header => {
      if (row[header] !== null && row[header] !== undefined && row[header] !== "") {
        filledCells++;
      }
    });
  });
  
  return Math.round((filledCells / totalCells) * 100);
}

function displayDataPreview() {
  preview.classList.remove("hidden");
  
  if (currentData.length === 0) return;
  
  const headers = Object.keys(currentData[0]);
  const displayHeaders = headers.slice(0, 8); // Show first 8 columns initially
  
  // Update preview info
  document.getElementById("previewInfo").textContent = 
    `Showing ${Math.min(10, currentData.length)} of ${currentData.length} rows`;
  
  // Create table header
  let thead = `<thead class="bg-gray-50">
    <tr>
      ${displayHeaders.map(h => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join("")}
    </tr>
  </thead>`;
  
  // Create table body
  let tbody = "<tbody class='bg-white divide-y divide-gray-200'>";
  currentData.slice(0, 10).forEach((row, index) => {
    tbody += `<tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
      ${displayHeaders.map(h => {
        let value = row[h];
        if (typeof value === 'number') {
          value = value.toLocaleString();
        }
        return `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${value || '-'}</td>`;
      }).join("")}
    </tr>`;
  });
  tbody += "</tbody>";
  
  dataTable.innerHTML = thead + tbody;
}

function displayAnalysisControls() {
  analysisControls.classList.remove("hidden");
}

function getNumericColumns() {
  if (currentData.length === 0) return [];
  
  const headers = Object.keys(currentData[0]);
  return headers.filter(header => {
    const values = currentData.map(row => row[header]).filter(v => v !== null && v !== "" && v !== undefined);
    return values.length > 0 && values.every(v => !isNaN(v) && typeof v === 'number');
  });
}

function getCategoricalColumns() {
  if (currentData.length === 0) return [];
  
  const headers = Object.keys(currentData[0]);
  const numericColumns = getNumericColumns();
  
  return headers.filter(header => {
    if (numericColumns.includes(header)) return false;
    
    const uniqueValues = [...new Set(currentData.map(row => row[header]))].filter(v => v !== null && v !== "" && v !== undefined);
    return uniqueValues.length > 1 && uniqueValues.length <= 20; // Reasonable number of categories
  });
}

function generateVisualizations() {
  analysis.classList.remove("hidden");
  chartsDiv.innerHTML = "";
  
  // Clear existing charts
  currentCharts.forEach(chart => chart.destroy());
  currentCharts = [];
  
  const numericColumns = getNumericColumns();
  const categoricalColumns = getCategoricalColumns();
  const chartType = document.getElementById("chartTypeSelect").value;
  const colorScheme = document.getElementById("colorScheme").value;
  const animationDuration = parseInt(document.getElementById("animationSpeed").value);
  
  if (numericColumns.length === 0) {
    showNotification("No numeric columns found for visualization", "warning");
    return;
  }
  
  // Generate different types of charts
  numericColumns.slice(0, 6).forEach((column, index) => {
    createChart(column, chartType, colorScheme, animationDuration, index);
  });
  
  // Create correlation chart if multiple numeric columns
  if (numericColumns.length > 1) {
    createCorrelationChart(numericColumns.slice(0, 2), colorScheme, animationDuration);
  }
  
  // Create categorical analysis if available
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    createCategoricalChart(categoricalColumns[0], numericColumns[0], colorScheme, animationDuration);
  }
}

function createChart(column, chartType, colorScheme, animationDuration, index) {
  const chartId = `chart_${column.replace(/\s+/g, '_')}_${index}`;
  const container = document.createElement("div");
  container.className = "bg-white rounded-xl shadow-sm p-6 hover-lift";
  
  const canvas = document.createElement("canvas");
  canvas.id = chartId;
  
  const header = document.createElement("div");
  header.className = "flex items-center justify-between mb-4";
  header.innerHTML = `
    <h4 class="text-lg font-semibold text-gray-900">${column}</h4>
    <div class="flex items-center space-x-2">
      <button class="text-gray-400 hover:text-gray-600" onclick="downloadChart('${chartId}')">
        <i class="fas fa-download"></i>
      </button>
      <button class="text-gray-400 hover:text-gray-600" onclick="expandChart('${chartId}')">
        <i class="fas fa-expand"></i>
      </button>
    </div>
  `;
  
  container.appendChild(header);
  container.appendChild(canvas);
  chartsDiv.appendChild(container);
  
  const values = currentData.map(row => row[column]).filter(v => v !== null && v !== undefined && !isNaN(v));
  const colors = colorSchemes[colorScheme];
  
  let config;
  const detectedChartType = chartType === 'auto' ? detectBestChartType(values) : chartType;
  
  switch (detectedChartType) {
    case 'histogram':
      config = createHistogramConfig(values, colors, animationDuration, column);
      break;
    case 'line':
      config = createLineConfig(values, colors, animationDuration, column);
      break;
    case 'pie':
      config = createPieConfig(values, colors, animationDuration, column);
      break;
    default:
      config = createBarConfig(values, colors, animationDuration, column);
  }
  
  const chart = new Chart(canvas, config);
  currentCharts.push(chart);
}

function detectBestChartType(values) {
  if (values.length > 50) return 'histogram';
  if (values.length > 20) return 'line';
  return 'bar';
}

function createBarConfig(values, colors, animationDuration, column) {
  return {
    type: 'bar',
    data: {
      labels: values.slice(0, 20).map((_, i) => `Record ${i + 1}`),
      datasets: [{
        label: column,
        data: values.slice(0, 20),
        backgroundColor: colors[0] + '80',
        borderColor: colors[0],
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: animationDuration },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white',
          borderColor: colors[0],
          borderWidth: 1
        }
      },
      scales: {
        y: { 
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { color: '#6B7280' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#6B7280' }
        }
      }
    }
  };
}

function createLineConfig(values, colors, animationDuration, column) {
  return {
    type: 'line',
    data: {
      labels: values.map((_, i) => i + 1),
      datasets: [{
        label: column,
        data: values,
        borderColor: colors[0],
        backgroundColor: colors[0] + '20',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: colors[0],
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: animationDuration },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white'
        }
      },
      scales: {
        y: { 
          beginAtZero: true,
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { color: '#6B7280' }
        },
        x: {
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { color: '#6B7280' }
        }
      }
    }
  };
}

function createHistogramConfig(values, colors, animationDuration, column) {
  const bins = createHistogramBins(values, 10);
  
  return {
    type: 'bar',
    data: {
      labels: bins.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`),
      datasets: [{
        label: 'Frequency',
        data: bins.map(bin => bin.count),
        backgroundColor: colors[0] + '80',
        borderColor: colors[0],
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: animationDuration },
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `Distribution of ${column}`,
          font: { size: 14, weight: 'bold' }
        }
      },
      scales: {
        y: { 
          beginAtZero: true,
          title: { display: true, text: 'Frequency' },
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { color: '#6B7280' }
        },
        x: {
          title: { display: true, text: column },
          grid: { display: false },
          ticks: { color: '#6B7280' }
        }
      }
    }
  };
}

function createHistogramBins(values, binCount) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / binCount;
  
  const bins = [];
  for (let i = 0; i < binCount; i++) {
    const binMin = min + i * binWidth;
    const binMax = min + (i + 1) * binWidth;
    const count = values.filter(v => v >= binMin && (i === binCount - 1 ? v <= binMax : v < binMax)).length;
    bins.push({ min: binMin, max: binMax, count });
  }
  
  return bins;
}

function createCorrelationChart(columns, colorScheme, animationDuration) {
  const chartId = `correlation_chart`;
  const container = document.createElement("div");
  container.className = "bg-white rounded-xl shadow-sm p-6 hover-lift lg:col-span-2";
  
  const canvas = document.createElement("canvas");
  canvas.id = chartId;
  
  const header = document.createElement("div");
  header.className = "flex items-center justify-between mb-4";
  header.innerHTML = `
    <h4 class="text-lg font-semibold text-gray-900">Correlation: ${columns.join(' vs ')}</h4>
    <div class="flex items-center space-x-2">
      <button class="text-gray-400 hover:text-gray-600" onclick="downloadChart('${chartId}')">
        <i class="fas fa-download"></i>
      </button>
    </div>
  `;
  
  container.appendChild(header);
  container.appendChild(canvas);
  chartsDiv.appendChild(container);
  
  const xValues = currentData.map(row => row[columns[0]]).filter(v => v !== null && !isNaN(v));
  const yValues = currentData.map(row => row[columns[1]]).filter(v => v !== null && !isNaN(v));
  
  const scatterData = xValues.map((x, i) => ({ x, y: yValues[i] })).filter(point => point.y !== undefined);
  
  const colors = colorSchemes[colorScheme];
  
  const config = {
    type: 'scatter',
    data: {
      datasets: [{
        label: `${columns[0]} vs ${columns[1]}`,
        data: scatterData,
        backgroundColor: colors[0] + '60',
        borderColor: colors[0],
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: animationDuration },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white'
        }
      },
      scales: {
        x: {
          title: { display: true, text: columns[0] },
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { color: '#6B7280' }
        },
        y: {
          title: { display: true, text: columns[1] },
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { color: '#6B7280' }
        }
      }
    }
  };
  
  const chart = new Chart(canvas, config);
  currentCharts.push(chart);
}

function createCategoricalChart(categoryColumn, valueColumn, colorScheme, animationDuration) {
  const chartId = `categorical_chart`;
  const container = document.createElement("div");
  container.className = "bg-white rounded-xl shadow-sm p-6 hover-lift lg:col-span-2";
  
  const canvas = document.createElement("canvas");
  canvas.id = chartId;
  
  const header = document.createElement("div");
  header.className = "flex items-center justify-between mb-4";
  header.innerHTML = `
    <h4 class="text-lg font-semibold text-gray-900">${valueColumn} by ${categoryColumn}</h4>
    <div class="flex items-center space-x-2">
      <button class="text-gray-400 hover:text-gray-600" onclick="downloadChart('${chartId}')">
        <i class="fas fa-download"></i>
      </button>
    </div>
  `;
  
  container.appendChild(header);
  container.appendChild(canvas);
  chartsDiv.appendChild(container);
  
  // Group data by category
  const groupedData = {};
  currentData.forEach(row => {
    const category = row[categoryColumn];
    const value = row[valueColumn];
    if (category && !isNaN(value)) {
      if (!groupedData[category]) groupedData[category] = [];
      groupedData[category].push(value);
    }
  });
  
  // Calculate averages
  const categories = Object.keys(groupedData);
  const averages = categories.map(cat => {
    const values = groupedData[cat];
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  });
  
  const colors = colorSchemes[colorScheme];
  
  const config = {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [{
        label: `Average ${valueColumn}`,
        data: averages,
        backgroundColor: colors.map((color, i) => color + '80'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: animationDuration },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: 'white',
          bodyColor: 'white'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: `Average ${valueColumn}` },
          grid: { color: 'rgba(0, 0, 0, 0.1)' },
          ticks: { color: '#6B7280' }
        },
        x: {
          title: { display: true, text: categoryColumn },
          grid: { display: false },
          ticks: { color: '#6B7280' }
        }
      }
    }
  };
  
  const chart = new Chart(canvas, config);
  currentCharts.push(chart);
}

function generateStatistics() {
  statisticsPanel.classList.remove("hidden");
  const statisticsContent = document.getElementById("statisticsContent");
  statisticsContent.innerHTML = "";
  
  const numericColumns = getNumericColumns();
  
  numericColumns.slice(0, 6).forEach(column => {
    const values = currentData.map(row => row[column]).filter(v => v !== null && !isNaN(v));
    const stats = calculateStatistics(values);
    
    const statCard = document.createElement("div");
    statCard.className = "bg-gray-50 rounded-lg p-4";
    statCard.innerHTML = `
      <h4 class="font-semibold text-gray-900 mb-3">${column}</h4>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-600">Mean:</span>
          <span class="font-medium">${stats.mean.toFixed(2)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Median:</span>
          <span class="font-medium">${stats.median.toFixed(2)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Std Dev:</span>
          <span class="font-medium">${stats.stdDev.toFixed(2)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Min:</span>
          <span class="font-medium">${stats.min.toFixed(2)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">Max:</span>
          <span class="font-medium">${stats.max.toFixed(2)}</span>
        </div>
      </div>
    `;
    
    statisticsContent.appendChild(statCard);
  });
}

function calculateStatistics(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const median = sorted.length % 2 === 0 
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    mean,
    median,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values)
  };
}

function refreshVisualizations() {
  if (currentData.length > 0) {
    generateVisualizations();
    showNotification("Visualizations refreshed", "success");
  }
}

function toggleFullscreen() {
  // Implementation for fullscreen mode
  if (!isFullscreen) {
    document.documentElement.requestFullscreen();
    isFullscreen = true;
    document.getElementById("fullscreenMode").innerHTML = '<i class="fas fa-compress mr-2"></i>Exit Fullscreen';
  } else {
    document.exitFullscreen();
    isFullscreen = false;
    document.getElementById("fullscreenMode").innerHTML = '<i class="fas fa-expand mr-2"></i>Fullscreen';
  }
}

function downloadChart(chartId) {
  const canvas = document.getElementById(chartId);
  const link = document.createElement('a');
  link.download = `${chartId}.png`;
  link.href = canvas.toDataURL();
  link.click();
}

function expandChart(chartId) {
  // Implementation for expanding individual charts
  showNotification("Chart expanded", "info");
}

function exportReport() {
  // Create a comprehensive report
  const report = {
    summary: {
      totalRecords: currentData.length,
      totalColumns: Object.keys(currentData[0] || {}).length,
      numericFields: getNumericColumns().length,
      dataQuality: calculateDataQuality()
    },
    data: currentData,
    statistics: {}
  };
  
  // Add statistics for numeric columns
  getNumericColumns().forEach(column => {
    const values = currentData.map(row => row[column]).filter(v => v !== null && !isNaN(v));
    report.statistics[column] = calculateStatistics(values);
  });
  
  // Download as JSON
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `sst_analytics_report_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  showNotification("Report exported successfully", "success");
}

function showLoading(show) {
  if (show) {
    loadingState.classList.remove("hidden");
    dropzone.style.opacity = "0.5";
  } else {
    loadingState.classList.add("hidden");
    dropzone.style.opacity = "1";
  }
}

function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification-item px-6 py-4 rounded-lg shadow-lg text-white mb-4 fade-in ${
    type === "success" ? "bg-green-500" : 
    type === "error" ? "bg-red-500" : 
    type === "warning" ? "bg-yellow-500" : "bg-blue-500"
  }`;
  
  notification.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <i class="fas ${
          type === "success" ? "fa-check-circle" : 
          type === "error" ? "fa-exclamation-circle" : 
          type === "warning" ? "fa-exclamation-triangle" : "fa-info-circle"
        }"></i>
        <span>${message}</span>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  document.getElementById("notifications").appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Initialize the application
document.addEventListener("DOMContentLoaded", function() {
  console.log("SST Analytics Pro initialized");
});