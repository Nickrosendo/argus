/**
 * BrowserApiService
 * Provides a unified interface for browser API operations.
 * Handles differences between browser implementations.
 */

// Determine which browser API to use
const api = typeof browser !== 'undefined' ? browser : chrome;

/**
 * BrowserApiService class for handling all browser API operations
 */
const BrowserApiService = {
  api,

  /**
   * Gets the currently active tab
   * @returns {Promise<object|null>} The active tab or null if none found
   */
  async getActiveTab() {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        return tabs && tabs.length > 0 ? tabs[0] : null;
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs && tabs.length > 0 ? tabs[0] : null);
          });
        });
      }
    } catch (error) {
      console.error('Error getting active tab:', error);
      return null;
    }
  },

  /**
   * Gets a tab by its ID
   * @param {number} tabId The ID of the tab to get
   * @returns {Promise<object|null>} The tab object or null if not found
   */
  async getTabById(tabId) {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        return await browser.tabs.get(tabId);
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.tabs.get(tabId, (tab) => {
            resolve(tab);
          });
        });
      }
    } catch (error) {
      console.error(`Error getting tab ${tabId}:`, error);
      return null;
    }
  },

  /**
   * Queries tabs based on query parameters
   * @param {object} queryInfo The query parameters
   * @returns {Promise<Array<object>>} Array of matching tabs
   */
  async queryTabs(queryInfo) {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        return await browser.tabs.query(queryInfo);
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.tabs.query(queryInfo, (tabs) => {
            resolve(tabs);
          });
        });
      }
    } catch (error) {
      console.error('Error querying tabs:', error);
      return [];
    }
  },

  /**
   * Adds a listener for tab activation events
   * @param {Function} callback The callback function
   */
  addTabActivatedListener(callback) {
    api.tabs.onActivated.addListener(callback);
  },

  /**
   * Adds a listener for tab updated events
   * @param {Function} callback The callback function
   */
  addTabUpdatedListener(callback) {
    api.tabs.onUpdated.addListener(callback);
  },

  /**
   * Creates an alarm with the given name and options
   * @param {string} name The name of the alarm
   * @param {object} alarmInfo The alarm configuration
   */
  createAlarm(name, alarmInfo) {
    api.alarms.create(name, alarmInfo);
  },

  /**
   * Clears an alarm with the given name
   * @param {string} name The name of the alarm to clear
   * @returns {Promise<boolean>} True if the alarm was cleared
   */
  async clearAlarm(name) {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        return await browser.alarms.clear(name);
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.alarms.clear(name, (wasCleared) => {
            resolve(wasCleared);
          });
        });
      }
    } catch (error) {
      console.error(`Error clearing alarm ${name}:`, error);
      return false;
    }
  },

  /**
   * Adds a listener for alarm events
   * @param {Function} callback The callback function
   */
  addAlarmListener(callback) {
    api.alarms.onAlarm.addListener(callback);
  },

  /**
   * Adds a listener for runtime.onInstalled events
   * @param {Function} callback The callback function
   */
  addRuntimeInstalledListener(callback) {
    api.runtime.onInstalled.addListener(callback);
  },

  /**
   * Gets data from local storage
   * @param {string|Array<string>} keys The key(s) to retrieve
   * @returns {Promise<object>} The stored data
   */
  async getStorage(keys) {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        return await browser.storage.local.get(keys);
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.storage.local.get(keys, (result) => {
            resolve(result);
          });
        });
      }
    } catch (error) {
      console.error('Error getting storage:', error);
      return {};
    }
  },

  /**
   * Saves data to local storage
   * @param {object} data The data to save
   * @returns {Promise<void>}
   */
  async setStorage(data) {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        await browser.storage.local.set(data);
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.storage.local.set(data, () => {
            resolve();
          });
        });
      }
    } catch (error) {
      console.error('Error setting storage:', error);
    }
  },

  /**
   * Removes data from local storage
   * @param {string|Array<string>} keys The key(s) to remove
   * @returns {Promise<void>}
   */
  async removeStorage(keys) {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        await browser.storage.local.remove(keys);
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.storage.local.remove(keys, () => {
            resolve();
          });
        });
      }
    } catch (error) {
      console.error('Error removing storage:', error);
    }
  },

  /**
   * Clears all data from local storage
   * @returns {Promise<void>}
   */
  async clearStorage() {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        await browser.storage.local.clear();
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.storage.local.clear(() => {
            resolve();
          });
        });
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },

  /**
   * Adds a listener for idle state changes
   * @param {Function} callback The callback function
   * @param {number} detectionIntervalInSeconds The detection interval in seconds
   */
  addIdleStateListener(callback, detectionIntervalInSeconds = 60) {
    if (!api.idle) return;
    
    api.idle.setDetectionInterval(detectionIntervalInSeconds);
    api.idle.onStateChanged.addListener(callback);
  },

  /**
   * Gets the current idle state
   * @returns {Promise<string|null>} The idle state ('active', 'idle', or 'locked')
   */
  async getIdleState() {
    if (!api.idle) return null;

    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        return await browser.idle.queryState(60);
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.idle.queryState(60, (state) => {
            resolve(state);
          });
        });
      }
    } catch (error) {
      console.error('Error getting idle state:', error);
      return null;
    }
  }
};

module.exports = { default: BrowserApiService }; 