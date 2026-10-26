// Restoring a backup without losing the time being tracked
import browserApiService from "../services/BrowserApiService";
import { BACKUP_KEYS, mergeBackup } from '../services/backupUtils.js';
import { HISTORY_DAYS } from './constants.js';
import {
  checkAndResetForNewDay,
  enqueueStorageWrite,
  updateTimeForCurrentTab,
} from './tracking.js';
import { checkAndResetUnblockData, updateBlockedSites } from './blocking.js';

// Merge a backup into the stored data. Time on the current tab is credited
// first and the merge runs on the tracker's write queue, so a tick can neither
// be lost nor overwrite the restored values.
export async function restoreBackup(data) {
  const backup = BACKUP_KEYS.reduce((picked, key) => {
    if (data && key in data) picked[key] = data[key];
    return picked;
  }, {});

  await updateTimeForCurrentTab();

  await enqueueStorageWrite(async () => {
    // Roll a stale day over first, so the merge compares against today's counters
    const { lastDate } = await browserApiService.getStorage(['lastDate']);
    await checkAndResetForNewDay(lastDate);
    await checkAndResetUnblockData();

    const local = await browserApiService.getStorage([
      'history',
      'sites',
      'totalTime',
      'hourly',
      'lastDate',
      'focusStats',
    ]);
    await browserApiService.setStorage(mergeBackup(local, backup, HISTORY_DAYS));
  });

  await updateBlockedSites();
}
