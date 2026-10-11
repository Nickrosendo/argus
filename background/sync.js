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

// Sync data with the API
export async function syncDataWithApi(isManualSync = false) {
  // Cloud sync is a premium feature (the API enforces this too)
  if (state.isFreeMode) {
    console.log("Free mode, skipping API sync");
    return;
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
      return;
    }
  }

  try {
    console.log(`Syncing data with API... (${isManualSync ? 'manual' : 'automatic'})`);

    const result = await browserApiService.getStorage([
      "sites",
      "totalTime",
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
  } catch (error) {
    console.error("API sync error:", error);

    // If we got an authentication error, clear the token and cache
    if (error.message.includes("Authentication expired")) {
      state.isAuthenticated = false;
      // Clear auth cache when we get authentication errors
      authService.clearAuthCache();
    }
  }
}
