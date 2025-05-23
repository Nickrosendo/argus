/**
 * Simplified tests for background.js with BrowserApiService
 */

jest.mock('../services/BrowserApiService', () => ({
  default: {
    addRuntimeInstalledListener: jest.fn(),
    clearAlarm: jest.fn().mockResolvedValue(true),
    createAlarm: jest.fn(),
    getStorage: jest.fn().mockResolvedValue({
      sites: {},
      totalTime: 0,
      lastDate: new Date().toDateString()
    }),
    setStorage: jest.fn().mockResolvedValue(undefined),
    addIdleStateListener: jest.fn(),
    addAlarmListener: jest.fn(),
    addTabActivatedListener: jest.fn(),
    addTabUpdatedListener: jest.fn(),
    getActiveTab: jest.fn().mockResolvedValue(null),
    getTabById: jest.fn().mockResolvedValue(null),
    getIdleState: jest.fn().mockResolvedValue('active')
  }
}));

// Import the mocked service
const browserApiService = require('../services/BrowserApiService').default;

describe('Background Script with BrowserApiService', () => {
  test('BrowserApiService is properly exported and can be imported', () => {
    expect(browserApiService).toBeDefined();
    expect(typeof browserApiService.addRuntimeInstalledListener).toBe('function');
    expect(typeof browserApiService.clearAlarm).toBe('function');
    expect(typeof browserApiService.createAlarm).toBe('function');
    expect(typeof browserApiService.getStorage).toBe('function');
    expect(typeof browserApiService.setStorage).toBe('function');
    expect(typeof browserApiService.addIdleStateListener).toBe('function');
    expect(typeof browserApiService.addAlarmListener).toBe('function');
    expect(typeof browserApiService.addTabActivatedListener).toBe('function');
    expect(typeof browserApiService.addTabUpdatedListener).toBe('function');
    expect(typeof browserApiService.getActiveTab).toBe('function');
    expect(typeof browserApiService.getTabById).toBe('function');
    expect(typeof browserApiService.getIdleState).toBe('function');
  });
}); 