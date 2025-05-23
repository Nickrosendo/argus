// Argus - Time tracking background service worker
const { default: browserApiService } = require('./services/BrowserApiService.js');

// Constants
const ALARM_NAME = 'update-tracker';
const UPDATE_INTERVAL = 1; // minutes
const IDLE_THRESHOLD = 30; // seconds
const MAX_INACTIVE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

// State
let currentTab = null;
let lastActiveTime = Date.now();
let lastUpdateTime = Date.now();
let isTracking = true;

// Initialize the extension
browserApiService.addRuntimeInstalledListener(() => {
  initializeExtension();
});

// For Firefox with Manifest V2, we need to initialize on startup
if (typeof browser !== 'undefined') {
  initializeExtension();
}

async function initializeExtension() {
  // Remove any existing alarms to prevent duplicates
  await browserApiService.clearAlarm(ALARM_NAME);
  
  // Create a fresh alarm
  browserApiService.createAlarm(ALARM_NAME, { 
    periodInMinutes: UPDATE_INTERVAL,
    delayInMinutes: 0.1 // Start quickly after initialization
  });
  
  // Initialize storage if needed
  const result = await browserApiService.getStorage(['sites', 'totalTime', 'lastDate']);
  
  if (!result.sites) {
    await browserApiService.setStorage({
      sites: {},
      totalTime: 0,
      lastDate: new Date().toDateString()
    });
  }
  
  // Check if it's a new day and reset if needed
  await checkAndResetForNewDay(result.lastDate);
  
  // Set up idle detection
  browserApiService.addIdleStateListener(checkIdleState, IDLE_THRESHOLD);
  
  // Add alarm listener for periodic updates
  browserApiService.addAlarmListener(handleAlarm);
  
  // Add tab listeners
  browserApiService.addTabActivatedListener(handleTabActivated);
  browserApiService.addTabUpdatedListener(handleTabUpdated);
  
  // Ensure we start tracking the active tab
  await getCurrentActiveTab();
}

// Get the current active tab to initialize or recover tracking
async function getCurrentActiveTab() {
  try {
    const tab = await browserApiService.getActiveTab();
    if (tab) {
      handleTabChange(tab);
    }
  } catch (error) {
    console.error("Error querying active tab:", error);
  }
}

// Check for new day and reset stats if needed
async function checkAndResetForNewDay(lastDate) {
  const today = new Date().toDateString();
  
  if (lastDate && lastDate !== today) {
    // Archive yesterday's data if needed
    const result = await browserApiService.getStorage(['sites', 'history', 'totalTime']);
    
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
    await browserApiService.setStorage({
      sites: {},
      totalTime: 0,
      lastDate: today,
      history: historicalData
    });
  } else if (!lastDate) {
    await browserApiService.setStorage({ lastDate: today });
  }
}

// Handle tab activated event
async function handleTabActivated(activeInfo) {
  if (!isTracking) return;
  
  updateTimeForCurrentTab();

  try {
    const tab = await browserApiService.getTabById(activeInfo.tabId);
    if (tab) {
      handleTabChange(tab);
    }
  } catch (error) {
    console.error("Error handling tab activation:", error);
  }
}

// Handle tab updated event
function handleTabUpdated(tabId, changeInfo, tab) {
  if (!isTracking || !changeInfo.url || !tab.active) return;
  
  updateTimeForCurrentTab();
  handleTabChange(tab);
}

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
    lastUpdateTime = Date.now();
  } catch (error) {
    console.error("Error processing URL:", error);
    currentTab = null;
  }
}

// Update time for the current tab before switching
async function updateTimeForCurrentTab() {
  if (!currentTab) return;
  
  const now = Date.now();
  const timeSpent = now - currentTab.startTime;
  
  // Verify the time spent is reasonable (less than MAX_INACTIVE_TIME)
  // This prevents unrealistic time increments if the browser was suspended
  const validTimeSpent = timeSpent > 0 && timeSpent < MAX_INACTIVE_TIME ? timeSpent : 0;
  
  if (validTimeSpent > 1000) { // Only log if more than 1 second was spent
    try {
      const result = await browserApiService.getStorage(['sites', 'totalTime']);
      
      if (!currentTab) return;
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
      
      sites[domain].totalTime += validTimeSpent;
      sites[domain].visits += 1;
      sites[domain].lastVisit = now;
      
      // Update total time
      const totalTime = (result.totalTime || 0) + validTimeSpent;
      
      await browserApiService.setStorage({
        sites: sites,
        totalTime: totalTime
      });
    } catch (error) {
      console.error("Error updating time:", error);
    }
  }
}

// Check if the user is idle and pause tracking if needed
async function checkIdleState(state) {
  if (state === 'active') {
    // User returned to active state
    if (!isTracking) {
      console.log('User is active again, resuming tracking');
      isTracking = true;
      lastActiveTime = Date.now();
      
      // Reset the current tab's start time to now to avoid counting idle time
      if (currentTab) {
        currentTab.startTime = Date.now();
      } else {
        // If we don't have a current tab, try to get the active tab
        await getCurrentActiveTab();
      }
    }
  } else if (state === 'idle' || state === 'locked') {
    // User is idle or screen is locked
    if (isTracking) {
      console.log('User is idle or screen is locked, pausing tracking');
      isTracking = false;
      
      // Update time spent before pausing
      updateTimeForCurrentTab();
    }
  }
}

// Handle alarm events for periodic updates
function handleAlarm(alarm) {
  if (alarm.name === ALARM_NAME) {
    updateTracker();
  }
}

// Update the tracker periodically
async function updateTracker() {
  // If we're tracking and the user has been active recently, update the time
  if (isTracking) {
    // Check if browser is in idle state
    const idleState = await browserApiService.getIdleState();
    
    if (idleState === 'active') {
      // If we're active, update the time for the current tab
      lastActiveTime = Date.now();
      updateTimeForCurrentTab();
    } else {
      // If we're idle, pause tracking
      isTracking = false;
      console.log('Browser is idle, pausing tracking');
    }
  }
} 
