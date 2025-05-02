// Argus - Time tracking background service worker

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Constants
const ALARM_NAME = 'update-tracker';
const UPDATE_INTERVAL = 1; // minutes
const IDLE_THRESHOLD = 30; // seconds

// State
let currentTab = null;
let lastActiveTime = Date.now();
let isTracking = true;

// Initialize the extension
browserAPI.runtime.onInstalled.addListener(() => {
  initializeExtension();
});

// For Firefox with Manifest V2, we need to initialize on startup
if (typeof browser !== 'undefined') {
  initializeExtension();
}

function initializeExtension() {
  // Setup update alarm
  browserAPI.alarms.create(ALARM_NAME, { periodInMinutes: UPDATE_INTERVAL });
  
  // Initialize storage if needed
  browserAPI.storage.local.get(['sites', 'totalTime', 'lastDate'], (result) => {
    if (!result.sites) {
      browserAPI.storage.local.set({
        sites: {},
        totalTime: 0,
        lastDate: new Date().toDateString()
      });
    }
    
    // Check if it's a new day and reset if needed
    checkAndResetForNewDay(result.lastDate);
  });
}

// Check for new day and reset stats if needed
function checkAndResetForNewDay(lastDate) {
  const today = new Date().toDateString();
  
  if (lastDate && lastDate !== today) {
    // Archive yesterday's data if needed
    browserAPI.storage.local.get(['sites', 'history'], (result) => {
      const yesterday = new Date(lastDate);
      const historicalData = result.history || {};
      
      // Store yesterday's data in history
      historicalData[lastDate] = {
        sites: result.sites,
        totalTime: result.totalTime,
        date: lastDate
      };
      
      // Keep only the last 30 days of history
      const historyDates = Object.keys(historicalData).sort();
      if (historyDates.length > 30) {
        const toRemove = historyDates.slice(0, historyDates.length - 30);
        toRemove.forEach(date => delete historicalData[date]);
      }
      
      // Reset today's data and update history
      browserAPI.storage.local.set({
        sites: {},
        totalTime: 0,
        lastDate: today,
        history: historicalData
      });
    });
  } else if (!lastDate) {
    browserAPI.storage.local.set({ lastDate: today });
  }
}

// Listen for tab changes
browserAPI.tabs.onActivated.addListener((activeInfo) => {
  if (!isTracking) return;
  
  updateTimeForCurrentTab();

  // Firefox uses a promise-based API, Chrome uses callbacks
  if (typeof browser !== 'undefined') {
    browser.tabs.get(activeInfo.tabId)
      .then(handleTabChange)
      .catch(error => console.error("Error handling tab activation:", error));
  } else {
    chrome.tabs.get(activeInfo.tabId, handleTabChange);
  }
});

// Listen for tab updates (URL changes)
browserAPI.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isTracking || !changeInfo.url || !tab.active) return;
  
  updateTimeForCurrentTab();
  handleTabChange(tab);
});

// Handle when a tab becomes the active tab
function handleTabChange(tab) {
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
    currentTab = null;
    return;
  }
  
  try {
    const url = new URL(tab.url);
    currentTab = {
      id: tab.id,
      domain: url.hostname,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      startTime: Date.now()
    };
  } catch (error) {
    console.error("Error processing URL:", error);
    currentTab = null;
  }
}

// Update time for the current tab before switching
function updateTimeForCurrentTab() {
  if (!currentTab) return;
  
  const now = Date.now();
  const timeSpent = now - currentTab.startTime;
  
  if (timeSpent > 1000) { // Only log if more than 1 second was spent
    browserAPI.storage.local.get(['sites', 'totalTime'], (result) => {
      const sites = result.sites || {};
      const domain = currentTab.domain;
      
      // Update site data
      if (!sites[domain]) {
        sites[domain] = {
          totalTime: 0,
          visits: 0,
          favicon: currentTab.favIconUrl,
          title: currentTab.title
        };
      }
      
      sites[domain].totalTime += timeSpent;
      sites[domain].visits += 1;
      sites[domain].lastVisit = now;
      
      // Update total time
      const totalTime = (result.totalTime || 0) + timeSpent;
      
      browserAPI.storage.local.set({
        sites: sites,
        totalTime: totalTime
      });
    });
  }
  
  currentTab.startTime = now;
}

// Periodic update via alarm
browserAPI.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    updateTimeForCurrentTab();
  }
});

// Handle system idle state changes
browserAPI.idle.onStateChanged.addListener((newState) => {
  if (newState === 'active') {
    // User is back, start tracking again
    isTracking = true;
    
    // Update current tab with new start time
    // Firefox uses promises, Chrome uses callbacks
    if (typeof browser !== 'undefined') {
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          if (tabs.length > 0) {
            handleTabChange(tabs[0]);
          }
        });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          handleTabChange(tabs[0]);
        }
      });
    }
  } else {
    // User is idle or locked, pause tracking
    updateTimeForCurrentTab();
    isTracking = false;
  }
});

// Set up idle detection
browserAPI.idle.setDetectionInterval(IDLE_THRESHOLD);

// Listen for windows focus change
browserAPI.windows.onFocusChanged.addListener((windowId) => {
  // Use appropriate constant for window ID based on browser
  const noneFocusedWindowId = typeof browser !== 'undefined' ? 
    browser.windows.WINDOW_ID_NONE : 
    chrome.windows.WINDOW_ID_NONE;

  if (windowId === noneFocusedWindowId) {
    // Window lost focus
    updateTimeForCurrentTab();
  } else {
    // Window gained focus
    // Firefox uses promises, Chrome uses callbacks
    if (typeof browser !== 'undefined') {
      browser.tabs.query({ active: true, currentWindow: true })
        .then(tabs => {
          if (tabs.length > 0) {
            handleTabChange(tabs[0]);
          }
        });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          handleTabChange(tabs[0]);
        }
      });
    }
  }
}); 