/**
 * Pure helpers for time tracking, kept free of browser APIs so they can be unit tested.
 */

const MIN_RECORDED_TIME = 500; // ms; shorter intervals keep accumulating

/**
 * Take the time elapsed on a tracked tab and restart its clock in one step,
 * so the same interval can never be credited twice by concurrent callers.
 *
 * @param {{startTime: number}} tab The tracked tab (mutated)
 * @param {number} now Current timestamp in ms
 * @param {number} maxInactiveTime Longer gaps mean the browser was suspended and are discarded
 * @returns {number} Milliseconds to credit (0 when there is nothing to record yet)
 */
export function claimElapsedTime(tab, now, maxInactiveTime) {
  const elapsed = now - tab.startTime;

  if (elapsed >= 0 && elapsed < MIN_RECORDED_TIME) {
    return 0;
  }

  tab.startTime = now;
  return elapsed > 0 && elapsed < maxInactiveTime ? elapsed : 0;
}

/**
 * Remove the oldest days from the history so at most maxDays remain.
 * Keys are Date#toDateString() values ("Mon Jul 21 2025"), which do not sort
 * chronologically as strings, so they are compared as dates.
 *
 * @param {Object} history Map of date string -> day data (mutated)
 * @param {number} maxDays Number of days to keep
 * @returns {Object} The same history object
 */
export function pruneHistory(history, maxDays) {
  const dates = Object.keys(history).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  dates
    .slice(0, Math.max(0, dates.length - maxDays))
    .forEach((date) => delete history[date]);

  return history;
}

const DEFAULT_IDLE_MINUTES = 5;
const MIN_IDLE_SECONDS = 15; // the smallest interval the browser idle API accepts

/**
 * How long without input before the user counts as idle, in seconds, from the
 * "Consider idle after (minutes)" setting. Falls back to the default when the
 * setting is missing or not a positive number.
 *
 * @param {{idleTime?: number}} [settings] The stored settings object
 * @returns {number} Idle threshold in whole seconds
 */
export function getIdleThresholdSeconds(settings) {
  const minutes = Number(settings && settings.idleTime);
  const validMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_IDLE_MINUTES;

  return Math.max(MIN_IDLE_SECONDS, Math.round(validMinutes * 60));
}

const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Whether a site name can be used as a key of a plain object. A page at
 * http://__proto__/ has that hostname, and using it as a key would read and
 * write Object.prototype instead of a stored site entry.
 *
 * @param {string} key The hostname or site name
 * @returns {boolean}
 */
export function isSafeSiteKey(key) {
  return typeof key === 'string' && key !== '' && !UNSAFE_KEYS.includes(key);
}
