// Argus - Time tracking background service worker
import browserApiService from "./services/BrowserApiService";
import {
  ALARM_NAME,
  UPDATE_INTERVAL,
  TEMP_UNBLOCK_CHECK_ALARM,
  FOCUS_END_ALARM,
} from './background/constants.js';
import {
  state,
  browserAPI,
  restoreTrackingState,
  setTracking,
} from './background/state.js';
import {
  applySettings,
  migrateStoredData,
  updateTimeForCurrentTab,
  reconcileActiveTab,
  checkAndResetForNewDay,
  handleTabActivated,
  handleTabUpdated,
  checkIdleState,
  updateTracker,
  startRealTimeTracking,
  handleWindowFocus,
} from './background/tracking.js';
import {
  updateBlockedSites,
  checkTemporaryUnblocks,
  checkAndResetUnblockData,
  handleBeforeNavigate,
} from './background/blocking.js';
import { endFocusSession, loadFocusSession } from './background/focus.js';
import { CORE_ACTIONS, handleCoreMessage } from './background/messages.js';

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

  console.log("Initializing browser storage and state...");

  // Initialize storage if needed
  const result = await browserApiService.getStorage([
    "sites",
    "totalTime",
    "lastDate",
    "blockingEnabled",
    "blockedSites",
    "unblockData",
    "settings",
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

  // Load any temporary unblocks
  if (result.unblockData && result.unblockData.temporaryUnblocks) {
    state.temporaryUnblocks = result.unblockData.temporaryUnblocks;
  }

  // Use the pause and idle settings the user chose
  applySettings(result.settings);

  // Convert data stored by earlier versions before anything reads it
  await migrateStoredData();

  // Check and reset unblock count for new day
  await checkAndResetUnblockData();

  // Check if it's a new day and reset if needed
  await checkAndResetForNewDay(result.lastDate);

  // Pick up the tab and tracking flag from before the worker was suspended
  await restoreTrackingState();
  const wasTracking = state.isTracking;

  const idleState = await browserApiService.getIdleState(state.idleThreshold);
  setTracking(idleState === "active");

  // The user came back while the worker was suspended: do not count the
  // time they were away
  if (state.isTracking && !wasTracking && state.currentTab) {
    state.currentTab.startTime = Date.now();
  }

  await reconcileActiveTab();

  // Restore a focus session that was running before the worker stopped
  await loadFocusSession();

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

// Handle alarm events
function handleAlarm(alarm) {
  if (alarm.name === ALARM_NAME) {
    updateTracker();
  } else if (alarm.name === TEMP_UNBLOCK_CHECK_ALARM) {
    checkTemporaryUnblocks();
  } else if (alarm.name === FOCUS_END_ALARM) {
    endFocusSession(true);
  }
}
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

// Registered with the default threshold; initialization and the settings
// listener below switch it to the user's value
browserApiService.addIdleStateListener(whenReady(checkIdleState), state.idleThreshold);

// Pick up changed pause and idle settings without waiting for a restart
browserAPI.storage.onChanged.addListener(
  whenReady((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
      applySettings(changes.settings.newValue);
    }
  })
);
browserApiService.addAlarmListener(whenReady(handleAlarm));
browserApiService.addTabActivatedListener(whenReady(handleTabActivated));
browserApiService.addTabUpdatedListener(whenReady(handleTabUpdated));

// Add window focus listeners to handle browser window switching
browserApiService.addWindowFocusListener(whenReady(handleWindowFocus));

// Add web navigation listeners for blocking checks
browserApiService.addWebNavigationListener(whenReady(handleBeforeNavigate));

// An open popup connects so its numbers stay live: totals are then saved
// every few seconds instead of every 30
browserAPI.runtime.onConnect.addListener((port) => {
  if (port.name !== 'popup') return;

  state.openPopups += 1;
  // Show fresh numbers straight away, unless tracking is paused (idle)
  ready.then(() => {
    if (state.isTracking) updateTimeForCurrentTab();
  });

  port.onDisconnect.addListener(() => {
    state.openPopups = Math.max(0, state.openPopups - 1);
  });
});

// Message handler
browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (CORE_ACTIONS.has(request.action)) {
    ready.then(() => handleCoreMessage(request, sender, sendResponse));
    return true; // Indicates we will send a response asynchronously
  }

  console.log('Unknown action:', request.action);
  sendResponse({ success: false, error: 'Unknown action' });
  return false;
});
