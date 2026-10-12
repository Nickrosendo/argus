// Cloud sync: upload this device's usage per day and fetch the other devices'
import browserApiService from "../services/BrowserApiService";
import authService from "../services/AuthService";
import apiService from "../services/ApiService";
import {
  buildUploadDays,
  toIsoDate,
  toLocalDays,
  updateSyncedDays,
} from '../services/syncUtils.js';
import { REMOTE_HISTORY_DAYS } from './constants.js';
import { state } from './state.js';

// Sync data with the API. Resolves to { ok, reason } so callers can tell the
// user what actually happened.
export async function syncDataWithApi(isManualSync = false) {
  // Cloud sync is a premium feature (the API enforces this too)
  if (state.isFreeMode) {
    console.log("Free mode, skipping API sync");
    return { ok: false, reason: "Sync is part of Premium" };
  }

  // Sync is opt-in: nothing is uploaded until the user turns it on
  const { syncEnabled } = await browserApiService.getStorage(["syncEnabled"]);
  if (syncEnabled !== true) {
    return { ok: false, reason: "Sync is turned off" };
  }

  // Only sync if authenticated
  if (!state.isAuthenticated) {
    // Use forceSyncCheck for manual syncs to bypass cache, regular check for automatic syncs
    if (isManualSync) {
      console.log("Manual sync requested, forcing authentication check...");
      state.isAuthenticated = await authService.forceSyncCheck();
    } else {
      state.isAuthenticated = await authService.isAuthenticated();
    }
    
    if (!state.isAuthenticated) {
      console.log("Not authenticated, skipping API sync");
      return { ok: false, reason: "Not signed in" };
    }
  }

  try {
    console.log(`Syncing data with API... (${isManualSync ? 'manual' : 'automatic'})`);

    const result = await browserApiService.getStorage([
      "sites",
      "totalTime",
      "hourly",
      "lastDate",
      "history",
      "syncedDays",
      "deviceId",
    ]);

    // Generate a device ID if not already stored
    let deviceId = result.deviceId;
    if (!deviceId) {
      deviceId = `argus_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await browserApiService.setStorage({ deviceId });
    }

    // Upload today plus any finished days the server does not have yet.
    // A day uploaded again replaces the earlier upload, so this is safe to repeat.
    const { days, historyDates } = buildUploadDays({
      sites: result.sites,
      totalTime: result.totalTime,
      hourly: result.hourly,
      currentDate: result.lastDate || new Date().toDateString(),
      history: result.history,
      syncedDays: result.syncedDays,
    });
    await apiService.syncBrowserUsage(deviceId, { days });

    // Fetch what the user's other devices recorded
    const since = new Date();
    since.setDate(since.getDate() - REMOTE_HISTORY_DAYS);
    const remote = await apiService.getUsageDays({
      since: toIsoDate(since),
      excludeDeviceId: deviceId,
    });

    // Update last sync time
    state.lastSyncTime = Date.now();
    await browserApiService.setStorage({
      lastSyncTime: state.lastSyncTime,
      syncedDays: updateSyncedDays(result.syncedDays, historyDates, result.history),
      remoteDays: toLocalDays(remote && remote.days),
    });

    console.log(`Data sync completed successfully (${isManualSync ? 'manual' : 'automatic'})`);
    return { ok: true };
  } catch (error) {
    console.error("API sync error:", error);

    // If we got an authentication error, clear the token and cache
    if (error.message.includes("Authentication expired")) {
      state.isAuthenticated = false;
      // Clear auth cache when we get authentication errors
      authService.clearAuthCache();
    }

    return { ok: false, reason: error.message || "Sync failed" };
  }
}

// Erase everything this account has synced, from every device, and turn sync
// off so it is not uploaded again
export async function deleteSyncedData() {
  try {
    const result = await apiService.deleteUsageData();

    state.lastSyncTime = 0;
    await browserApiService.setStorage({
      syncEnabled: false,
      remoteDays: {},
      syncedDays: [],
      lastSyncTime: null,
    });

    return { ok: true, deleted: result && result.deleted };
  } catch (error) {
    console.error("Error deleting synced data:", error);
    return { ok: false, reason: error.message || "Could not delete the synced data" };
  }
}
