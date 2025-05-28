// Argus - Time tracking background service worker
import browserApiService from './services/BrowserApiService';
import authService from './services/AuthService';
import apiService from './services/ApiService';
import freeService from './services/FreeService';

// Constants
const ALARM_NAME = 'update-tracker';
const UPDATE_INTERVAL = 1; // minutes
const IDLE_THRESHOLD = 30; // seconds
const MAX_INACTIVE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
const TEMP_UNBLOCK_CHECK_ALARM = 'check-temp-unblocks';
const API_SYNC_ALARM = 'api-sync';
const API_SYNC_INTERVAL = 15; // minutes - how often to sync with API
const FREE_MODE_MAX_BLOCKED_SITES = 3;

// State
let currentTab = null;
let lastActiveTime = Date.now();
let lastUpdateTime = Date.now();
let isTracking = true;
let temporaryUnblocks = {}; // Domain -> expiration timestamp
let isAuthenticated = false;
let isFreeMode = false;
let lastSyncTime = 0;

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
  await browserApiService.clearAlarm(TEMP_UNBLOCK_CHECK_ALARM);
  await browserApiService.clearAlarm(API_SYNC_ALARM);
  
  // Create alarms
  browserApiService.createAlarm(ALARM_NAME, { 
    periodInMinutes: UPDATE_INTERVAL,
    delayInMinutes: 0.1 // Start quickly after initialization
  });
  
  browserApiService.createAlarm(TEMP_UNBLOCK_CHECK_ALARM, { 
    periodInMinutes: 1,
    delayInMinutes: 1
  });
  
  browserApiService.createAlarm(API_SYNC_ALARM, {
    periodInMinutes: API_SYNC_INTERVAL,
    delayInMinutes: 1
  });
  
  // Initialize storage if needed
  const result = await browserApiService.getStorage([
    'sites', 
    'totalTime', 
    'lastDate', 
    'blockingEnabled', 
    'blockedSites',
    'unblockData',
    'lastSyncTime',
    'freeMode'
  ]);
  
  // Initialize storage values if not set
  if (!result.sites) {
    await browserApiService.setStorage({
      sites: {},
      totalTime: 0,
      lastDate: new Date().toDateString()
    });
  }
  
  if (result.blockingEnabled === undefined) {
    await browserApiService.setStorage({
      blockingEnabled: false,
      blockedSites: []
    });
  }
  
  // Store last sync time if available
  if (result.lastSyncTime) {
    lastSyncTime = result.lastSyncTime;
  }
  
  // Load any temporary unblocks
  if (result.unblockData && result.unblockData.temporaryUnblocks) {
    temporaryUnblocks = result.unblockData.temporaryUnblocks;
  }
  
  // Check free mode status
  isFreeMode = result.freeMode === true;
  
  // Check and reset unblock count for new day
  await checkAndResetUnblockData();
  
  // Check if it's a new day and reset if needed
  await checkAndResetForNewDay(result.lastDate);
  
  // Check authentication status
  isAuthenticated = await authService.isAuthenticated();
  
  // Set up listeners and handlers
  browserApiService.addIdleStateListener(checkIdleState, IDLE_THRESHOLD);
  browserApiService.addAlarmListener(handleAlarm);
  browserApiService.addTabActivatedListener(handleTabActivated);
  browserApiService.addTabUpdatedListener(handleTabUpdated);
  browserApiService.addWebNavigationListener(handleWebNavigation);
  
  // Set up message listener
  browserApiService.addRuntimeMessageListener(async (message, sender, sendResponse) => {
    if (message.action === 'updateBlockedSites') {
      await updateBlockedSites();
      sendResponse({ success: true });
    } else if (message.action === 'updateTemporaryUnblocks') {
      await handleTemporaryUnblock(message.domain, message.expirationTime);
      sendResponse({ success: true });
    } else if (message.action === 'openBlocklistSettings') {
      const popup = await browserApiService.createTab(browserApiService.getExtensionUrl('popup.html'));
      // Add a small delay to make sure the popup is loaded
      setTimeout(() => {
        browserApiService.runtime.sendMessage({ 
          action: 'openSettingsTab'
        });
      }, 500);
      sendResponse({ success: true });
    } else if (message.action === 'syncWithApi') {
      await syncDataWithApi();
      sendResponse({ success: true });
    } else if (message.action === 'checkAuthentication') {
      isAuthenticated = await authService.isAuthenticated();
      sendResponse({ isAuthenticated });
    } else if (message.action === 'checkFreeMode') {
      isFreeMode = await freeService.isFreeMode();
      sendResponse({ isFreeMode });
    } else if (message.action === 'trackKeyAction') {
      const shouldShowAd = await freeService.trackKeyAction();
      sendResponse({ shouldShowAd });
    }
    return true; // Required for async sendResponse
  });
  
  // Start tracking the active tab
  await getCurrentActiveTab();
  
  // Do an initial sync with the API if authenticated
  if (isAuthenticated) {
    await syncDataWithApi();
  }
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
    const result = await browserApiService.getStorage(['sites', 'history', 'totalTime', 'freeMode']);
    
    const historicalData = result.history || {};
    const isFreeMode = result.freeMode === true;
    
    // Store yesterday's data in history
    historicalData[lastDate] = {
      sites: result.sites,
      totalTime: result.totalTime,
      date: lastDate
    };
    
    // For free mode, keep only 7 days of history
    // For premium users, keep 30 days
    const maxHistoryDays = isFreeMode ? 7 : 30;
    
    // Keep only the last X days of history
    const historyDates = Object.keys(historicalData).sort();
    if (historyDates.length > maxHistoryDays) {
      const toRemove = historyDates.slice(0, historyDates.length - maxHistoryDays);
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
      
      // If we're authenticated and it's been a while since our last sync, 
      // sync the data with the API
      if (isAuthenticated && (now - lastSyncTime > 5 * 60 * 1000)) { // Sync after 5 minutes
        syncDataWithApi();
      }
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

// Handle navigation events
async function handleWebNavigation(details) {
  // Only process main frame navigation to http/https
  if (details.frameId !== 0 || !details.url.startsWith('http')) {
    return;
  }
  
  try {
    // Check if blocking is enabled
    const { isEnabled, blockedSites } = await browserApiService.getBlockingStatus();
    
    if (!isEnabled || blockedSites.length === 0) {
      return;
    }
    
    // Parse the URL to get the domain
    const url = new URL(details.url);
    const domain = url.hostname;
    
    // Check if the domain is in the blocked list
    const isBlocked = blockedSites.some(blockedSite => {
      // Remove any www. prefix for comparison
      const cleanDomain = domain.replace(/^www\./, '');
      const cleanBlockedSite = blockedSite.replace(/^www\./, '');
      
      return cleanDomain === cleanBlockedSite || 
             cleanDomain.endsWith(`.${cleanBlockedSite}`);
    });
    
    if (isBlocked) {
      // Check if the site is temporarily unblocked
      if (isTemporarilyUnblocked(domain)) {
        console.log(`${domain} is temporarily unblocked`);
        return;
      }
      
      console.log(`Blocking navigation to ${domain}`);
      
      // Create the redirect URL to the blocked page
      const blockedPageUrl = browserApiService.getExtensionUrl('blocked.html') + 
                             `?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(details.url)}`;
      
      // Redirect to the blocked page
      await browserApiService.updateTab(details.tabId, blockedPageUrl);
    }
  } catch (error) {
    console.error('Error handling navigation:', error);
  }
}

// Check if a domain is temporarily unblocked
function isTemporarilyUnblocked(domain) {
  // Clean domain for comparison
  const cleanDomain = domain.replace(/^www\./, '');
  
  // Check each temporary unblock entry
  for (const [tempDomain, expirationTime] of Object.entries(temporaryUnblocks)) {
    const cleanTempDomain = tempDomain.replace(/^www\./, '');
    
    // Check if domains match and the unblock hasn't expired
    if ((cleanDomain === cleanTempDomain || cleanDomain.endsWith(`.${cleanTempDomain}`)) && 
        expirationTime > Date.now()) {
      return true;
    }
  }
  
  return false;
}

// Handle temporary unblock
async function handleTemporaryUnblock(domain, expirationTime) {
  // Update local state
  temporaryUnblocks[domain] = expirationTime;
  
  console.log(`Temporarily unblocked ${domain} until ${new Date(expirationTime).toLocaleTimeString()}`);
}

// Handle alarm events
function handleAlarm(alarm) {
  if (alarm.name === ALARM_NAME) {
    updateTracker();
  } else if (alarm.name === TEMP_UNBLOCK_CHECK_ALARM) {
    checkTemporaryUnblocks();
  } else if (alarm.name === API_SYNC_ALARM) {
    // Only sync if authenticated (not in free mode)
    if (isAuthenticated && !isFreeMode) {
      syncDataWithApi();
    }
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

// Update the blocked sites configuration
async function updateBlockedSites() {
  const result = await browserApiService.getStorage(['blockingEnabled', 'blockedSites', 'freeMode']);
  const blockingEnabled = result.blockingEnabled || false;
  const blockedSites = result.blockedSites || [];
  const isFreeMode = result.freeMode === true;
  
  // In free mode, limit the number of blocked sites
  if (isFreeMode && blockedSites.length > FREE_MODE_MAX_BLOCKED_SITES) {
    // Keep only the first few sites
    const limitedBlockedSites = blockedSites.slice(0, FREE_MODE_MAX_BLOCKED_SITES);
    await browserApiService.setStorage({ blockedSites: limitedBlockedSites });
  }
}

// Check and clean up expired temporary unblocks
async function checkTemporaryUnblocks() {
  const now = Date.now();
  let hasChanges = false;
  
  // Check each temporary unblock
  for (const domain in temporaryUnblocks) {
    if (temporaryUnblocks[domain] <= now) {
      console.log(`Temporary unblock for ${domain} has expired`);
      delete temporaryUnblocks[domain];
      hasChanges = true;
    }
  }
  
  // If we made changes, update the storage
  if (hasChanges) {
    const data = await browserApiService.getStorage(['unblockData']);
    
    if (data.unblockData) {
      data.unblockData.temporaryUnblocks = temporaryUnblocks;
      await browserApiService.setStorage({ unblockData: data.unblockData });
    }
  }
}

// Check and reset unblock data if it's a new day
async function checkAndResetUnblockData() {
  const data = await browserApiService.getStorage(['unblockData']);
  const today = new Date().toDateString();
  
  if (data.unblockData && data.unblockData.date !== today) {
    console.log('Resetting unblock data for new day');
    
    // Keep any valid temporary unblocks
    const validUnblocks = {};
    for (const [domain, expiry] of Object.entries(data.unblockData.temporaryUnblocks || {})) {
      if (expiry > Date.now()) {
        validUnblocks[domain] = expiry;
      }
    }
    
    const newUnblockData = {
      date: today,
      remaining: 3,
      temporaryUnblocks: validUnblocks
    };
    
    await browserApiService.setStorage({ unblockData: newUnblockData });
    temporaryUnblocks = validUnblocks;
  }
}

// Sync data with the API
async function syncDataWithApi() {
  // Only sync if authenticated
  if (!isAuthenticated) {
    isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      console.log('Not authenticated, skipping API sync');
      return;
    }
  }
  
  try {
    console.log('Syncing data with API...');
    
    // Get user data to get the userId
    const userData = await apiService.getUser();
    
    if (!userData) {
      throw new Error('User data not available');
    }
    
    // Get browser usage data
    const result = await browserApiService.getStorage(['sites', 'deviceId']);
    
    // Generate a device ID if not already stored
    let deviceId = result.deviceId;
    if (!deviceId) {
      deviceId = `argus_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await browserApiService.setStorage({ deviceId });
    }
    
    // Sync the data
    await apiService.syncBrowserUsage(userData.id, deviceId, { sites: result.sites || {} });
    
    // Update last sync time
    lastSyncTime = Date.now();
    await browserApiService.setStorage({ lastSyncTime });
    
    console.log('Data sync completed successfully');
  } catch (error) {
    console.error('API sync error:', error);
    
    // If we got an authentication error, clear the token
    if (error.message.includes('Authentication expired')) {
      isAuthenticated = false;
    }
  }
} 
