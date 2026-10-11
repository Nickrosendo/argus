// Uploading usage data to the API
import browserApiService from "../services/BrowserApiService";
import authService from "../services/AuthService";
import apiService from "../services/ApiService";
import { state } from './state.js';

// Sync data with the API
export async function syncDataWithApi(isManualSync = false) {
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
    state.lastSyncTime = Date.now();
    await browserApiService.setStorage({ lastSyncTime: state.lastSyncTime });

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
