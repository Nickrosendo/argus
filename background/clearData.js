// "Clear all data": runs on the tracker's write queue, so a tick that was
// already queued can't write old counts back after the clear
import browserApiService from "../services/BrowserApiService";
import { DATA_VERSION, FOCUS_END_ALARM } from './constants.js';
import { state, persistTrackingState } from './state.js';
import { applySettings, enqueueStorageWrite } from './tracking.js';
import { updateBlockedSites } from './blocking.js';

export const DEFAULT_SETTINGS = { idleTime: 5, dailyLimit: 8, enableBlocking: false };

export async function clearAllData() {
  await enqueueStorageWrite(async () => {
    // Time on the current tab up to now goes with everything else
    if (state.currentTab) {
      state.currentTab.startTime = Date.now();
      state.currentTab.visitCounted = false;
      persistTrackingState();
    }
    state.focusSession = null;
    state.temporaryUnblocks = {};

    await browserApiService.clearStorage();
    await browserApiService.setStorage({
      sites: {},
      totalTime: 0,
      hourly: [],
      history: {},
      // Without it the day rollover would stop until the background restarts
      lastDate: new Date().toDateString(),
      dataVersion: DATA_VERSION,
      settings: { ...DEFAULT_SETTINGS },
      blockedSites: [],
      blockingEnabled: false,
    });
  });

  applySettings(DEFAULT_SETTINGS);
  await browserApiService.clearAlarm(FOCUS_END_ALARM);
  await updateBlockedSites();
}
