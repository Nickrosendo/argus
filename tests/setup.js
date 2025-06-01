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
  sendMessage: jest.fn(),
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