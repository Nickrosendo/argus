// Constants shared by the background modules
export const ALARM_NAME = "update-tracker";
export const UPDATE_INTERVAL = 0.25; // minutes; browsers clamp alarm periods to 30 seconds
export const MAX_INACTIVE_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
export const TEMP_UNBLOCK_CHECK_ALARM = "check-temp-unblocks";
export const API_SYNC_ALARM = "api-sync";
export const API_SYNC_INTERVAL = 15; // minutes - how often to sync with API
export const FREE_MODE_MAX_BLOCKED_SITES = 3;
export const REAL_TIME_UPDATE_INTERVAL = 5000; // 5 seconds for very frequent updates
export const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
