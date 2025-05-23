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
  sendMessage: jest.fn()
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

// Mock document.createElement for charts
document.createElement = jest.fn().mockImplementation((tag) => {
  if (tag === 'canvas') {
    return {
      getContext: jest.fn().mockReturnValue({
        measureText: jest.fn().mockReturnValue({ width: 100 }),
        fillText: jest.fn(),
        clearRect: jest.fn(),
        fillRect: jest.fn(),
        beginPath: jest.fn(),
        arc: jest.fn(),
        fill: jest.fn(),
        stroke: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn()
      }),
      width: 400,
      height: 400
    };
  }
  return {};
}); 