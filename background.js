// Argus - Time tracking background service worker

// Constants
const ALARM_NAME = 'update-tracker';
const UPDATE_INTERVAL = 1; // minutes
const IDLE_THRESHOLD = 30; // seconds

// State
let currentTab = null;
let lastActiveTime = Date.now();
let isTracking = true;

// Initialize the extension
chrome.runtime.onInstalled.addListener(() => {
  // Setup update alarm
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: UPDATE_INTERVAL });
  
  // Initialize storage if needed
  chrome.storage.local.get(['sites', 'totalTime', 'lastDate'], (result) => {
    if (!result.sites) {
      chrome.storage.local.set({
        sites: {},
        totalTime: 0,
        lastDate: new Date().toDateString()
      });
    }
    
    // Check if it's a new day and reset if needed
    checkAndResetForNewDay(result.lastDate);
  });
});

// Check for new day and reset stats if needed
function checkAndResetForNewDay(lastDate) {
  const today = new Date().toDateString();
  
  if (lastDate && lastDate !== today) {
    // Archive yesterday's data if needed
    chrome.storage.local.get(['sites', 'history'], (result) => {
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
      chrome.storage.local.set({
        sites: {},
        totalTime: 0,
        lastDate: today,
        history: historicalData
      });
    });
  } else if (!lastDate) {
    chrome.storage.local.set({ lastDate: today });
  }
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!isTracking) return;
  
  try {
    updateTimeForCurrentTab();
    const tab = await chrome.tabs.get(activeInfo.tabId);
    handleTabChange(tab);
  } catch (error) {
    console.error("Error handling tab activation:", error);
  }
});

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isTracking || !changeInfo.url || !tab.active) return;
  
  updateTimeForCurrentTab();
  handleTabChange(tab);
});

// Handle when a tab becomes the active tab
function handleTabChange(tab) {
  if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
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
    chrome.storage.local.get(['sites', 'totalTime'], (result) => {
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
      
      chrome.storage.local.set({
        sites: sites,
        totalTime: totalTime
      });
    });
  }
  
  currentTab.startTime = now;
}

// Periodic update via alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    updateTimeForCurrentTab();
  }
});

// Handle system idle state changes
chrome.idle.onStateChanged.addListener((newState) => {
  if (newState === 'active') {
    // User is back, start tracking again
    isTracking = true;
    
    // Update current tab with new start time
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        handleTabChange(tabs[0]);
      }
    });
  } else {
    // User is idle or locked, pause tracking
    updateTimeForCurrentTab();
    isTracking = false;
  }
});

// Set up idle detection
chrome.idle.setDetectionInterval(IDLE_THRESHOLD);

// Listen for windows focus change
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus
    updateTimeForCurrentTab();
  } else {
    // Window gained focus
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        handleTabChange(tabs[0]);
      }
    });
  }
}); 