// Setup DOM environment for React Testing Library
import { TextEncoder, TextDecoder } from 'util';
import '@testing-library/jest-dom';

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock for browser APIs
const mockStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
  onChanged: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }
};

const mockTabs = {
  query: jest.fn(),
  get: jest.fn(),
  onActivated: {
    addListener: jest.fn()
  },
  onUpdated: {
    addListener: jest.fn()
  }
};

const mockAlarms = {
  create: jest.fn(),
  clear: jest.fn(),
  onAlarm: {
    addListener: jest.fn()
  }
};

const mockRuntime = {
  onInstalled: {
    addListener: jest.fn()
  },
  onMessage: {
    addListener: jest.fn()
  },
  sendMessage: jest.fn().mockImplementation((message) => {
    // Mock authentication responses
    if (message?.action === 'signin' || message?.action === 'signup') {
      return Promise.resolve({
        success: true,
        data: {
          token: `mock-token-${Date.now()}`,
          user: {
            id: `user-${Date.now()}`,
            email: message.action === 'signup' && message.email ? message.email : `${message.username}@example.com`,
            name: message.username
          }
        }
      });
    }
    
    if (message?.action === 'signout') {
      return Promise.resolve({
        success: true
      });
    }
    
    if (message?.action === 'checkAuthentication') {
      return Promise.resolve({
        isAuthenticated: false
      });
    }
    
    // Default response for other messages
    return Promise.resolve({ success: false });
  }),
  getURL: jest.fn((path) => `chrome-extension://test/${path}`)
};

// Mock Chrome API
global.chrome = {
  storage: mockStorage,
  tabs: mockTabs,
  alarms: mockAlarms,
  runtime: mockRuntime
};

// Mock Browser API (Firefox)
global.browser = {
  storage: mockStorage,
  tabs: mockTabs,
  alarms: mockAlarms,
  runtime: mockRuntime
};

// Mock localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }
}

global.localStorage = new LocalStorageMock();

// Mock window methods
global.window.addEventListener = jest.fn();
global.window.removeEventListener = jest.fn();
global.window.dispatchEvent = jest.fn();

// Enable React 18 act environment and silence console noise
global.IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
