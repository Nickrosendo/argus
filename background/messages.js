// Messages from the popup, blocked page and content scripts
import browserApiService from "../services/BrowserApiService";
import { restoreBackup } from './backup.js';
import { endFocusSession, startFocusSession } from './focus.js';
import { state } from './state.js';
import {
  updateBlockedSites,
  handleTemporaryUnblock,
  isUrlBlocked,
} from './blocking.js';

// Handle messages from the popup, blocked page and content scripts
export function handleCoreMessage(message, sender, sendResponse) {
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
  } else if (message.action === "startFocusSession") {
    startFocusSession(message.minutes)
      .then((result) => {
        sendResponse(
          result.ok
            ? { success: true, session: result.session }
            : { success: false, error: result.reason }
        );
      })
      .catch((error) => {
        console.error("Error starting focus session:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "stopFocusSession") {
    endFocusSession(false)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error stopping focus session:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "restoreBackup") {
    restoreBackup(message.data)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error restoring backup:", error);
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
  } else if (message.action === "getTrackingStatus") {
    // Return current tracking status for debugging
    const status = {
      isTracking: state.isTracking,
      hasCurrentTab: !!state.currentTab,
      currentDomain: state.currentTab?.domain || null,
      hasRealTimeTimer: !!state.realTimeUpdateTimer,
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
  }
}

// Actions handled by handleCoreMessage
export const CORE_ACTIONS = new Set([
  'updateBlockedSites',
  'updateTemporaryUnblocks',
  'startFocusSession',
  'stopFocusSession',
  'restoreBackup',
  'openBlocklistSettings',
  'getTrackingStatus',
  'checkUrlBlocked',
  'getBlockedAttempts',
]);
