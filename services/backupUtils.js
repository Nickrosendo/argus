/**
 * Pure helpers for exporting, reading and merging Argus backup files,
 * kept free of browser APIs so they can be unit tested.
 */

import { pruneHistory } from './trackingUtils';
import { HISTORY_DAYS } from '../background/constants';

export const BACKUP_FORMAT = 1;

export const BACKUP_KEYS = [
  'history',
  'sites',
  'totalTime',
  'hourly',
  'lastDate',
  'settings',
  'blockedSites',
  'blockingEnabled',
  'focusStats',
];

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Argus keys days with Date.toDateString(), for example "Sun Oct 12 2026"
const isDateKey = (key) =>
  typeof key === 'string' && new Date(key).toDateString() === key;

/**
 * Recorded time of a day, treating a missing or non-numeric value as 0.
 *
 * @param {Object} [day] Day data
 * @returns {number} Total time in ms
 */
const dayTime = (day) => (day && Number.isFinite(day.totalTime) ? day.totalTime : 0);

/**
 * Keep only history entries with a valid date key and an object value.
 *
 * @param {Object} history Map of date string -> day data
 * @returns {Object} A new map without malformed entries
 */
function cleanHistory(history) {
  return Object.entries(history).reduce((clean, [date, entry]) => {
    if (isDateKey(date) && isPlainObject(entry)) {
      clean[date] = entry;
    }
    return clean;
  }, {});
}

const VALID_VALUE = {
  history: isPlainObject,
  sites: isPlainObject,
  hourly: Array.isArray,
  totalTime: Number.isFinite,
  lastDate: isDateKey,
  settings: isPlainObject,
  blockedSites: (value) => Array.isArray(value) && value.every((v) => typeof v === 'string'),
  blockingEnabled: (value) => typeof value === 'boolean',
  focusStats: isPlainObject,
};

/**
 * The days a backup holds: its history plus the counters of its own last day.
 * Those counters replace a history entry for the same date only if they have more time.
 *
 * @param {Object} backup Backup data
 * @returns {Object} Map of date string -> day data
 */
function backupDaysOf(backup) {
  const days = isPlainObject(backup.history) ? cleanHistory(backup.history) : {};

  if (isDateKey(backup.lastDate) && dayTime(backup) > 0 && isPlainObject(backup.sites)) {
    const counters = {
      sites: backup.sites,
      totalTime: backup.totalTime,
      hourly: Array.isArray(backup.hourly) ? backup.hourly : [],
      date: backup.lastDate,
    };
    if (!days[backup.lastDate] || dayTime(counters) > dayTime(days[backup.lastDate])) {
      days[backup.lastDate] = counters;
    }
  }

  return days;
}

/**
 * Keep only the keys that belong in a backup.
 *
 * @param {Object} source Storage contents or a parsed backup payload
 * @returns {Object} A new object holding the backup keys present in source
 */
function pickBackupKeys(source) {
  return BACKUP_KEYS.reduce((data, key) => {
    if (key in source) {
      data[key] = source[key];
    }
    return data;
  }, {});
}

/**
 * Like pickBackupKeys, for untrusted files: wrong-typed values are dropped
 * and malformed history entries removed.
 *
 * @param {Object} source Parsed backup payload
 * @returns {Object} A new object holding only well-formed backup values
 */
function pickValidBackupKeys(source) {
  const data = pickBackupKeys(source);
  BACKUP_KEYS.forEach((key) => {
    if (key in data && !VALID_VALUE[key](data[key])) {
      delete data[key];
    }
  });
  if (data.history) {
    data.history = cleanHistory(data.history);
  }
  return data;
}

/**
 * Build the backup file contents from the extension's storage.
 *
 * @param {Object} storage Everything read from browser storage
 * @param {Date} [now] Export time
 * @returns {{argusBackup: number, exportedAt: string, data: Object}} The backup object
 */
export function createBackup(storage, now = new Date()) {
  return {
    argusBackup: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    data: pickBackupKeys(storage),
  };
}

/**
 * File name for a backup made at the given time, using the local date.
 *
 * @param {Date} [now] Export time
 * @returns {string} For example "argus-backup-2026-10-05.json"
 */
export function backupFileName(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `argus-backup-${now.getFullYear()}-${month}-${day}.json`;
}

/**
 * Read a backup file. Accepts the wrapped format and a raw dump of the
 * extension's storage (as written by 1.x versions).
 *
 * @param {string} text File contents
 * @returns {{ok: true, data: Object, exportedAt: string|null}|{ok: false, reason: string}}
 *   The backup data restricted to BACKUP_KEYS, or why the file was rejected
 */
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, reason: "This file isn't an Argus backup." };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, reason: "This file isn't an Argus backup." };
  }

  let source = parsed;
  let exportedAt = null;

  if ('argusBackup' in parsed) {
    if (!Number.isFinite(parsed.argusBackup)) {
      return { ok: false, reason: "This file isn't an Argus backup." };
    }
    if (parsed.argusBackup > BACKUP_FORMAT) {
      return { ok: false, reason: 'This backup was made by a newer version of Argus.' };
    }
    source = isPlainObject(parsed.data) ? parsed.data : {};
    exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null;
  }

  const data = pickValidBackupKeys(source);
  if (!isPlainObject(data.history) && !isPlainObject(data.sites)) {
    return { ok: false, reason: 'This file has no Argus data.' };
  }

  return { ok: true, data, exportedAt };
}

/**
 * Describe a backup for the confirmation shown before restoring.
 *
 * @param {Object} data Backup data (BACKUP_KEYS only)
 * @param {number} [maxDays] Most days a restore keeps (older ones are pruned)
 * @returns {{days: number, blockedSites: number}} Days with recorded time (at most maxDays) and blocked site count
 */
export function summarizeBackup(data, maxDays = HISTORY_DAYS) {
  const recorded = Object.values(backupDaysOf(data)).filter((entry) => dayTime(entry) > 0).length;
  const days = Math.min(recorded, maxDays);

  return {
    days,
    blockedSites: Array.isArray(data.blockedSites) ? data.blockedSites.length : 0,
  };
}

/**
 * Work out what to write to storage when restoring a backup into a browser
 * that already has data. Nothing is lost: per day, the one with more time wins,
 * and today's running counters are only replaced by a larger backup value.
 *
 * @param {Object} local Current storage: history, sites, totalTime, hourly, lastDate, focusStats
 * @param {Object} backup Backup data (BACKUP_KEYS only)
 * @param {number} maxDays Number of history days to keep
 * @returns {Object} Storage keys to write (inputs are not mutated)
 */
export function mergeBackup(local, backup, maxDays) {
  const updates = {};
  const backupDays = backupDaysOf(backup);

  const history = { ...(local.history || {}) };

  Object.entries(backupDays).forEach(([date, backupDay]) => {
    if (date === local.lastDate) {
      if (dayTime(backupDay) > dayTime(local)) {
        updates.sites = backupDay.sites;
        updates.totalTime = backupDay.totalTime;
        updates.hourly = backupDay.hourly;
        if (backup.focusStats && backup.focusStats.date === date) {
          updates.focusStats = backup.focusStats;
        }
      }
    } else if (!history[date] || dayTime(backupDay) > dayTime(history[date])) {
      history[date] = backupDay;
    }
  });

  updates.history = pruneHistory(history, maxDays);

  ['settings', 'blockedSites', 'blockingEnabled'].forEach((key) => {
    if (key in backup) {
      updates[key] = backup[key];
    }
  });

  return updates;
}
