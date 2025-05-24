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
    api.idle.setDetectionInterval(detectionIntervalInSeconds);
    api.idle.onStateChanged.addListener(callback);
  },

  /**
   * Gets the current idle state
   * @returns {Promise<string>} The idle state ('active', 'idle', or 'locked')
   */
  async getIdleState() {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        return await browser.idle.queryState(30);
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.idle.queryState(30, (state) => {
            resolve(state);
          });
        });
      }
    } catch (error) {
      console.error('Error getting idle state:', error);
      return 'active';
    }
  },

  /**
   * Updates the list of blocked websites
   * @param {Array<string>} blockedSites List of domains to block
   * @param {boolean} isBlockingEnabled Whether blocking is enabled
   * @returns {Promise<void>}
   */
  async updateBlockedSites(blockedSites, isBlockingEnabled) {
    try {
      // Generate rules for each site in the blocked list
      const rules = blockedSites.map((site, index) => ({
        id: index + 1, // Rule IDs must be positive integers
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: `||${site}/*`,
          resourceTypes: ["main_frame", "sub_frame"]
        }
      }));

      if (isBlockingEnabled && rules.length > 0) {
        // Clear existing rules and add new ones
        await api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: await this.getExistingRuleIds(),
          addRules: rules
        });
      } else {
        // Remove all rules if blocking is disabled
        await api.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: await this.getExistingRuleIds(),
          addRules: []
        });
      }
    } catch (error) {
      console.error('Error updating blocked sites:', error);
    }
  },

  /**
   * Gets all existing rule IDs
   * @returns {Promise<Array<number>>} Array of rule IDs
   */
  async getExistingRuleIds() {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        const rules = await browser.declarativeNetRequest.getDynamicRules();
        return rules.map(rule => rule.id);
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.declarativeNetRequest.getDynamicRules((rules) => {
            resolve(rules.map(rule => rule.id));
          });
        });
      }
    } catch (error) {
      console.error('Error getting existing rule IDs:', error);
      return [];
    }
  },

  /**
   * Gets the blocking status and list of blocked sites
   * @returns {Promise<{isEnabled: boolean, blockedSites: Array<string>}>}
   */
  async getBlockingStatus() {
    try {
      const result = await this.getStorage(['blockingEnabled', 'blockedSites']);
      return {
        isEnabled: result.blockingEnabled || false,
        blockedSites: result.blockedSites || []
      };
    } catch (error) {
      console.error('Error getting blocking status:', error);
      return { isEnabled: false, blockedSites: [] };
    }
  },

  /**
   * Adds a listener for runtime messages
   * @param {Function} callback The callback function
   */
  addRuntimeMessageListener(callback) {
    api.runtime.onMessage.addListener(callback);
  },

  /**
   * Adds a listener for web navigation events
   * @param {Function} callback The callback function
   */
  addWebNavigationListener(callback) {
    if (api.webNavigation) {
      api.webNavigation.onBeforeNavigate.addListener(callback);
    }
  },

  /**
   * Creates a tab with the given URL
   * @param {string} url The URL to open
   * @returns {Promise<object>} The created tab
   */
  async createTab(url) {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        return await browser.tabs.create({ url });
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.tabs.create({ url }, (tab) => {
            resolve(tab);
          });
        });
      }
    } catch (error) {
      console.error('Error creating tab:', error);
      return null;
    }
  },

  /**
   * Updates a tab with the given URL
   * @param {number} tabId The ID of the tab to update
   * @param {string} url The URL to navigate to
   * @returns {Promise<object>} The updated tab
   */
  async updateTab(tabId, url) {
    try {
      if (typeof browser !== 'undefined') {
        // Firefox
        return await browser.tabs.update(tabId, { url });
      } else {
        // Chrome
        return new Promise((resolve) => {
          chrome.tabs.update(tabId, { url }, (tab) => {
            resolve(tab);
          });
        });
      }
    } catch (error) {
      console.error('Error updating tab:', error);
      return null;
    }
  },

  /**
   * Gets the URL for an extension resource
   * @param {string} path The path to the resource
   * @returns {string} The extension URL
   */
  getExtensionUrl(path) {
    return api.runtime.getURL(path);
  }
};

// Export the service
module.exports = { default: BrowserApiService }; 