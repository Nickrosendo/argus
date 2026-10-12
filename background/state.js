import { getIdleThresholdSeconds } from '../services/trackingUtils.js';

// Browser API compatibility
export const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// State shared by the background modules. Everything here is rebuilt when the
// service worker restarts.
export const state = {
  currentTab: null, // { id, domain, url, title, favIconUrl, startTime, visitCounted }
  isTracking: true,
  temporaryUnblocks: {}, // Domain -> expiration timestamp
  isAuthenticated: false,
  isFreeMode: false,
  lastSyncTime: 0,
  realTimeUpdateTimer: null,
  focusSession: null, // { startedAt, endsAt, minutes } while a focus session runs
  trackingPaused: false, // the user's "Pause tracking" setting
  openPopups: 0, // popups currently showing live numbers
  idleThreshold: getIdleThresholdSeconds(), // seconds, from the user's idle setting
};

export function isFocusActive() {
  return !!state.focusSession && state.focusSession.endsAt > Date.now();
}

// The tracked tab and the tracking flag are mirrored to session storage so a
// service worker restart continues where the previous instance stopped.
// Session storage is cleared when the browser closes.
const TRACKING_STATE_KEY = 'trackingState';

function getSessionStorage() {
  return browserAPI.storage && browserAPI.storage.session;
}

export function persistTrackingState() {
  const sessionStorage = getSessionStorage();
  if (!sessionStorage) return;

  Promise.resolve(
    sessionStorage.set({
      [TRACKING_STATE_KEY]: {
        currentTab: state.currentTab,
        isTracking: state.isTracking,
      },
    })
  ).catch((error) => console.error('Error persisting tracking state:', error));
}

// Returns true when state from a previous worker instance was restored
export async function restoreTrackingState() {
  const sessionStorage = getSessionStorage();
  if (!sessionStorage) return false;

  try {
    const result = await sessionStorage.get(TRACKING_STATE_KEY);
    const saved = result && result[TRACKING_STATE_KEY];
    if (!saved) return false;

    state.currentTab = saved.currentTab || null;
    state.isTracking = saved.isTracking !== false;
    return true;
  } catch (error) {
    console.error('Error restoring tracking state:', error);
    return false;
  }
}

export function setCurrentTab(tab) {
  state.currentTab = tab;
  persistTrackingState();
}

export function setTracking(isTracking) {
  state.isTracking = isTracking;
  persistTrackingState();
}
