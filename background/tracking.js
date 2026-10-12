// Time tracking: which tab is being looked at and how long for
import browserApiService from "../services/BrowserApiService";
import {
  addHourlyTime,
  claimElapsedTime,
  getIdleThresholdSeconds,
  getTrackableDomain,
  normalizeSites,
  pruneHistory,
} from '../services/trackingUtils.js';
import {
  MAX_INACTIVE_TIME,
  REAL_TIME_UPDATE_INTERVAL,
  BACKGROUND_WRITE_INTERVAL,
  DATA_VERSION,
} from './constants.js';
import {
  state,
  browserAPI,
  persistTrackingState,
  setCurrentTab,
  setTracking,
} from './state.js';
import {
  checkAndResetUnblockData,
  isUrlBlocked,
  trackBlockedAttempt,
  redirectToBlockedPage,
} from './blocking.js';
import { syncDataWithApi } from './sync.js';

// Serializes read-modify-write of tracking data
let storageWriteQueue = Promise.resolve();

// The id of the focused browser window, or null when the browser is not focused
export async function getFocusedWindowId() {
  try {
    const win = await browserAPI.windows.getLastFocused();
    return win && win.focused ? win.id : null;
  } catch (error) {
    console.error("Error querying focused window:", error);
    return null;
  }
}

// Get the current active tab to initialize or recover tracking
export async function getCurrentActiveTab() {
  try {
    // Nothing is being looked at while the browser is in the background
    if ((await getFocusedWindowId()) === null) {
      setCurrentTab(null);
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

// Line the tracked tab up with what the user is looking at right now.
// Used at startup: if the restored tab is still the active one its clock keeps
// running, otherwise its time is credited and tracking moves to the new tab.
export async function reconcileActiveTab() {
  const focusedWindowId = await getFocusedWindowId();
  const tab =
    focusedWindowId === null ? null : await browserApiService.getActiveTab();
  const current = state.currentTab;

  if (current && tab && tab.id === current.id && tab.url === current.url) {
    return;
  }

  await updateTimeForCurrentTab();
  handleTabChange(tab);
}

// One-time conversions of data stored by earlier versions
export async function migrateStoredData() {
  const result = await browserApiService.getStorage([
    "dataVersion",
    "sites",
    "history",
  ]);

  if (result.dataVersion >= DATA_VERSION) return;

  // Version 2: sites are keyed without the leading "www."
  const history = result.history || {};
  Object.keys(history).forEach((date) => {
    if (history[date] && history[date].sites) {
      history[date] = { ...history[date], sites: normalizeSites(history[date].sites) };
    }
  });

  await browserApiService.setStorage({
    dataVersion: DATA_VERSION,
    sites: normalizeSites(result.sites),
    history,
  });
}

// Check for new day and reset stats if needed
export async function checkAndResetForNewDay(lastDate) {
  const today = new Date().toDateString();

  if (lastDate && lastDate !== today) {
    // Archive yesterday's data if needed
    const result = await browserApiService.getStorage([
      "sites",
      "history",
      "totalTime",
      "hourly",
      "freeMode",
    ]);

    const historicalData = result.history || {};
    const isFreeMode = result.freeMode === true;

    // Store yesterday's data in history
    historicalData[lastDate] = {
      sites: result.sites,
      totalTime: result.totalTime,
      hourly: result.hourly,
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
      hourly: [],
      lastDate: today,
      history: historicalData,
    });
  } else if (!lastDate) {
    await browserApiService.setStorage({ lastDate: today });
  }
}

// Handle tab activated event
export async function handleTabActivated(activeInfo) {
  if (!state.isTracking) return;

  // Immediately update time for previous tab
  await updateTimeForCurrentTab();

  try {
    const tab = await browserApiService.getTabById(activeInfo.tabId);
    // A tab activated in a background window is not what the user is looking at
    if (tab && tab.windowId === (await getFocusedWindowId())) {
      handleTabChange(tab);
      // Ensure real-time tracking is active
      if (!state.realTimeUpdateTimer) {
        startRealTimeTracking();
      }
    }
  } catch (error) {
    console.error("Error handling tab activation:", error);
  }
}

// Handle tab updated event
export async function handleTabUpdated(tabId, changeInfo, tab) {
  if (!state.isTracking || !tab.active) return;

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
    if (!state.realTimeUpdateTimer) {
      startRealTimeTracking();
    }
  }
}

// Handle when a tab becomes the active tab
export function handleTabChange(tab) {
  // Only websites are tracked: not browser pages, extension pages or files.
  // Nothing is tracked while the user has paused tracking.
  const domain =
    !state.trackingPaused && tab && tab.url ? getTrackableDomain(tab.url) : null;

  if (!domain) {
    setCurrentTab(null);
    return;
  }

  // Navigating within the same site is still the same visit
  const sameVisit =
    state.currentTab !== null &&
    state.currentTab.domain === domain &&
    state.currentTab.visitCounted === true;
  setCurrentTab({
    id: tab.id,
    domain,
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    startTime: Date.now(),
    visitCounted: sameVisit,
  });
}

// Credit the time spent on the current tab since the last update.
// The elapsed time is claimed synchronously (the tab's clock restarts in the
// same step), so the timer, the alarm and tab events can all call this without
// counting an interval twice. Storage writes are queued to avoid lost updates.
export function updateTimeForCurrentTab() {
  if (!state.currentTab) return storageWriteQueue;

  const tab = state.currentTab;
  const now = Date.now();
  const timeSpent = claimElapsedTime(tab, now, MAX_INACTIVE_TIME);

  if (timeSpent <= 0) return storageWriteQueue;

  const isNewVisit = !tab.visitCounted;
  tab.visitCounted = true;
  persistTrackingState();

  storageWriteQueue = storageWriteQueue
    .then(() => recordTime(tab, timeSpent, isNewVisit, now))
    .catch((error) => console.error("Error updating time:", error));

  return storageWriteQueue;
}

// Add time for a tab to today's totals in storage
export async function recordTime(tab, timeSpent, isNewVisit, now) {
  let result = await browserApiService.getStorage([
    "sites",
    "totalTime",
    "hourly",
    "lastDate",
  ]);

  // Archive the previous day first if midnight has passed since the last write
  if (result.lastDate && result.lastDate !== new Date(now).toDateString()) {
    await checkAndResetForNewDay(result.lastDate);
    await checkAndResetUnblockData();
    result = await browserApiService.getStorage(["sites", "totalTime", "hourly"]);
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
    hourly: addHourlyTime(result.hourly, now, timeSpent),
  });

  // If we're authenticated and it's been a while since our last sync,
  if (state.isAuthenticated && now - state.lastSyncTime > 5 * 60 * 1000) {
    // Sync after 5 minutes
    syncDataWithApi();
  }
}

// Apply the settings the tracker depends on: pause, and the idle threshold
export function applySettings(settings) {
  const paused = !!(settings && settings.trackingPaused);
  if (paused !== state.trackingPaused) {
    state.trackingPaused = paused;
    if (paused) {
      // Credit what was already spent, then stop following any tab
      const flushed = updateTimeForCurrentTab();
      setCurrentTab(null);
      flushed.catch(() => {});
    } else {
      getCurrentActiveTab();
    }
  }

  applyIdleSetting(settings);
}

// Apply the user's "consider idle after" setting to idle detection
export function applyIdleSetting(settings) {
  const idleThreshold = getIdleThresholdSeconds(settings);
  if (idleThreshold === state.idleThreshold) return;

  state.idleThreshold = idleThreshold;
  browserApiService.setIdleDetectionInterval(idleThreshold);
}

// Check if the user is idle and pause tracking if needed
export async function checkIdleState(idleState) {
  if (idleState === "active") {
    // User returned to active state
    if (!state.isTracking) {
      console.log("User is active again, resuming tracking");
      setTracking(true);

      // Reset the current tab's start time to now to avoid counting idle time
      if (state.currentTab) {
        state.currentTab.startTime = Date.now();
      } else {
        // If we don't have a current tab, try to get the active tab
        await getCurrentActiveTab();
      }
      
      // Restart real-time tracking
      startRealTimeTracking();
    }
  } else if (idleState === "idle" || idleState === "locked") {
    // User is idle or screen is locked
    if (state.isTracking) {
      console.log("User is idle or screen is locked, pausing tracking");
      setTracking(false);

      // Update time spent before pausing
      await updateTimeForCurrentTab();
      
      // Stop real-time tracking to save resources
      stopRealTimeTracking();
    }
  }
}

// Update the tracker periodically
export async function updateTracker() {
  // If we're tracking and the user has been active recently, update the time
  if (state.isTracking) {
    // Check if browser is in idle state
    const idleState = await browserApiService.getIdleState(state.idleThreshold);

    if (idleState === "active") {
      // If we're active, update the time for the current tab
      updateTimeForCurrentTab();
    } else {
      // If we're idle, pause tracking
      setTracking(false);
      console.log("Browser is idle, pausing tracking");
    }
  }
}

// Start real-time tracking with frequent updates
export function startRealTimeTracking() {
  // Clear any existing timer
  if (state.realTimeUpdateTimer) {
    clearInterval(state.realTimeUpdateTimer);
  }
  
  console.log("Starting real-time tracking with 5-second intervals");
  
  // Set up real-time updates every 5 seconds when tracking is active
  state.realTimeUpdateTimer = setInterval(async () => {
    if (state.isTracking && state.currentTab) {
      // Only update if we have a current tab and we're actively tracking
      const idleState = await browserApiService.getIdleState(state.idleThreshold);
      if (idleState === "active") {
        // Save every tick only while a popup is showing the numbers;
        // otherwise a write every 30 seconds is enough
        const unsaved = Date.now() - state.currentTab.startTime;
        if (state.openPopups > 0 || unsaved >= BACKGROUND_WRITE_INTERVAL) {
          await updateTimeForCurrentTab();
        }
      } else {
        // If user becomes idle during real-time tracking, handle it
        console.log("User became idle during real-time tracking, pausing");
        setTracking(false);
        stopRealTimeTracking();
      }
    } else if (!state.currentTab && state.isTracking) {
      // Try to get current tab if we lost track of it
      console.log("Lost track of current tab, attempting to recover");
      await getCurrentActiveTab();
    }
  }, REAL_TIME_UPDATE_INTERVAL);
}

// Stop real-time tracking
export function stopRealTimeTracking() {
  if (state.realTimeUpdateTimer) {
    console.log("Stopping real-time tracking");
    clearInterval(state.realTimeUpdateTimer);
    state.realTimeUpdateTimer = null;
  }
}

// Add window focus listeners to handle browser window switching
export async function handleWindowFocus(focused) {
  if (focused) {
    console.log("Browser window is focused, ensuring real-time tracking");
    if (!state.isTracking) {
      setTracking(true);
    }
    // Credit the tab of the window we are leaving before switching
    await updateTimeForCurrentTab();
    await getCurrentActiveTab();
    
    // Ensure real-time tracking is active
    if (!state.realTimeUpdateTimer) {
      startRealTimeTracking();
    }
  } else {
    // Credit the time up to now, then stop attributing time to any tab until
    // the browser is focused again
    const flushed = updateTimeForCurrentTab();
    setCurrentTab(null);
    stopRealTimeTracking();
    await flushed;
  }
}
