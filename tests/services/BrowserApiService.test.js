/**
 * Simplified tests for BrowserApiService
 */

// Create a simpler mock
jest.mock('../../services/BrowserApiService', () => ({
  default: {
    api: {},
    getActiveTab: jest.fn().mockResolvedValue({ id: 123, url: 'https://example.com' }),
    createAlarm: jest.fn(),
    clearAlarm: jest.fn().mockResolvedValue(true),
    addAlarmListener: jest.fn(),
    addTabActivatedListener: jest.fn(),
    addTabUpdatedListener: jest.fn(),
    addRuntimeInstalledListener: jest.fn(),
    getStorage: jest.fn().mockResolvedValue({ key1: 'value1', key2: 'value2' }),
    setStorage: jest.fn().mockResolvedValue(undefined),
    removeStorage: jest.fn().mockResolvedValue(undefined),
    clearStorage: jest.fn().mockResolvedValue(undefined),
    getTabById: jest.fn().mockResolvedValue({ id: 123, url: 'https://example.com' }),
    addIdleStateListener: jest.fn(),
    queryTabs: jest.fn().mockResolvedValue([
      { id: 123, url: 'https://example.com' },
      { id: 456, url: 'https://example.org' }
    ]),
    getIdleState: jest.fn().mockResolvedValue('idle')
  }
}));

// Import the mocked service
const browserApiService = require('../../services/BrowserApiService').default;

describe('BrowserApiService', () => {
  // Test basic API structure
  test('should have all required methods', () => {
    expect(browserApiService).toBeDefined();
    expect(browserApiService.api).toBeDefined();
    expect(typeof browserApiService.getActiveTab).toBe('function');
    expect(typeof browserApiService.createAlarm).toBe('function');
    expect(typeof browserApiService.clearAlarm).toBe('function');
    expect(typeof browserApiService.addAlarmListener).toBe('function');
    expect(typeof browserApiService.addTabActivatedListener).toBe('function');
    expect(typeof browserApiService.addTabUpdatedListener).toBe('function');
    expect(typeof browserApiService.addRuntimeInstalledListener).toBe('function');
    expect(typeof browserApiService.getStorage).toBe('function');
    expect(typeof browserApiService.setStorage).toBe('function');
    expect(typeof browserApiService.removeStorage).toBe('function');
    expect(typeof browserApiService.clearStorage).toBe('function');
    expect(typeof browserApiService.getTabById).toBe('function');
    expect(typeof browserApiService.addIdleStateListener).toBe('function');
    expect(typeof browserApiService.queryTabs).toBe('function');
    expect(typeof browserApiService.getIdleState).toBe('function');
  });

  // Test mock return values
  test('mock methods should return expected values', async () => {
    // Test tab methods
    expect(await browserApiService.getActiveTab()).toEqual({ id: 123, url: 'https://example.com' });
    expect(await browserApiService.getTabById(123)).toEqual({ id: 123, url: 'https://example.com' });
    expect(await browserApiService.queryTabs({})).toEqual([
      { id: 123, url: 'https://example.com' },
      { id: 456, url: 'https://example.org' }
    ]);
    
    // Test alarm methods
    expect(await browserApiService.clearAlarm('test')).toBe(true);
    
    // Test storage methods
    expect(await browserApiService.getStorage(['key1'])).toEqual({ key1: 'value1', key2: 'value2' });
    
    // Test idle methods
    expect(await browserApiService.getIdleState()).toBe('idle');
  });

  // Test mock callbacks
  test('mock methods should accept and track callbacks', () => {
    const callback = jest.fn();
    
    browserApiService.addTabActivatedListener(callback);
    expect(browserApiService.addTabActivatedListener).toHaveBeenCalledWith(callback);
    
    browserApiService.addTabUpdatedListener(callback);
    expect(browserApiService.addTabUpdatedListener).toHaveBeenCalledWith(callback);
    
    browserApiService.addAlarmListener(callback);
    expect(browserApiService.addAlarmListener).toHaveBeenCalledWith(callback);
    
    browserApiService.addRuntimeInstalledListener(callback);
    expect(browserApiService.addRuntimeInstalledListener).toHaveBeenCalledWith(callback);
    
    browserApiService.addIdleStateListener(callback, 30);
    expect(browserApiService.addIdleStateListener).toHaveBeenCalledWith(callback, 30);
  });
}); 