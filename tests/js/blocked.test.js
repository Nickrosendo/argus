/**
 * @jest-environment jsdom
 */

// Mock DOM elements
document.body.innerHTML = `
  <div id="blocked-domain"></div>
  <div id="unblocks-remaining"></div>
  <button id="go-back"></button>
  <button id="open-settings"></button>
  <button id="remove-from-blocklist"></button>
  <button id="unblock-5min"></button>
  <button id="unblock-15min"></button>
  <button id="unblock-30min"></button>
`;

// Mock URL parameters
Object.defineProperty(window, 'location', {
  value: {
    search: '?domain=example.com&url=https://example.com/test',
    href: '',
  },
  writable: true,
});

// Mock history
Object.defineProperty(window, 'history', {
  value: {
    back: jest.fn(),
  },
  writable: true,
});

// Mock alert
global.alert = jest.fn();

describe('blocked.js functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset DOM
    document.getElementById('blocked-domain').textContent = '';
    document.getElementById('unblocks-remaining').textContent = '';
    
    // Reset location
    window.location.href = '';
  });

  it('should have DOM elements available', () => {
    expect(document.getElementById('blocked-domain')).toBeTruthy();
    expect(document.getElementById('unblocks-remaining')).toBeTruthy();
    expect(document.getElementById('go-back')).toBeTruthy();
    expect(document.getElementById('open-settings')).toBeTruthy();
    expect(document.getElementById('remove-from-blocklist')).toBeTruthy();
  });

  it('should extract URL parameters correctly', () => {
    const urlParams = new URLSearchParams(window.location.search);
    expect(urlParams.get('domain')).toBe('example.com');
    expect(urlParams.get('url')).toBe('https://example.com/test');
  });

  it('should have browser API available', () => {
    const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
    expect(browserAPI).toBeDefined();
    expect(browserAPI.storage).toBeDefined();
    expect(browserAPI.runtime).toBeDefined();
  });

  it('should handle DOMContentLoaded event simulation', async () => {
    const today = new Date().toDateString();
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        unblockData: {
          date: today,
          remaining: 2,
          temporaryUnblocks: {}
        }
      });
    });

    // Create a mock event listener function that would be called on DOMContentLoaded
    const mockDOMContentLoadedHandler = async () => {
      // Simulate the blocked domain display
      const urlParams = new URLSearchParams(window.location.search);
      const blockedDomain = urlParams.get('domain');
      if (blockedDomain) {
        document.getElementById('blocked-domain').textContent = blockedDomain;
      }

      // Get the remaining unblock count for today
      await new Promise(resolve => {
        global.chrome.storage.local.get(['blockedSites', 'unblockData'], (result) => {
          const data = result;
          if (!data.unblockData || data.unblockData.date !== today) {
            document.getElementById('unblocks-remaining').textContent = '3';
          } else {
            document.getElementById('unblocks-remaining').textContent = data.unblockData.remaining;
          }
          resolve();
        });
      });
    };

    // Execute the handler
    await mockDOMContentLoadedHandler();

    // Verify the storage was accessed
    expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['blockedSites', 'unblockData'], expect.any(Function));
    
    // Verify DOM was updated
    expect(document.getElementById('blocked-domain').textContent).toBe('example.com');
    expect(document.getElementById('unblocks-remaining').textContent).toBe('2');
  });

  it('should simulate button click events', () => {
    const goBackBtn = document.getElementById('go-back');
    const openSettingsBtn = document.getElementById('open-settings');
    
    // Add event listeners manually for testing
    goBackBtn.addEventListener('click', () => {
      window.history.back();
    });
    
    openSettingsBtn.addEventListener('click', () => {
      global.chrome.runtime.sendMessage({ 
        action: 'openBlocklistSettings' 
      });
    });

    // Test go back button
    goBackBtn.click();
    expect(window.history.back).toHaveBeenCalled();

    // Test open settings button
    openSettingsBtn.click();
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'openBlocklistSettings'
    });
  });

  // Test utility functions that are available in the global scope when script loads
  describe('utility function patterns', () => {
    it('should work with getTodayDateString pattern', () => {
      // Test the pattern used in blocked.js
      const getTodayDateString = () => new Date().toDateString();
      const today = new Date().toDateString();
      expect(getTodayDateString()).toBe(today);
    });

    it('should work with getStorageData pattern', async () => {
      const getStorageData = () => {
        return new Promise((resolve) => {
          global.chrome.storage.local.get(['blockedSites', 'unblockData'], (result) => {
            resolve(result);
          });
        });
      };
      
      global.chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ testData: 'test' });
      });

      const result = await getStorageData();
      expect(result).toEqual({ testData: 'test' });
    });

    it('should work with setStorageData pattern', async () => {
      const setStorageData = (data) => {
        return new Promise((resolve) => {
          global.chrome.storage.local.set(data, () => {
            resolve();
          });
        });
      };
      
      global.chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      await setStorageData({ testData: 'test' });
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ testData: 'test' }, expect.any(Function));
    });

    it('should work with removeFromBlocklist pattern', async () => {
      const removeFromBlocklist = async (domain) => {
        // Mock the function logic from blocked.js
        global.chrome.storage.local.get.mockImplementation((keys, callback) => {
          callback({ blockedSites: ['example.com', 'test.com'] });
        });
        
        const data = await new Promise(resolve => {
          global.chrome.storage.local.get(['blockedSites', 'unblockData'], resolve);
        });
        
        const blockedSites = data.blockedSites || [];
        const updatedBlocklist = blockedSites.filter(site => site !== domain);
        
        await new Promise(resolve => {
          global.chrome.storage.local.set({ blockedSites: updatedBlocklist }, resolve);
        });
        
        global.chrome.runtime.sendMessage({ 
          action: 'updateBlockedSites' 
        });
      };
      
      global.chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      await removeFromBlocklist('example.com');
      
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        { blockedSites: ['test.com'] },
        expect.any(Function)
      );
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'updateBlockedSites'
      });
    });

    it('should work with resetDailyUnblocks pattern', async () => {
      const resetDailyUnblocks = async () => {
        const unblockData = {
          date: new Date().toDateString(),
          remaining: 3,
          temporaryUnblocks: {}
        };
        
        await new Promise(resolve => {
          global.chrome.storage.local.set({ unblockData }, resolve);
        });
        
        return unblockData;
      };
      
      global.chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      const result = await resetDailyUnblocks();
      const today = new Date().toDateString();
      
      expect(result).toEqual({
        date: today,
        remaining: 3,
        temporaryUnblocks: {}
      });
      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        unblockData: {
          date: today,
          remaining: 3,
          temporaryUnblocks: {}
        }
      }, expect.any(Function));
    });

    it('should work with temporaryUnblock pattern', async () => {
      const temporaryUnblock = async (minutes) => {
        const domain = 'example.com';
        const today = new Date().toDateString();
        
        // Mock storage get
        global.chrome.storage.local.get.mockImplementation((keys, callback) => {
          callback({
            unblockData: {
              date: today,
              remaining: 2,
              temporaryUnblocks: {}
            }
          });
        });
        
        const data = await new Promise(resolve => {
          global.chrome.storage.local.get(['blockedSites', 'unblockData'], resolve);
        });
        
        if (data.unblockData.remaining <= 0) {
          global.alert('You have no unblocks remaining today. Try again tomorrow.');
          return;
        }
        
        data.unblockData.remaining--;
        const expirationTime = Date.now() + (minutes * 60 * 1000);
        data.unblockData.temporaryUnblocks[domain] = expirationTime;
        
        await new Promise(resolve => {
          global.chrome.storage.local.set({ unblockData: data.unblockData }, resolve);
        });
        
        global.chrome.runtime.sendMessage({ 
          action: 'updateTemporaryUnblocks',
          domain: domain,
          expirationTime: expirationTime
        });
      };
      
      global.chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      await temporaryUnblock(5);
      
      expect(global.chrome.storage.local.set).toHaveBeenCalled();
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updateTemporaryUnblocks',
          domain: 'example.com'
        })
      );
    });

    it('should handle temporaryUnblock when no unblocks remaining', async () => {
      const temporaryUnblock = async () => {
        const today = new Date().toDateString();
        
        global.chrome.storage.local.get.mockImplementation((keys, callback) => {
          callback({
            unblockData: {
              date: today,
              remaining: 0,
              temporaryUnblocks: {}
            }
          });
        });
        
        const data = await new Promise(resolve => {
          global.chrome.storage.local.get(['blockedSites', 'unblockData'], resolve);
        });
        
        if (data.unblockData.remaining <= 0) {
          global.alert('You have no unblocks remaining today. Try again tomorrow.');
          return;
        }
      };

      await temporaryUnblock();
      
      expect(global.alert).toHaveBeenCalledWith('You have no unblocks remaining today. Try again tomorrow.');
    });
  });

  it('should work with browser API when available', () => {
    const originalChrome = global.chrome;
    global.chrome = undefined;
    
    const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
    expect(browserAPI).toBe(global.browser);
    
    // Cleanup
    global.chrome = originalChrome;
  });
});
describe('blocked page theme', () => {
  const loadBlockedPage = (settings) => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ settings });
    });
    jest.isolateModules(() => {
      require('../../js/blocked.js');
    });
  };

  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it('applies a stored light theme', () => {
    loadBlockedPage({ theme: 'light' });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('ignores an unknown theme value', () => {
    loadBlockedPage({ theme: 'nonsense' });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
