// Tests for browser storage functionality

describe('Browser Storage', () => {
  // Clear mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('chrome.storage.local.set should store data correctly', () => {
    const testData = {
      sites: {
        'example.com': {
          totalTime: 3600000,
          visits: 5
        }
      },
      totalTime: 3600000,
      authToken: null,
      userInfo: null,
      freeMode: false
    };
    
    chrome.storage.local.set(testData);
    
    expect(chrome.storage.local.set).toHaveBeenCalledWith(testData);
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
  });

  test('chrome.storage.local.get should retrieve data correctly', () => {
    const testCallback = jest.fn();
    const mockData = {
      sites: {
        'example.com': {
          totalTime: 3600000,
          visits: 5
        }
      },
      totalTime: 3600000,
      authToken: null,
      userInfo: null,
      freeMode: false
    };
    
    // Mock the get implementation to return our test data
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback(mockData);
    });
    
    chrome.storage.local.get(['sites', 'totalTime'], testCallback);
    
    expect(chrome.storage.local.get).toHaveBeenCalledWith(['sites', 'totalTime'], testCallback);
    expect(testCallback).toHaveBeenCalledWith(mockData);
  });

  test('browser API abstraction should work for both Chrome and Firefox', () => {
    // Define a simple function that uses browser API abstraction
    const storeData = (data) => {
      const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;
      browserAPI.storage.local.set(data);
    };
    
    const testData = { key: 'value' };
    
    // Test with Chrome
    global.browser = undefined;
    storeData(testData);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(testData);
    
    // Reset mock
    jest.clearAllMocks();
    
    // Test with Firefox (browser)
    global.browser = {
      storage: {
        local: {
          set: jest.fn(),
          get: jest.fn()
        }
      }
    };
    
    storeData(testData);
    expect(browser.storage.local.set).toHaveBeenCalledWith(testData);
    
    // Reset for other tests
    global.browser = chrome;
  });

  test('should handle empty storage responses', () => {
    const testCallback = jest.fn();
    
    // Mock the get implementation to return empty data
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
    
    chrome.storage.local.get(['sites', 'totalTime'], testCallback);
    
    expect(testCallback).toHaveBeenCalledWith({});
  });

  test('should be able to clear storage', () => {
    chrome.storage.local.clear();
    expect(chrome.storage.local.clear).toHaveBeenCalled();
  });

  test('should be able to remove specific items from storage', () => {
    chrome.storage.local.remove('sites');
    expect(chrome.storage.local.remove).toHaveBeenCalledWith('sites');
  });
}); 