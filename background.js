// This file will be moved to src/background.ts

// Argus - Time tracking background service worker
import browserApiService from "./services/BrowserApiService";
import authService from "./services/AuthService";
import apiService from "./services/ApiService";
import freeService from "./services/FreeService";
import { SocialAuthService } from './services/SocialAuthService.js';
import { claimElapsedTime, pruneHistory } from './services/trackingUtils.js';

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
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

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
let storageWriteQueue = Promise.resolve(); // Serializes read-modify-write of tracking data

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Define domain scoring
const domainScores = {
  // Work/Productivity
  'github.com': 9,
  'stackoverflow.com': 9,
  'docs.google.com': 8,
  'drive.google.com': 8,
  'notion.so': 8,
  'slack.com': 7,
  'trello.com': 7,
  'asana.com': 7,
  'monday.com': 7,
  'clickup.com': 7,
  'zoom.us': 6,
  'teams.microsoft.com': 6,
  'meet.google.com': 6,
  
  // Education/Learning
  'coursera.org': 9,
  'udemy.com': 9,
  'khanacademy.org': 9,
  'edx.org': 9,
  'codecademy.com': 9,
  'freecodecamp.org': 9,
  'w3schools.com': 8,
  'mdn.mozilla.org': 8,
  'tutorialspoint.com': 7,
  
  // Social Media (Lower scores = more distracting)
  'facebook.com': 2,
  'instagram.com': 2,
  'twitter.com': 3,
  'tiktok.com': 1,
  'reddit.com': 4,
  'linkedin.com': 6,
  'pinterest.com': 3,
  'snapchat.com': 2,
  
  // Entertainment
  'youtube.com': 3,
  'netflix.com': 2,
  'twitch.tv': 2,
  'hulu.com': 2,
  'spotify.com': 5,
  'amazon.com': 5, // Can be work or entertainment
  
  // News/Information
  'news.google.com': 7,
  'bbc.com': 7,
  'cnn.com': 6,
  'reuters.com': 7,
  'wikipedia.org': 8,
  
  // Default for unknown domains
  'default': 5
};

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
  
  // Create the periodic alarms only if they are missing. Alarms survive
  // service worker restarts, and recreating them would reset their schedule.
  await ensureAlarm(ALARM_NAME, {
    periodInMinutes: UPDATE_INTERVAL,
    delayInMinutes: 0.02, // Start very quickly after initialization (1.2 seconds)
  });

  await ensureAlarm(TEMP_UNBLOCK_CHECK_ALARM, {
    periodInMinutes: 1,
    delayInMinutes: 1,
  });

  await ensureAlarm(API_SYNC_ALARM, {
    periodInMinutes: API_SYNC_INTERVAL,
    delayInMinutes: 1,
  });

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

  // Get the current active tab immediately and start tracking
  await getCurrentActiveTab();
  
  // Ensure tracking starts immediately if user is active
  const idleState = await browserApiService.getIdleState();
  if (idleState === "active") {
    isTracking = true;
    lastActiveTime = Date.now();
  }

  // Initialize network blocking rules
  console.log("Initializing network blocking rules...");
  await updateBlockedSites();

  // Start real-time tracking once state is loaded
  startRealTimeTracking();

  console.log("Argus background initialized");
}

// Create an alarm unless one with this name already exists
async function ensureAlarm(name, alarmInfo) {
  const existing = await browserAPI.alarms.get(name);
  if (!existing) {
    browserApiService.createAlarm(name, alarmInfo);
  }
}

// The id of the focused browser window, or null when the browser is not focused
async function getFocusedWindowId() {
  try {
    const win = await browserAPI.windows.getLastFocused();
    return win && win.focused ? win.id : null;
  } catch (error) {
    console.error("Error querying focused window:", error);
    return null;
  }
}

// Handle messages from the popup, blocked page and content scripts
function handleCoreMessage(message, sender, sendResponse) {
  if (message.action === "updateBlockedSites") {
    updateBlockedSites()
      .then(() => {
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
    // Check if this is a manual sync request (user-initiated)
    const isManualSync = message.manual === true;
    
    syncDataWithApi(isManualSync)
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
              username: response.user.username,
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
              username: response.user.username,
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
  } else if (message.action === "socialAuth") {
    try {
      const { provider } = message;
      console.log(`Starting ${provider} social authentication...`);
      
      SocialAuthService.loginWithProvider(provider)
        .then(async (socialResponse) => {
          console.log(`${provider} auth successful`);
          
          // Call our API with the social auth data
          const response = await fetch(`${authService.API_BASE_URL}/auth/social`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: socialResponse.provider,
              providerId: socialResponse.user.id,
              accessToken: socialResponse.authToken,
              email: socialResponse.user.email,
              name: socialResponse.user.name,
              picture: socialResponse.user.picture
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `${provider} authentication failed`);
          }

          const backendResponse = await response.json();
          
          // Update authentication state
          isAuthenticated = true;
          
          // Check subscription status to determine if user is premium
          let isPremium = false;
          let updatedUserInfo = {
            id: backendResponse.user.id,
            email: backendResponse.user.email,
            name: backendResponse.user.name,
            picture: backendResponse.user.picture,
            username: backendResponse.user.username,
          };
          
          try {
            const subscriptionData = await freeService.checkSubscriptionStatus(backendResponse.accessToken);
            isPremium = subscriptionData.userType === 'premium';
            
            // Update user info with subscription data
            updatedUserInfo = {
              ...updatedUserInfo,
              type: subscriptionData.userType,
              subscriptionStatus: subscriptionData.subscriptionStatus
            };
            
            console.log("Social auth subscription check result:", subscriptionData);
          } catch (error) {
            console.error("Failed to check subscription status during social auth:", error);
            // Default to free mode if subscription check fails
            updatedUserInfo = {
              ...updatedUserInfo,
              type: 'free'
            };
          }
          
          isFreeMode = !isPremium;

          // Store user info in browser storage
          await browserApiService.setStorage({
            authToken: backendResponse.accessToken,
            userInfo: updatedUserInfo,
            freeMode: !isPremium,
          });

          // Start API sync
          await syncDataWithApi();

          sendResponse({
            success: true,
            data: {
              token: backendResponse.accessToken,
              user: updatedUserInfo,
            },
          });
        })
        .catch((error) => {
          console.error(`${provider} authentication error:`, error);
          sendResponse({ 
            success: false, 
            error: error.message || `${provider} authentication failed` 
          });
        });
    } catch (error) {
      console.error("Social auth error:", error);
      sendResponse({
        success: false,
        error: error.message || "Social authentication failed",
      });
    }
  }
}

// Get the current active tab to initialize or recover tracking
async function getCurrentActiveTab() {
  try {
    // Nothing is being looked at while the browser is in the background
    if ((await getFocusedWindowId()) === null) {
      currentTab = null;
      return;
    }

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
    pruneHistory(historicalData, maxHistoryDays);

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
    // A tab activated in a background window is not what the user is looking at
    if (tab && tab.windowId === (await getFocusedWindowId())) {
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
    try {
      const shouldBlock = await isUrlBlocked(changeInfo.url);
      if (shouldBlock) {
        console.log(`Blocking URL change to ${changeInfo.url} in tab ${tabId}`);
        await redirectToBlockedPage(tabId, changeInfo.url);
        await trackBlockedAttempt(changeInfo.url);
        return; // Don't continue with normal tab handling
      }
    } catch (error) {
      console.error("Error checking URL in tab update:", error);
    }

    // Only the active tab of the focused window is tracked
    if (tab.windowId !== (await getFocusedWindowId())) return;

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
    // Navigating within the same site is still the same visit
    const sameVisit =
      currentTab !== null &&
      currentTab.domain === url.hostname &&
      currentTab.visitCounted === true;
    currentTab = {
      id: tab.id,
      domain: url.hostname,
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl,
      startTime: Date.now(),
      visitCounted: sameVisit,
    };
    lastUpdateTime = Date.now();
  } catch (error) {
    console.error("Error processing URL:", error);
    currentTab = null;
  }
}

// Credit the time spent on the current tab since the last update.
// The elapsed time is claimed synchronously (the tab's clock restarts in the
// same step), so the timer, the alarm and tab events can all call this without
// counting an interval twice. Storage writes are queued to avoid lost updates.
function updateTimeForCurrentTab() {
  if (!currentTab) return storageWriteQueue;

  const tab = currentTab;
  const now = Date.now();
  const timeSpent = claimElapsedTime(tab, now, MAX_INACTIVE_TIME);

  if (timeSpent <= 0) return storageWriteQueue;

  const isNewVisit = !tab.visitCounted;
  tab.visitCounted = true;

  storageWriteQueue = storageWriteQueue
    .then(() => recordTime(tab, timeSpent, isNewVisit, now))
    .catch((error) => console.error("Error updating time:", error));

  return storageWriteQueue;
}

// Add time for a tab to today's totals in storage
async function recordTime(tab, timeSpent, isNewVisit, now) {
  let result = await browserApiService.getStorage([
    "sites",
    "totalTime",
    "lastDate",
  ]);

  // Archive the previous day first if midnight has passed since the last write
  if (result.lastDate && result.lastDate !== new Date(now).toDateString()) {
    await checkAndResetForNewDay(result.lastDate);
    await checkAndResetUnblockData();
    result = await browserApiService.getStorage(["sites", "totalTime"]);
  }

  const sites = result.sites || {};
  const domain = tab.domain;

  // Update site data
  if (!sites[domain]) {
    sites[domain] = {
      totalTime: 0,
      visits: 0,
      favicon: tab.favIconUrl,
      title: tab.title,
    };
  }

  sites[domain].totalTime += timeSpent;
  if (isNewVisit) {
    sites[domain].visits += 1;
  }
  sites[domain].lastVisit = now;

  await browserApiService.setStorage({
    sites: sites,
    totalTime: (result.totalTime || 0) + timeSpent,
  });

  // If we're authenticated and it's been a while since our last sync,
  if (isAuthenticated && now - lastSyncTime > 5 * 60 * 1000) {
    // Sync after 5 minutes
    syncDataWithApi();
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
    "settings",
    "freeMode",
  ]);
  // Check both blockingEnabled and settings.enableBlocking for compatibility
  const blockingEnabled =
    result.blockingEnabled || result.settings?.enableBlocking || false;
  let blockedSites = result.blockedSites || [];
  const isFreeMode = result.freeMode === true;

  // In free mode only the first few sites are enforced. The stored list is
  // left intact so nothing is lost if the account is premium again later.
  if (isFreeMode && blockedSites.length > FREE_MODE_MAX_BLOCKED_SITES) {
    blockedSites = blockedSites.slice(0, FREE_MODE_MAX_BLOCKED_SITES);
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
async function syncDataWithApi(isManualSync = false) {
  // Only sync if authenticated
  if (!isAuthenticated) {
    // Use forceSyncCheck for manual syncs to bypass cache, regular check for automatic syncs
    if (isManualSync) {
      console.log("Manual sync requested, forcing authentication check...");
      isAuthenticated = await authService.forceSyncCheck();
    } else {
      isAuthenticated = await authService.isAuthenticated();
    }
    
    if (!isAuthenticated) {
      console.log("Not authenticated, skipping API sync");
      return;
    }
  }

  try {
    console.log(`Syncing data with API... (${isManualSync ? 'manual' : 'automatic'})`);

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

    console.log(`Data sync completed successfully (${isManualSync ? 'manual' : 'automatic'})`);
  } catch (error) {
    console.error("API sync error:", error);

    // If we got an authentication error, clear the token and cache
    if (error.message.includes("Authentication expired")) {
      isAuthenticated = false;
      // Clear auth cache when we get authentication errors
      authService.clearAuthCache();
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
    // Credit the tab of the window we are leaving before switching
    await updateTimeForCurrentTab();
    await getCurrentActiveTab();
    
    // Ensure real-time tracking is active
    if (!realTimeUpdateTimer) {
      startRealTimeTracking();
    }
  } else {
    // Credit the time up to now, then stop attributing time to any tab until
    // the browser is focused again
    const flushed = updateTimeForCurrentTab();
    currentTab = null;
    stopRealTimeTracking();
    await flushed;
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

// Handle checkout session creation
async function handleCreateCheckoutSession(request, sendResponse) {
  try {
    const { priceId, authToken } = request;
    
    if (!authToken) {
      sendResponse({ success: false, error: 'Authentication required' });
      return;
    }

    // Call API to create Stripe checkout session
    const response = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ priceId }),
    });

    const result = await response.json();

    if (response.ok) {
      sendResponse({ 
        success: true, 
        checkoutUrl: result.url
      });
    } else {
      sendResponse({ success: false, error: result.message || 'Failed to create checkout session' });
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    sendResponse({ success: false, error: 'Failed to create checkout session' });
  }
}

async function handleVerifyPayment(request, sendResponse) {
  console.log('🔍 Starting payment verification process...');
  console.log('Verification request:', request);
  
  try {
    const { sessionId } = request;
    
    if (!sessionId) {
      console.error('❌ No session ID provided');
      sendResponse({ success: false, error: 'Session ID required' });
      return;
    }

    console.log('📋 Session ID to verify:', sessionId);
    console.log('🔑 Retrieving stored auth token...');

    // Get auth token
    const authToken = await getStoredAuthToken();
    if (!authToken) {
      console.error('❌ No authentication token found');
      sendResponse({ success: false, error: 'Authentication token not found' });
      return;
    }

    console.log('✅ Auth token retrieved successfully');
    console.log('🌐 Making API request to verify subscription status...');

    // Check subscription status from backend
    const apiUrl = `${API_BASE_URL}/payments/subscription-status`;
    console.log('API URL:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });

    console.log('📨 API Response status:', response.status);
    console.log('📨 API Response OK:', response.ok);

    const subscriptionData = await response.json();
    console.log('📊 Subscription data received:', subscriptionData);

    if (!response.ok) {
      console.error('❌ API request failed:', subscriptionData.message);
      sendResponse({ success: false, error: subscriptionData.message || 'Payment verification failed' });
      return;
    }

    if (!subscriptionData.hasSubscription) {
      console.error('❌ No subscription found for user');
      sendResponse({ success: false, error: 'Subscription not found. Payment may still be processing.' });
      return;
    }

    console.log('✅ Subscription verified, updating local user state...');
    
    // Update local user state to reflect premium status
    await updateLocalUserState(subscriptionData);

    console.log('✅ Payment verification completed successfully');
    
    sendResponse({ 
      success: true, 
      data: subscriptionData 
    });

  } catch (error) {
    console.error('💥 Error verifying payment:', error);
    console.error('Error stack:', error.stack);
    sendResponse({ success: false, error: 'Payment verification failed' });
  }
}

async function handleLogPaymentCancellation(request, sendResponse) {
  try {
    const { data } = request;
    
    // Get auth token
    const authToken = await getStoredAuthToken();
    
    if (authToken) {
      // Make optional API call to log cancellation
      try {
        await fetch(`${API_BASE_URL}/payments/log-cancellation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify(data),
        });
      } catch (error) {
        console.log('Could not log cancellation to API:', error);
      }
    }
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error logging payment cancellation:', error);
    sendResponse({ success: false, error: 'Failed to log cancellation' });
  }
}

async function handleInitiatePayment(sendResponse) {
  try {
    // Get auth token
    const authToken = await getStoredAuthToken();
    if (!authToken) {
      sendResponse({ success: false, error: 'Authentication required' });
      return;
    }

    // Create new checkout session (reuse existing logic)
    const response = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ priceId: 'price_default' }), // Use default price
    });

    const result = await response.json();

    if (response.ok) {
      // Open checkout URL in new tab
      browserAPI.tabs.create({ url: result.url });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: result.message || 'Failed to initiate payment' });
    }
  } catch (error) {
    console.error('Error initiating payment:', error);
    sendResponse({ success: false, error: 'Failed to initiate payment' });
  }
}

async function handleSetFreeMode(request, sendResponse) {
  try {
    const { data } = request;
    const { freeMode } = data;

    // Update local storage
    browserAPI.storage.local.set({
      freeMode: freeMode,
      userType: freeMode ? 'free' : 'premium'
    }, () => {
      isFreeMode = freeMode;
      sendResponse({ success: true });
    });
  } catch (error) {
    console.error('Error setting free mode:', error);
    sendResponse({ success: false, error: 'Failed to set free mode' });
  }
}

// Helper function to get stored auth token
async function getStoredAuthToken() {
  console.log('🔑 Retrieving auth token from local storage...');
  
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['authToken'], (result) => {
      const token = result.authToken || null;
      console.log('Auth token found:', !!token);
      resolve(token);
    });
  });
}

// Helper function to update local user state
async function updateLocalUserState(subscriptionData) {
  console.log('💾 Updating local user state with subscription data...');
  console.log('Subscription data to save:', subscriptionData);
  
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['userInfo'], (result) => {
      console.log('Current userInfo:', result.userInfo);
      
      const updatedUserInfo = {
        ...result.userInfo,
        userType: 'premium',
        hasSubscription: true,
        subscriptionStatus: subscriptionData.status,
        subscriptionId: subscriptionData.subscriptionId,
        currentPeriodEnd: subscriptionData.currentPeriodEnd
      };
      
      console.log('Updated userInfo to save:', updatedUserInfo);
      
      browserAPI.storage.local.set({
        userInfo: updatedUserInfo,
        freeMode: false
      }, () => {
        isFreeMode = false;
        console.log('✅ Local user state updated to premium successfully');
        console.log('isFreeMode set to:', isFreeMode);
        resolve();
      });
    });
  });
}

// Actions handled by handleCoreMessage
const CORE_ACTIONS = new Set([
  'updateBlockedSites',
  'updateTemporaryUnblocks',
  'openBlocklistSettings',
  'syncWithApi',
  'checkAuthentication',
  'checkFreeMode',
  'trackKeyAction',
  'getTrackingStatus',
  'checkUrlBlocked',
  'getBlockedAttempts',
  'signin',
  'signup',
  'signout',
  'socialAuth',
]);

// Startup. Every listener below is registered synchronously, in the same turn
// the service worker starts: the browser only delivers the event that woke
// the worker to listeners that exist by then. Handlers wait for `ready` so
// they never run against state that has not been loaded yet.
const ready = initializeExtension().catch((error) => {
  console.error('Error initializing Argus:', error);
});

const whenReady = (handler) => async (...args) => {
  await ready;
  return handler(...args);
};

browserApiService.addIdleStateListener(whenReady(checkIdleState), IDLE_THRESHOLD);
browserApiService.addAlarmListener(whenReady(handleAlarm));
browserApiService.addTabActivatedListener(whenReady(handleTabActivated));
browserApiService.addTabUpdatedListener(whenReady(handleTabUpdated));

// Add window focus listeners to handle browser window switching
browserApiService.addWindowFocusListener(whenReady(handleWindowFocus));

// Add web navigation listeners for blocking checks
browserApiService.addWebNavigationListener(whenReady(handleBeforeNavigate));

// Message handler
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (CORE_ACTIONS.has(request.action)) {
    ready.then(() => handleCoreMessage(request, sender, sendResponse));
    return true; // Indicates we will send a response asynchronously
  }

  switch (request.action) {
    case 'createCheckoutSession':
      handleCreateCheckoutSession(request, sendResponse);
      return true;

    case 'verifyPayment':
      handleVerifyPayment(request, sendResponse);
      return true;

    case 'logPaymentCancellation':
      handleLogPaymentCancellation(request, sendResponse);
      return true;

    case 'initiatePayment':
      handleInitiatePayment(sendResponse);
      return true;

    case 'setFreeMode':
      handleSetFreeMode(request, sendResponse);
      return true;

    default:
      console.log('Unknown action:', request.action);
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});
