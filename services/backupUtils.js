/**
 * Pure helpers for exporting, reading and merging Argus backup files,
 * kept free of browser APIs so they can be unit tested.
 */

import { pruneHistory } from './trackingUtils';

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
    if (Number(parsed.argusBackup) > BACKUP_FORMAT) {
      return { ok: false, reason: 'This backup was made by a newer version of Argus.' };
    }
    source = isPlainObject(parsed.data) ? parsed.data : {};
    exportedAt = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null;
  }

  const data = pickBackupKeys(source);
  if (!isPlainObject(data.history) && !isPlainObject(data.sites)) {
    return { ok: false, reason: 'This file has no Argus data.' };
  }

  return { ok: true, data, exportedAt };
}

/**
 * Describe a backup for the confirmation shown before restoring.
 *
 * @param {Object} data Backup data (BACKUP_KEYS only)
 * @returns {{days: number, blockedSites: number}} Days with recorded time and blocked site count
 */
export function summarizeBackup(data) {
  const history = isPlainObject(data.history) ? data.history : {};
  let days = Object.values(history).filter((entry) => entry && entry.totalTime > 0).length;

  if (data.lastDate && data.totalTime > 0 && !(data.lastDate in history)) {
    days += 1;
  }

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
  const backupDays = { ...(backup.history || {}) };

  if (backup.lastDate && backup.totalTime > 0) {
    backupDays[backup.lastDate] = {
      sites: backup.sites,
      totalTime: backup.totalTime,
      hourly: backup.hourly,
      date: backup.lastDate,
    };
  }

  const history = { ...(local.history || {}) };

  Object.entries(backupDays).forEach(([date, backupDay]) => {
    if (date === local.lastDate) {
      if (backupDay.totalTime > (local.totalTime || 0)) {
        updates.sites = backupDay.sites;
        updates.totalTime = backupDay.totalTime;
        updates.hourly = backupDay.hourly;
        if (backup.focusStats && backup.focusStats.date === date) {
          updates.focusStats = backup.focusStats;
        }
      }
    } else if (!history[date] || backupDay.totalTime > history[date].totalTime) {
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
