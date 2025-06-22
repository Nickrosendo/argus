// Argus - Time tracking background service worker
import browserApiService from "./services/BrowserApiService";
import authService from "./services/AuthService";
import apiService from "./services/ApiService";
import freeService from "./services/FreeService";

// Constants
const ALARM_NAME = "update-tracker";
const UPDATE_INTERVAL = 0.25; // 15 seconds for real-time tracking
const IDLE_THRESHOLD = 30; // seconds
const MAX_INACTIVE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
const TEMP_UNBLOCK_CHECK_ALARM = "check-temp-unblocks";
const API_SYNC_ALARM = "api-sync";
const API_SYNC_INTERVAL = 15; // minutes - how often to sync with API
const FREE_MODE_MAX_BLOCKED_SITES = 3;
const REAL_TIME_UPDATE_INTERVAL = 5000; // 5 seconds for very frequent updates

// State
let currentTab = null;
let lastActiveTime = Date.now();
let lastUpdateTime = Date.now();
let isTracking = true;
let temporaryUnblocks = {}; // Domain -> expiration timestamp
let isAuthenticated = false;
let isFreeMode = false;
let lastSyncTime = 0;
let realTimeUpdateTimer = null;
let updateCounter = 0; // Track number of updates for debugging

// // Initialize the extension
// browserApiService.addRuntimeInstalledListener(() => {
//   initializeExtension();
// });
//
// // For Firefox with Manifest V2, we need to initialize on startup
// if (typeof browser !== "undefined") {
//   initializeExtension();
// }

console.log("Argus background service worker starting up...");

async function initializeExtension() {
  console.log("Initializing Argus extension...");
  
  // Remove any existing alarms to prevent duplicates
  await browserApiService.clearAlarm(ALARM_NAME);
  await browserApiService.clearAlarm(TEMP_UNBLOCK_CHECK_ALARM);
  await browserApiService.clearAlarm(API_SYNC_ALARM);
  console.log("Cleared existing alarms");

  // Create alarms
  browserApiService.createAlarm(ALARM_NAME, {
    periodInMinutes: UPDATE_INTERVAL,
    delayInMinutes: 0.02, // Start very quickly after initialization (1.2 seconds)
  });

  browserApiService.createAlarm(TEMP_UNBLOCK_CHECK_ALARM, {
    periodInMinutes: 1,
    delayInMinutes: 1,
  });

  browserApiService.createAlarm(API_SYNC_ALARM, {
    periodInMinutes: API_SYNC_INTERVAL,
    delayInMinutes: 1,
  });

  console.log("Alarms created for periodic updates and checks");

  // Start real-time tracking
  startRealTimeTracking();

  console.log("Real-time tracking started");
  console.log("Initializing browser storage and state...");

  // Initialize storage if needed
  const result = await browserApiService.getStorage([
    "sites",
    "totalTime",
    "lastDate",
    "blockingEnabled",
    "blockedSites",
    "unblockData",
    "lastSyncTime",
    "freeMode",
  ]);

  console.log('Storage initialized with initial state:', result);

  // Initialize storage values if not set
  if (!result.sites) {
    await browserApiService.setStorage({
      sites: {},
      totalTime: 0,
      lastDate: new Date().toDateString(),
    });
  }

  if (result.blockingEnabled === undefined) {
    await browserApiService.setStorage({
      blockingEnabled: false,
      blockedSites: [],
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

  // Add window focus listeners to handle browser window switching
  browserApiService.addWindowFocusListener(handleWindowFocus);

  // Add web navigation listeners for blocking checks
  browserApiService.addWebNavigationListener(handleBeforeNavigate);
  /* browserApiService.addWebNavigationCommittedListener(handleNavigationCommitted */);

  // Get the current active tab immediately and start tracking
  await getCurrentActiveTab();
  
  // Ensure tracking starts immediately if user is active
  const idleState = await browserApiService.getIdleState();
  if (idleState === "active") {
    isTracking = true;
    lastActiveTime = Date.now();
  }

  // Set up message listener
  browserApiService.addRuntimeMessageListener(
    (message, sender, sendResponse) => {
      if (message.action === "updateBlockedSites") {
        updateBlockedSites()
          .then(() => {
            console.log("Blocked sites updated successfully");
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error("Error updating blocked sites:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "updateTemporaryUnblocks") {
        handleTemporaryUnblock(message.domain, message.expirationTime)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error("Error updating temporary unblocks:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "openBlocklistSettings") {
        browserApiService
          .createTab(browserApiService.getExtensionUrl("popup.html"))
          .then((popup) => {
            // Add a small delay to make sure the popup is loaded
            setTimeout(() => {
              browserApiService.runtime.sendMessage({
                action: "openSettingsTab",
              });
            }, 500);
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error("Error opening blocklist settings:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "syncWithApi") {
        syncDataWithApi()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error("Error syncing with api:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "checkAuthentication") {
        authService
          .isAuthenticated()
          .then((isAuthenticated) => {
            sendResponse({ success: true, isAuthenticated });
          })
          .catch((error) => {
            console.error("Error checking authentication:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "checkFreeMode") {
        freeService
          .isFreeMode()
          .then((isFreeMode) => {
            sendResponse({ success: true, isFreeMode });
          })
          .catch((error) => {
            console.error("Error checking free mode:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "trackKeyAction") {
        freeService
          .trackKeyAction()
          .then((shouldShowAd) => {
            sendResponse({ success: true, shouldShowAd });
          })
          .catch((error) => {
            console.error("Error tracking key action:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "getTrackingStatus") {
        // Return current tracking status for debugging
        const status = {
          isTracking,
          hasCurrentTab: !!currentTab,
          currentDomain: currentTab?.domain || null,
          hasRealTimeTimer: !!realTimeUpdateTimer,
          lastActiveTime: new Date(lastActiveTime).toLocaleTimeString(),
          isAuthenticated,
          isFreeMode
        };
        sendResponse({ success: true, status });
      } else if (message.action === "checkUrlBlocked") {
        // Check if a specific URL is blocked
        isUrlBlocked(message.url)
          .then((isBlocked) => {
            sendResponse({ success: true, isBlocked });
          })
          .catch((error) => {
            console.error("Error checking URL blocked status:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "getBlockedAttempts") {
        // Get blocked attempts for analytics
        browserApiService.getStorage(['blockedAttempts'])
          .then((result) => {
            sendResponse({ success: true, blockedAttempts: result.blockedAttempts || {} });
          })
          .catch((error) => {
            console.error("Error getting blocked attempts:", error);
            sendResponse({ success: false, error: error.message });
          });
      } else if (message.action === "signin") {
        try {
          const { username, password } = message;
          authService
            .signin(username, password)
            .then(async (response) => {
              // Update authentication state
              isAuthenticated = true;
              isFreeMode = response.type === "free";

              // Store user info in browser storage
              await browserApiService.setStorage({
                authToken: response.accessToken,
                userInfo: {
                  id: response.user.id,
                  email: response.user.email,
                  name: response.user.name || response.user.username,
                },
                freeMode: false,
              });

              // Start API sync
              await syncDataWithApi();

              sendResponse({
                success: true,
                data: {
                  token: response.accessToken,
                  user: {
                    id: response.user.id,
                    email: response.user.email,
                    name: response.user.name || response.user.username,
                  },
                },
              });
            })
            .catch((error) => {
              console.error("Error on signin:", error);
              sendResponse({ success: false, error: error.message });
            });
        } catch (error) {
          console.error("Signin error:", error);
          sendResponse({
            success: false,
            error: error.message || "Failed to sign in",
          });
        }
      } else if (message.action === "signup") {
        try {
          const { username, password, email } = message;
          authService
            .signup(username, password, email)
            .then(async (response) => {
              // Update authentication state
              isAuthenticated = true;
              isFreeMode = response.type === "free";

              // Store user info in browser storage
              await browserApiService.setStorage({
                authToken: response.accessToken,
                userInfo: {
                  id: response.user.id,
                  email: response.user.email,
                  name: response.user.name || response.user.username,
                },
                freeMode: isFreeMode,
              });

              // Start API sync
              await syncDataWithApi();

              return sendResponse({
                success: true,
                data: {
                  token: response.accessToken,
                  user: {
                    id: response.user.id,
                    email: response.user.email,
                    name: response.user.name || response.user.username,
                  },
                },
              });
            })
            .catch((error) => {
              console.error("Error on signup:", error);
              sendResponse({ success: false, error: error.message });
            });
        } catch (error) {
          console.error("Signup error:", error);
          sendResponse({
            success: false,
            error: error.message || "Failed to sign up",
          });
        }
      } else if (message.action === "signout") {
        try {
          authService
            .signout()
            .then(async () => {
              // Update authentication state
              isAuthenticated = false;
              isFreeMode = true;

              // Clear user info from browser storage
              await browserApiService.setStorage({
                authToken: null,
                userInfo: null,
                freeMode: true,
              });

              sendResponse({ success: true });
            })
            .catch((error) => {
              console.error("Error on signout:", error);
              sendResponse({ success: false, error: error.message });
            });
        } catch (error) {
          console.error("Signout error:", error);
          sendResponse({
            success: false,
            error: error.message || "Failed to sign out",
          });
        }
      }
      return true; // Required for async sendResponse
    }
  );

  // Do an initial sync with the API if authenticated
  if (isAuthenticated) {
    await syncDataWithApi();
  }

  // Initialize network blocking rules
  console.log("Initializing network blocking rules...");
  await updateBlockedSites();

  // Initialize website blocking listeners
  console.log("Website blocking system initialized successfully");
}
initializeExtension()

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
    const result = await browserApiService.getStorage([
      "sites",
      "history",
      "totalTime",
      "freeMode",
    ]);

    const historicalData = result.history || {};
    const isFreeMode = result.freeMode === true;

    // Store yesterday's data in history
    historicalData[lastDate] = {
      sites: result.sites,
      totalTime: result.totalTime,
      date: lastDate,
    };

    // For free mode, keep only 7 days of history
    // For premium users, keep 30 days
    const maxHistoryDays = isFreeMode ? 7 : 30;

    // Keep only the last X days of history
    const historyDates = Object.keys(historicalData).sort();
    if (historyDates.length > maxHistoryDays) {
      const toRemove = historyDates.slice(
        0,
        historyDates.length - maxHistoryDays
      );
      toRemove.forEach((date) => delete historicalData[date]);
    }

    // Reset today's data and update history
    await browserApiService.setStorage({
      sites: {},
      totalTime: 0,
      lastDate: today,
      history: historicalData,
    });
  } else if (!lastDate) {
    await browserApiService.setStorage({ lastDate: today });
  }
}

// Handle tab activated event
async function handleTabActivated(activeInfo) {
  if (!isTracking) return;

  // Immediately update time for previous tab
  await updateTimeForCurrentTab();

  try {
    const tab = await browserApiService.getTabById(activeInfo.tabId);
    if (tab) {
      handleTabChange(tab);
      // Ensure real-time tracking is active
      if (!realTimeUpdateTimer) {
        startRealTimeTracking();
      }
    }
  } catch (error) {
    console.error("Error handling tab activation:", error);
  }
}

// Handle tab updated event
async function handleTabUpdated(tabId, changeInfo, tab) {
  if (!isTracking || !tab.active) return;

  // Check for URL changes and potential blocking
  if (changeInfo.url) {
    // Check if the new URL should be blocked
    // try {
    //   const shouldBlock = await isUrlBlocked(changeInfo.url);
    //   if (shouldBlock) {
    //     console.log(`Blocking URL change to ${changeInfo.url} in tab ${tabId}`);
    //     await redirectToBlockedPage(tabId, changeInfo.url);
    //     await trackBlockedAttempt(changeInfo.url);
    //     return; // Don't continue with normal tab handling
    //   }
    // } catch (error) {
      // console.error("Error checking URL in tab update:", error);
    // }

    // Immediately update time for previous tab
    await updateTimeForCurrentTab();
    handleTabChange(tab);
    
    // Ensure real-time tracking is active
    if (!realTimeUpdateTimer) {
      startRealTimeTracking();
    }
  }
}

// Handle when a tab becomes the active tab
function handleTabChange(tab) {
  if (
    !tab ||
    !tab.url ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("about:")
  ) {
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
      startTime: Date.now(),
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
  const validTimeSpent =
    timeSpent > 0 && timeSpent < MAX_INACTIVE_TIME ? timeSpent : 0;

  if (validTimeSpent > 500) {
    // Reduced threshold to 0.5 seconds for more real-time tracking
    try {
      const result = await browserApiService.getStorage(["sites", "totalTime"]);

      if (!currentTab) return;
      const sites = result.sites || {};
      const domain = currentTab.domain;

      // Update site data
      if (!sites[domain]) {
        sites[domain] = {
          totalTime: 0,
          visits: 0,
          favicon: currentTab.favIconUrl,
          title: currentTab.title,
        };
      }

      sites[domain].totalTime += validTimeSpent;
      sites[domain].visits += 1;
      sites[domain].lastVisit = now;

      // Update total time
      const totalTime = (result.totalTime || 0) + validTimeSpent;

      await browserApiService.setStorage({
        sites: sites,
        totalTime: totalTime,
      });

      // Log the update for debugging real-time tracking (every 10th update or significant time)
      updateCounter++;
      if (updateCounter % 10 === 0 || validTimeSpent > 10000) {
        console.log(`Update #${updateCounter} - ${domain}: +${Math.round(validTimeSpent/1000)}s (Total: ${Math.round(sites[domain].totalTime/1000)}s)`);
      }

      // If we're authenticated and it's been a while since our last sync,
      if (isAuthenticated && now - lastSyncTime > 5 * 60 * 1000) {
        // Sync after 5 minutes
        syncDataWithApi();
      }
    } catch (error) {
      console.error("Error updating time:", error);
    }
  }
}

// Check if the user is idle and pause tracking if needed
async function checkIdleState(state) {
  if (state === "active") {
    // User returned to active state
    if (!isTracking) {
      console.log("User is active again, resuming tracking");
      isTracking = true;
      lastActiveTime = Date.now();

      // Reset the current tab's start time to now to avoid counting idle time
      if (currentTab) {
        currentTab.startTime = Date.now();
      } else {
        // If we don't have a current tab, try to get the active tab
        await getCurrentActiveTab();
      }
      
      // Restart real-time tracking
      startRealTimeTracking();
    }
  } else if (state === "idle" || state === "locked") {
    // User is idle or screen is locked
    if (isTracking) {
      console.log("User is idle or screen is locked, pausing tracking");
      isTracking = false;

      // Update time spent before pausing
      await updateTimeForCurrentTab();
      
      // Stop real-time tracking to save resources
      stopRealTimeTracking();
    }
  }
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

    if (idleState === "active") {
      // If we're active, update the time for the current tab
      lastActiveTime = Date.now();
      updateTimeForCurrentTab();
    } else {
      // If we're idle, pause tracking
      isTracking = false;
      console.log("Browser is idle, pausing tracking");
    }
  }
}

// Update the blocked sites configuration
async function updateBlockedSites() {
  const result = await browserApiService.getStorage([
    "blockingEnabled",
    "blockedSites",
    "freeMode",
  ]);
  const blockingEnabled = result.blockingEnabled || false;
  let blockedSites = result.blockedSites || [];
  const isFreeMode = result.freeMode === true;

  // In free mode, limit the number of blocked sites
  if (isFreeMode && blockedSites.length > FREE_MODE_MAX_BLOCKED_SITES) {
    // Keep only the first few sites
    blockedSites = blockedSites.slice(0, FREE_MODE_MAX_BLOCKED_SITES);
    await browserApiService.setStorage({ blockedSites });
  }

  // Filter out temporarily unblocked sites for the network rules
  const currentlyBlockedSites = blockedSites.filter(site => !isTemporarilyUnblocked(site));

  // Update the actual network blocking rules
  console.log(`Updating network blocking rules: ${blockingEnabled ? 'enabled' : 'disabled'}, blocking ${currentlyBlockedSites.length} sites`);
  await browserApiService.updateBlockedSites(currentlyBlockedSites, blockingEnabled);
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

  // If we made changes, update the storage and blocking rules
  if (hasChanges) {
    const data = await browserApiService.getStorage(["unblockData"]);

    if (data.unblockData) {
      data.unblockData.temporaryUnblocks = temporaryUnblocks;
      await browserApiService.setStorage({ unblockData: data.unblockData });
    }

    // Update the network blocking rules to re-block expired temporary unblocks
    await updateBlockedSites();
  }
}

// Check and reset unblock data if it's a new day
async function checkAndResetUnblockData() {
  const data = await browserApiService.getStorage(["unblockData"]);
  const today = new Date().toDateString();

  if (data.unblockData && data.unblockData.date !== today) {
    console.log("Resetting unblock data for new day");

    // Keep any valid temporary unblocks
    const validUnblocks = {};
    for (const [domain, expiry] of Object.entries(
      data.unblockData.temporaryUnblocks || {}
    )) {
      if (expiry > Date.now()) {
        validUnblocks[domain] = expiry;
      }
    }

    const newUnblockData = {
      date: today,
      remaining: 3,
      temporaryUnblocks: validUnblocks,
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
      console.log("Not authenticated, skipping API sync");
      return;
    }
  }

  try {
    console.log("Syncing data with API...");

    // Get user data to get the userId
    const userData = await apiService.getUser();

    if (!userData) {
      throw new Error("User data not available");
    }

    // Get browser usage data
    const result = await browserApiService.getStorage(["sites", "deviceId"]);

    // Generate a device ID if not already stored
    let deviceId = result.deviceId;
    if (!deviceId) {
      deviceId = `argus_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await browserApiService.setStorage({ deviceId });
    }

    // Sync the data
    await apiService.syncBrowserUsage(userData.id, deviceId, {
      sites: result.sites || {},
    });

    // Update last sync time
    lastSyncTime = Date.now();
    await browserApiService.setStorage({ lastSyncTime });

    console.log("Data sync completed successfully");
  } catch (error) {
    console.error("API sync error:", error);

    // If we got an authentication error, clear the token
    if (error.message.includes("Authentication expired")) {
      isAuthenticated = false;
    }
  }
}

// Start real-time tracking with frequent updates
function startRealTimeTracking() {
  // Clear any existing timer
  if (realTimeUpdateTimer) {
    clearInterval(realTimeUpdateTimer);
  }
  
  console.log("Starting real-time tracking with 5-second intervals");
  
  // Set up real-time updates every 5 seconds when tracking is active
  realTimeUpdateTimer = setInterval(async () => {
    if (isTracking && currentTab) {
      // Only update if we have a current tab and we're actively tracking
      const idleState = await browserApiService.getIdleState();
      if (idleState === "active") {
        await updateTimeForCurrentTab();
        // Reset the current tab's start time to continue tracking from now
        if (currentTab) {
          currentTab.startTime = Date.now();
        }
      } else {
        // If user becomes idle during real-time tracking, handle it
        console.log("User became idle during real-time tracking, pausing");
        isTracking = false;
        stopRealTimeTracking();
      }
    } else if (!currentTab && isTracking) {
      // Try to get current tab if we lost track of it
      console.log("Lost track of current tab, attempting to recover");
      await getCurrentActiveTab();
    }
  }, REAL_TIME_UPDATE_INTERVAL);
}

// Stop real-time tracking
function stopRealTimeTracking() {
  if (realTimeUpdateTimer) {
    console.log("Stopping real-time tracking");
    clearInterval(realTimeUpdateTimer);
    realTimeUpdateTimer = null;
  }
}

// Add window focus listeners to handle browser window switching
async function handleWindowFocus(focused) {
  if (focused) {
    console.log("Browser window is focused, ensuring real-time tracking");
    if (!isTracking) {
      isTracking = true;
      lastActiveTime = Date.now();
    }
    await getCurrentActiveTab();
    
    // Ensure real-time tracking is active
    if (!realTimeUpdateTimer) {
      startRealTimeTracking();
    }
  } else {
    console.log("Browser window lost focus, reducing tracking frequency");
    // Don't stop tracking completely, just reduce frequency
    // The real-time updates will be paused but basic tracking continues
    await updateTimeForCurrentTab();
    stopRealTimeTracking();
  }
}

// Check if a domain is temporarily unblocked
function isTemporarilyUnblocked(domain) {
  // Clean domain for comparison
  const cleanDomain = domain.replace(/^www\./, "");

  // Check each temporary unblock entry
  for (const [tempDomain, expirationTime] of Object.entries(
    temporaryUnblocks
  )) {
    const cleanTempDomain = tempDomain.replace(/^www\./, "");

    // Check if domains match and the unblock hasn't expired
    if (
      (cleanDomain === cleanTempDomain ||
        cleanDomain.endsWith(`.${cleanTempDomain}`)) &&
      expirationTime > Date.now()
    ) {
      return true;
    }
  }

  return false;
}

// Handle temporary unblock
async function handleTemporaryUnblock(domain, expirationTime) {
  // Update local state
  temporaryUnblocks[domain] = expirationTime;

  console.log(
    `Temporarily unblocked ${domain} until ${new Date(expirationTime).toLocaleTimeString()}`
  );

  // Update the network blocking rules immediately to reflect the temporary unblock
  await updateBlockedSites();
}

// Handle website navigation for blocking checks
async function handleBeforeNavigate(details) {
  console.log('Handling before navigate for URL:', details);
  // Only handle main frame navigation (not iframes, images, etc.)
  if (details.frameId !== 0) return;
  
  try {
    const shouldBlock = await isUrlBlocked(details.url);
    console.log('should block: ', shouldBlock);
    if (shouldBlock) {
      console.log(`Blocking navigation to ${details.url}`);
      // The declarativeNetRequest rules should handle the redirect
      // But we can also track the block attempt
      await trackBlockedAttempt(details.url);
    }
  } catch (error) {
    console.error("Error checking blocked URL:", error);
  }
}

async function handleNavigationCommitted(details) {
  console.log('Handling committed navigation for URL:', details);
  // Only handle main frame navigation (not iframes, images, etc.)
  if (details.frameId !== 0) return;
  
  try {
    // Double-check for any navigation that might have bypassed declarativeNetRequest
    const shouldBlock = await isUrlBlocked(details.url);
    console.log('should block committed navigation: ', shouldBlock);
    if (shouldBlock) {
      console.log(`Blocking committed navigation to ${details.url}`);
      // Redirect to blocked page
      await redirectToBlockedPage(details.tabId, details.url);
    }
  } catch (error) {
    console.error("Error checking committed navigation:", error);
  }
}

// Check if a URL should be blocked
async function isUrlBlocked(url) {
  try {
    // Skip extension URLs and special URLs
    if (url.startsWith('chrome://') || 
        url.startsWith('chrome-extension://') || 
        url.startsWith('moz-extension://') || 
        url.startsWith('about:') ||
        url.startsWith('edge://') ||
        url.startsWith('safari-extension://')) {
      return false;
    }

    // Get blocking configuration
    const result = await browserApiService.getStorage([
      'blockingEnabled',
      'blockedSites',
      'freeMode'
    ]);

    console.log('Checking if URL is blocked:', url);
    console.log('Storage result for blocking:', result);
    
    const blockingEnabled = result.blockingEnabled || false;
    const blockedSites = result.blockedSites || [];
    const isFreeMode = result.freeMode === true;

    // If blocking is not enabled, don't block anything
    if (!blockingEnabled || blockedSites.length === 0) {
      return false;
    }

    // Parse the URL to get the domain
    let domain;
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.toLowerCase();
    } catch (error) {
      console.error("Invalid URL:", url);
      return false;
    }
    console.log(`Checking domain ${domain} against blocked sites`);

    console.log(`Blocked sites: ${blockedSites}`);
    // Check if the domain is in the blocked list
    for (const blockedSite of blockedSites) {
      const cleanBlockedSite = blockedSite.replace(/^www\./, '').toLowerCase();
      const cleanDomain = domain.replace(/^www\./, '');

      // Check exact match or subdomain match
      if (cleanDomain === cleanBlockedSite || 
          cleanDomain.endsWith(`.${cleanBlockedSite}`)) {
        
        // Check if it's temporarily unblocked
        if (isTemporarilyUnblocked(cleanBlockedSite)) {
          console.log(`Site ${cleanBlockedSite} is temporarily unblocked`);
          return false;
        }

        // In free mode, apply additional restrictions if needed
        if (isFreeMode) {
          // For now, free mode users can block sites same as premium
          // but we could add additional logic here
        }

        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking if URL is blocked:", error);
    return false;
  }
}

// Track blocked attempts for analytics/debugging
async function trackBlockedAttempt(url) {
  try {
    const result = await browserApiService.getStorage(['blockedAttempts']);
    const blockedAttempts = result.blockedAttempts || {};
    
    const domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const today = new Date().toDateString();
    
    if (!blockedAttempts[today]) {
      blockedAttempts[today] = {};
    }
    
    blockedAttempts[today][domain] = (blockedAttempts[today][domain] || 0) + 1;
    
    // Keep only last 7 days of blocked attempts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    Object.keys(blockedAttempts).forEach(date => {
      if (new Date(date) < sevenDaysAgo) {
        delete blockedAttempts[date];
      }
    });
    
    await browserApiService.setStorage({ blockedAttempts });
    
    console.log(`Blocked attempt recorded for ${domain}`);
  } catch (error) {
    console.error("Error tracking blocked attempt:", error);
  }
}

// Redirect to blocked page (fallback for cases where declarativeNetRequest doesn't work)
async function redirectToBlockedPage(tabId, url) {
  try {
    const domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const blockedPageUrl = browserApiService.getExtensionUrl(`blocked.html?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(url)}`);
    
    await browserApiService.updateTab(tabId, blockedPageUrl);
    console.log(`Redirected tab ${tabId} to blocked page for ${domain}`);
  } catch (error) {
    console.error("Error redirecting to blocked page:", error);
  }
}
