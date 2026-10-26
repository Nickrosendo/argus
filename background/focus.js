// Focus sessions: for a set time, every site on the block list is blocked and
// temporary unblocks are refused. The session lives in storage and ends on an
// alarm, so it survives the popup closing and the service worker restarting.
import browserApiService from "../services/BrowserApiService";
import { FOCUS_END_ALARM, FOCUS_MAX_MINUTES } from './constants.js';
import { state, browserAPI, isFocusActive } from './state.js';
import { updateBlockedSites } from './blocking.js';
import { enqueueStorageWrite } from './writeQueue.js';

// Today's focus numbers, reset when the date changes
async function getFocusStats() {
  const { focusStats } = await browserApiService.getStorage(["focusStats"]);
  const today = new Date().toDateString();

  return focusStats && focusStats.date === today
    ? focusStats
    : { date: today, started: 0, completed: 0, focusTime: 0, blocked: 0 };
}

// Restore a running session after a restart, or close one that ended while
// the worker was not running
export async function loadFocusSession() {
  const { focusSession } = await browserApiService.getStorage(["focusSession"]);
  if (!focusSession) return;

  state.focusSession = focusSession;
  if (!isFocusActive()) {
    await endFocusSession(true);
  }
}

export async function startFocusSession(minutes) {
  if (isFocusActive()) {
    return { ok: false, reason: "A focus session is already running" };
  }

  const duration = Math.min(FOCUS_MAX_MINUTES, Math.max(1, Math.round(Number(minutes) || 25)));
  const startedAt = Date.now();
  const session = { startedAt, endsAt: startedAt + duration * 60 * 1000, minutes: duration };

  state.focusSession = session;
  await enqueueStorageWrite(async () => {
    const stats = await getFocusStats();
    stats.started += 1;
    await browserApiService.setStorage({ focusSession: session, focusStats: stats });
  });
  browserAPI.alarms.create(FOCUS_END_ALARM, { when: session.endsAt });
  await updateBlockedSites();

  return { ok: true, session };
}

// End the session. `completed` is true when it ran its full time.
export async function endFocusSession(completed) {
  const session = state.focusSession;
  if (!session) return { ok: true };

  state.focusSession = null;
  await enqueueStorageWrite(async () => {
    const stats = await getFocusStats();
    const focusedUntil = Math.min(Date.now(), session.endsAt);
    stats.focusTime += Math.max(0, focusedUntil - session.startedAt);
    if (completed) stats.completed += 1;
    await browserApiService.setStorage({ focusSession: null, focusStats: stats });
  });
  await browserApiService.clearAlarm(FOCUS_END_ALARM);
  await updateBlockedSites();

  return { ok: true };
}
