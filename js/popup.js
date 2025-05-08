// Argus - Screen Time Tracker JavaScript

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Tab navigation
document.addEventListener('DOMContentLoaded', () => {
  // Get all tab buttons and content sections
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Add click event to each tab button
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add active class to clicked button
      button.classList.add('active');

      // Find the corresponding content section and make it active
      const tabId = button.id.replace('tab-', '');
      document.getElementById(`${tabId}-section`).classList.add('active');

      // Load data for the active tab
      loadTabData(tabId);
    });
  });

  // Initialize with the today tab
  loadTabData('today');

  // Setup settings handlers
  setupSettingsHandlers();

  // Setup history navigation
  setupHistoryNavigation();
});

// Load data for the selected tab
function loadTabData(tabId) {
  switch (tabId) {
    case 'today':
      loadTodayData();
      break;
    case 'stats':
      loadStatsData();
      break;
    case 'history':
      loadHistoryData();
      break;
    case 'settings':
      loadSettingsData();
      break;
  }
}

// Format time in milliseconds to a readable format
function formatTime(milliseconds) {
  if (!milliseconds) return '0m';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

// Load today's data
function loadTodayData() {
  browserAPI.storage.local.get(['sites', 'totalTime', 'history'], (result) => {
    const totalTime = result.totalTime || 0;
    const sites = result.sites || {};
    const history = result.history || {};

    // Update total time display
    document.getElementById('total-time-today').textContent = formatTime(totalTime);

    // Calculate weekly average
    calculateWeeklyAverage(history, totalTime);

    // Update progress bar based on daily goal
    browserAPI.storage.local.get(['dailyLimit'], (settings) => {
      const dailyLimit = settings.dailyLimit || 8; // Default 8 hours
      const limitInMs = dailyLimit * 60 * 60 * 1000;
      const percentage = Math.min((totalTime / limitInMs) * 100, 100);
      document.getElementById('time-progress').style.width = `${percentage}%`;
    });

    // Display sites list
    const sitesList = document.getElementById('sites-list');
    sitesList.innerHTML = '';

    // Sort sites by time spent (descending)
    const sortedSites = Object.entries(sites)
      .sort(([, a], [, b]) => b.totalTime - a.totalTime);

    if (sortedSites.length === 0) {
      sitesList.innerHTML = '<div class="no-data">No data available yet</div>';
      return;
    }

    // Create site items
    sortedSites.forEach(([domain, data]) => {
      const siteItem = document.createElement('div');
      siteItem.className = 'site-item';

      // Create site icon
      const siteIcon = document.createElement('div');
      siteIcon.className = 'site-icon';
      if (data.favicon) {
        const iconImg = document.createElement('img');
        iconImg.src = data.favicon;
        siteIcon.appendChild(iconImg);
      } else {
        siteIcon.textContent = domain.charAt(0).toUpperCase();
      }

      // Create site info
      const siteInfo = document.createElement('div');
      siteInfo.className = 'site-info';

      const siteDomain = document.createElement('div');
      siteDomain.className = 'site-domain';
      siteDomain.textContent = domain;

      const siteTime = document.createElement('div');
      siteTime.className = 'site-time';
      siteTime.textContent = formatTime(data.totalTime);

      // Assemble the elements
      siteInfo.appendChild(siteDomain);
      siteInfo.appendChild(siteTime);

      siteItem.appendChild(siteIcon);
      siteItem.appendChild(siteInfo);

      sitesList.appendChild(siteItem);
    });
  });
}

// Calculate and display weekly average
function calculateWeeklyAverage(history, todayTime) {
  const last7Days = getLastNDays(7);
  let totalWeekTime = todayTime; // Include today's time
  let daysWithData = todayTime > 0 ? 1 : 0;
  
  // Sum up time from previous 6 days
  last7Days.slice(0, 6).forEach(date => {
    const dateString = date.toDateString();
    const dayData = history[dateString];
    
    if (dayData && dayData.totalTime > 0) {
      totalWeekTime += dayData.totalTime;
      daysWithData++;
    }
  });
  
  const averageTime = daysWithData > 0 ? totalWeekTime / daysWithData : 0;
  
  // Create or update the daily stats box
  const summaryCard = document.querySelector('.summary-card');
  let dailyStatsBox = document.getElementById('daily-stats');
  
  if (!dailyStatsBox) {
    dailyStatsBox = document.createElement('div');
    dailyStatsBox.id = 'daily-stats';
    dailyStatsBox.className = 'daily-stats';
    
    const dailyAvgLabel = document.createElement('div');
    dailyAvgLabel.className = 'daily-avg-label';
    dailyAvgLabel.textContent = 'Daily Average (This Week)';
    
    const dailyAvgTime = document.createElement('div');
    dailyAvgTime.id = 'daily-avg-time';
    dailyAvgTime.className = 'daily-avg-time';
    
    dailyStatsBox.appendChild(dailyAvgLabel);
    dailyStatsBox.appendChild(dailyAvgTime);
    
    summaryCard.appendChild(dailyStatsBox);
  }
  
  // Update the average time
  document.getElementById('daily-avg-time').textContent = formatTime(averageTime);
}

// Load statistics data
function loadStatsData() {
  browserAPI.storage.local.get(['history', 'sites'], (result) => {
    const history = result.history || {};
    const todaySites = result.sites || {};

    // Calculate most used site
    let mostUsedSite = { domain: '-', totalTime: 0 };
    
    // Check today's data
    Object.entries(todaySites).forEach(([domain, data]) => {
      if (data.totalTime > mostUsedSite.totalTime) {
        mostUsedSite = { domain, totalTime: data.totalTime };
      }
    });
    
    // Check historical data
    Object.values(history).forEach(dayData => {
      Object.entries(dayData.sites || {}).forEach(([domain, data]) => {
        // Aggregate this with existing data for the same domain
        const totalTimeForDomain = data.totalTime + (todaySites[domain]?.totalTime || 0);
        if (totalTimeForDomain > mostUsedSite.totalTime) {
          mostUsedSite = { domain, totalTime: totalTimeForDomain };
        }
      });
    });

    // Update most used site
    document.getElementById('most-used-site').textContent = 
      mostUsedSite.domain !== '-' ? `${mostUsedSite.domain} (${formatTime(mostUsedSite.totalTime)})` : '-';

    // Weekly chart data preparation
    const last7Days = getLastNDays(7);
    const weeklyData = [];
    const weekLabels = [];

    last7Days.forEach(date => {
      const dateString = date.toDateString();
      weekLabels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      
      // Get data for this day
      const dayData = history[dateString];
      const dayTotalTime = dayData ? dayData.totalTime : 0;
      
      // Convert to hours for the chart
      weeklyData.push(dayTotalTime / (1000 * 60 * 60));
    });

    // Add today's data
    const today = new Date().toDateString();
    if (last7Days[last7Days.length - 1].toDateString() === today) {
      weeklyData[weeklyData.length - 1] = (result.totalTime || 0) / (1000 * 60 * 60);
    }

    // Find the most productive day
    const maxTimeIndex = weeklyData.indexOf(Math.max(...weeklyData));
    if (maxTimeIndex !== -1 && weeklyData[maxTimeIndex] > 0) {
      document.getElementById('most-productive-day').textContent = weekLabels[maxTimeIndex];
    } else {
      document.getElementById('most-productive-day').textContent = '-';
    }

    // Create/update weekly chart
    createWeeklyChart(weekLabels, weeklyData);

    // Create/update categories chart (simplified version using domains as categories)
    createCategoriesChart(todaySites);
  });
}

// Create weekly usage chart
function createWeeklyChart(labels, data) {
  const ctx = document.getElementById('weekly-chart').getContext('2d');
  
  // Check if chart already exists and destroy it
  if (window.weeklyChart) {
    window.weeklyChart.destroy();
  }
  
  window.weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Hours',
        data: data,
        backgroundColor: '#4a1e8a',
        borderColor: '#4a1e8a',
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours'
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Weekly Usage'
        },
        legend: {
          display: false
        }
      }
    }
  });
}

// Create categories chart
function createCategoriesChart(sites) {
  const ctx = document.getElementById('categories-chart').getContext('2d');
  
  // Check if chart already exists and destroy it
  if (window.categoriesChart) {
    window.categoriesChart.destroy();
  }
  
  // Get top 5 sites
  const topSites = Object.entries(sites)
    .sort(([, a], [, b]) => b.totalTime - a.totalTime)
    .slice(0, 5);
  
  const labels = topSites.map(([domain]) => domain);
  const data = topSites.map(([, siteData]) => siteData.totalTime / (1000 * 60)); // Convert to minutes
  
  // If we have less than 5 sites, fill the rest with blank data
  while (labels.length < 5) {
    labels.push('');
    data.push(0);
  }
  
  // Generate colors
  const backgroundColors = [
    '#4a1e8a', '#6a3dbc', '#8a5ce0', '#a97df2', '#c9a0ff'
  ];
  
  window.categoriesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Top Sites (minutes)'
        }
      }
    }
  });
}

// Load history data
function loadHistoryData() {
  const selectedDate = document.getElementById('selected-date').textContent;
  
  // If viewing today, get current data
  if (selectedDate === 'Today') {
    browserAPI.storage.local.get(['sites', 'totalTime'], (result) => {
      displayHistoryData(result.sites || {}, result.totalTime || 0);
    });
    return;
  }
  
  // Otherwise, get historical data
  browserAPI.storage.local.get(['history'], (result) => {
    const history = result.history || {};
    const dayData = history[selectedDate] || { sites: {}, totalTime: 0 };
    
    displayHistoryData(dayData.sites, dayData.totalTime);
  });
}

// Display history data for a specific date
function displayHistoryData(sites, totalTime) {
  const historyData = document.getElementById('history-data');
  historyData.innerHTML = '';
  
  // Add total time
  const totalTimeElem = document.createElement('div');
  totalTimeElem.className = 'history-total-time';
  
  // Create elements instead of using innerHTML
  const strongElement = document.createElement('strong');
  strongElement.textContent = 'Total time:';
  totalTimeElem.appendChild(strongElement);
  totalTimeElem.appendChild(document.createTextNode(' ' + formatTime(totalTime)));
  
  historyData.appendChild(totalTimeElem);
  
  // Sort sites by time spent
  const sortedSites = Object.entries(sites)
    .sort(([, a], [, b]) => b.totalTime - a.totalTime);
  
  if (sortedSites.length === 0) {
    const noData = document.createElement('div');
    noData.className = 'no-data';
    noData.textContent = 'No data available for this date';
    historyData.appendChild(noData);
    return;
  }
  
  // Create sites list
  const sitesList = document.createElement('div');
  sitesList.className = 'sites-list';
  
  sortedSites.forEach(([domain, data]) => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';
    
    const siteIcon = document.createElement('div');
    siteIcon.className = 'site-icon';
    siteIcon.textContent = domain.charAt(0).toUpperCase();
    
    const siteInfo = document.createElement('div');
    siteInfo.className = 'site-info';
    
    const siteDomain = document.createElement('div');
    siteDomain.className = 'site-domain';
    siteDomain.textContent = domain;
    
    const siteTime = document.createElement('div');
    siteTime.className = 'site-time';
    siteTime.textContent = formatTime(data.totalTime);
    
    siteInfo.appendChild(siteDomain);
    siteInfo.appendChild(siteTime);
    
    siteItem.appendChild(siteIcon);
    siteItem.appendChild(siteInfo);
    
    sitesList.appendChild(siteItem);
  });
  
  historyData.appendChild(sitesList);
}

// Setup history navigation
function setupHistoryNavigation() {
  const prevDateBtn = document.getElementById('prev-date');
  const nextDateBtn = document.getElementById('next-date');
  const selectedDateElem = document.getElementById('selected-date');
  
  const today = new Date();
  let currentDate = new Date();
  
  // Update selected date display
  function updateSelectedDate() {
    const isToday = currentDate.toDateString() === today.toDateString();
    
    if (isToday) {
      selectedDateElem.textContent = 'Today';
    } else {
      selectedDateElem.textContent = currentDate.toDateString();
    }
    
    // Disable next button if we're at today
    nextDateBtn.disabled = isToday;
    
    // Load data for the selected date
    loadHistoryData();
  }
  
  // Previous date button
  prevDateBtn.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    updateSelectedDate();
  });
  
  // Next date button
  nextDateBtn.addEventListener('click', () => {
    // Can't go beyond today
    if (currentDate.toDateString() !== today.toDateString()) {
      currentDate.setDate(currentDate.getDate() + 1);
      updateSelectedDate();
    }
  });
  
  // Initialize with today
  updateSelectedDate();
}

// Setup settings handlers
function setupSettingsHandlers() {
  // Load current settings
  browserAPI.storage.local.get(['idleTime', 'dailyLimit', 'showNotifications'], (settings) => {
    document.getElementById('idle-time').value = settings.idleTime || 5;
    document.getElementById('daily-limit').value = settings.dailyLimit || 8;
    document.getElementById('show-notifications').checked = 
      settings.showNotifications === undefined ? true : settings.showNotifications;
  });
  
  // Save settings on change
  document.getElementById('idle-time').addEventListener('change', function() {
    const idleTime = parseInt(this.value) || 5;
    browserAPI.storage.local.set({ idleTime: idleTime });
    browserAPI.idle.setDetectionInterval(idleTime * 60);
  });
  
  document.getElementById('daily-limit').addEventListener('change', function() {
    browserAPI.storage.local.set({ dailyLimit: parseFloat(this.value) || 8 });
  });
  
  document.getElementById('show-notifications').addEventListener('change', function() {
    browserAPI.storage.local.set({ showNotifications: this.checked });
  });
  
  // Export data
  document.getElementById('export-data').addEventListener('click', () => {
    browserAPI.storage.local.get(null, (data) => {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `argus_data_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 100);
    });
  });
  
  // Clear data with confirmation
  document.getElementById('clear-data').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      browserAPI.storage.local.clear(() => {
        alert('All data has been cleared. The extension will now restart.');
        browserAPI.runtime.reload();
      });
    }
  });
}

// Helper function to get an array of the last N days
function getLastNDays(n) {
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(d);
  }
  return result;
}

// Load settings data
function loadSettingsData() {
  // This function is a placeholder since settings are loaded and managed in setupSettingsHandlers
  // but we need this to maintain consistency with the tab navigation system
} 