// Constants shared by the background modules
export const ALARM_NAME = "update-tracker";
export const UPDATE_INTERVAL = 0.25; // minutes; browsers clamp alarm periods to 30 seconds
export const MAX_INACTIVE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
export const TEMP_UNBLOCK_CHECK_ALARM = "check-temp-unblocks";
export const REAL_TIME_UPDATE_INTERVAL = 5000; // 5 seconds for very frequent updates
export const BACKGROUND_WRITE_INTERVAL = 30000; // how often totals are saved while the popup is closed
export const DATA_VERSION = 3; // bump when stored data needs a one-time conversion
export const FOCUS_END_ALARM = "focus-end";
export const FOCUS_MAX_MINUTES = 180;
export const HISTORY_DAYS = 90; // past days kept in history

// Account, plan and sync data stored by version 1.x, removed on update
export const OBSOLETE_KEYS = [
  "authToken",
  "userInfo",
  "freeMode",
  "syncEnabled",
  "remoteDays",
  "syncedDays",
  "lastSyncTime",
  "deviceId",
  "freeActionCount",
  "lastAdTime",
  "userType",
];
