/**
 * Runs the real background service worker against an in-memory fake of the
 * browser extension API, with a controllable clock. Unlike the unit tests that
 * mock BrowserApiService, nothing inside the worker is mocked here.
 */

// Real macrotask scheduler: unaffected by jest's fake timers and absent from jsdom
const { setImmediate } = require('timers');

const START = new Date('2025-07-21T10:00:00').getTime();
const EVENTS = ['alarm', 'tabActivated', 'tabUpdated', 'focus', 'idle', 'message', 'beforeNavigate', 'storageChanged'];

// Let pending promise chains and storage callbacks run
const flush = async () => {
  for (let i = 0; i < 15; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

function createFakeBrowser() {
  const fake = {
    local: {},
    session: {},
    alarms: {},
    alarmCreates: 0,
    listeners: {},
    idleState: 'active',
    idleDetectionInterval: null,
    idleQueryIntervals: [],
    focusedWindow: { id: 1, focused: true },
    tabs: {
      10: { id: 10, windowId: 1, active: true, url: 'https://example.com/a', title: 'Example' },
      20: { id: 20, windowId: 2, active: true, url: 'https://background-window.com/', title: 'Background' },
    },
    rules: [],
  };

  const event = (name) => ({
    addListener: (listener) => {
      (fake.listeners[name] = fake.listeners[name] || []).push(listener);
    },
  });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const pick = (store, keys) => {
    const out = {};
    [].concat(keys).forEach((key) => {
      if (key in store) out[key] = clone(store[key]);
    });
    return out;
  };
  const later = (callback, value) => Promise.resolve().then(() => callback && callback(value));

  fake.chrome = {
    storage: {
      local: {
        get: (keys, callback) => later(callback, pick(fake.local, keys)),
        set: (data, callback) => {
          Object.assign(fake.local, clone(data));
          return later(callback);
        },
        remove: (keys, callback) => later(callback),
        clear: (callback) => later(callback),
      },
      onChanged: event('storageChanged'),
      session: {
        get: async (keys) => pick(fake.session, keys),
        set: async (data) => {
          Object.assign(fake.session, clone(data));
        },
      },
    },
    alarms: {
      get: async (name) => fake.alarms[name],
      create: (name, info) => {
        fake.alarms[name] = info;
        fake.alarmCreates++;
      },
      clear: (name, callback) => later(callback, true),
      onAlarm: event('alarm'),
    },
    tabs: {
      query: (query, callback) =>
        later(callback, Object.values(fake.tabs).filter((tab) => tab.windowId === fake.focusedWindow.id && tab.active)),
      get: (tabId, callback) => later(callback, fake.tabs[tabId]),
      create: async () => ({}),
      update: async () => ({}),
      onActivated: event('tabActivated'),
      onUpdated: event('tabUpdated'),
    },
    windows: {
      getLastFocused: async () => fake.focusedWindow,
      onFocusChanged: event('focus'),
    },
    idle: {
      setDetectionInterval: (seconds) => {
        fake.idleDetectionInterval = seconds;
      },
      queryState: (seconds, callback) => {
        fake.idleQueryIntervals.push(seconds);
        return later(callback, fake.idleState);
      },
      onStateChanged: event('idle'),
    },
    runtime: {
      onMessage: event('message'),
      onInstalled: event('installed'),
      getURL: (path) => `chrome-extension://test/${path}`,
      sendMessage: () => {},
      lastError: null,
    },
    webNavigation: {
      onBeforeNavigate: event('beforeNavigate'),
      onCommitted: event('committed'),
    },
    declarativeNetRequest: {
      getDynamicRules: (callback) => later(callback, fake.rules),
      updateDynamicRules: async ({ addRules }) => {
        fake.rules = addRules;
      },
    },
  };

  return fake;
}

describe('background service worker', () => {
  let fake;

  // Load a fresh worker instance; listeners from a previous instance are gone,
  // exactly as when the browser restarts a suspended service worker
  const startWorker = async ({ waitForInit = true } = {}) => {
    fake.listeners = {};
    jest.resetModules();
    require('../../background.js');
    const registeredSynchronously = EVENTS.filter((name) => (fake.listeners[name] || []).length === 1);
    if (waitForInit) await flush();
    return registeredSynchronously;
  };

  const emit = async (name, ...args) => {
    (fake.listeners[name] || []).forEach((listener) => listener(...args));
    await flush();
  };
  const advance = async (ms) => {
    jest.advanceTimersByTime(ms);
    await flush();
  };
  const fireTrackerAlarm = () => emit('alarm', { name: 'update-tracker' });
  const send = async (message) => {
    const responses = [];
    fake.listeners.message.forEach((listener) => listener(message, {}, (response) => responses.push(response)));
    await flush();
    return responses;
  };
  const blurBrowser = () => {
    fake.focusedWindow = { id: 1, focused: false };
    return emit('focus', -1);
  };
  const focusBrowser = () => {
    fake.focusedWindow = { id: 1, focused: true };
    return emit('focus', 1);
  };
  const totalTime = () => fake.local.totalTime || 0;
  const blockedDomainsInRules = () =>
    ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'].filter((domain) => JSON.stringify(fake.rules).includes(domain));

  beforeEach(() => {
    jest.useFakeTimers({ now: START, doNotFake: ['nextTick', 'queueMicrotask'] });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fake = createFakeBrowser();
    delete global.browser;
    global.chrome = fake.chrome;
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('startup', () => {
    it('registers every listener synchronously, before any state is loaded', async () => {
      const registeredSynchronously = await startWorker({ waitForInit: false });

      expect(registeredSynchronously).toEqual(EVENTS);
      await flush();
    });

    it('creates the alarms once and leaves them alone on restart', async () => {
      await startWorker();
      expect(fake.alarmCreates).toBe(3);

      await startWorker();
      expect(fake.alarmCreates).toBe(3);
    });

    it('does not wait for the network when a token is stored', async () => {
      fake.local.authToken = 'stored-token';
      global.fetch = jest.fn(() => new Promise(() => {})); // never answers

      await startWorker();
      const [status] = await send({ action: 'getTrackingStatus' });

      expect(status.status.isAuthenticated).toBe(true);
      expect(status.status.hasCurrentTab).toBe(true);
    });

    it('keeps the user signed in when the token cannot be verified offline', async () => {
      fake.local.authToken = 'stored-token';

      await startWorker();

      expect(fake.local.authToken).toBe('stored-token');
    });
  });

  describe('time accounting', () => {
    beforeEach(() => startWorker());

    it('credits time on the focused tab', async () => {
      await advance(5000);

      expect(totalTime()).toBe(5000);
      expect(fake.local.sites['example.com'].totalTime).toBe(5000);
    });

    it('does not count an interval twice when the alarm and the timer both fire', async () => {
      await advance(5000);
      await fireTrackerAlarm();
      await advance(3000);
      await fireTrackerAlarm();
      await advance(2000);

      expect(totalTime()).toBe(10000);
    });

    it('counts one visit for one continuous stay', async () => {
      await advance(15000);

      expect(fake.local.sites['example.com'].visits).toBe(1);
    });

    it('stops counting while the browser is not focused', async () => {
      await advance(5000);
      jest.advanceTimersByTime(3000);
      await blurBrowser();
      expect(totalTime()).toBe(8000);

      for (let i = 0; i < 3; i++) {
        jest.advanceTimersByTime(30000);
        await fireTrackerAlarm();
      }
      expect(totalTime()).toBe(8000);

      await focusBrowser();
      await advance(5000);
      expect(totalTime()).toBe(13000);
    });

    it('ignores a tab changing in a window that is not focused', async () => {
      fake.tabs[20].url = 'https://background-window.com/next';
      await emit('tabUpdated', 20, { url: fake.tabs[20].url }, fake.tabs[20]);
      await advance(5000);

      expect(fake.local.sites['background-window.com']).toBeUndefined();
      expect(fake.local.sites['example.com'].totalTime).toBe(5000);
    });

    it('credits the old site and starts the new one when the tab navigates', async () => {
      await advance(5000);
      jest.advanceTimersByTime(2000);
      fake.tabs[10].url = 'https://other.org/';
      await emit('tabUpdated', 10, { url: fake.tabs[10].url }, fake.tabs[10]);
      await advance(5000);

      expect(fake.local.sites['example.com'].totalTime).toBe(7000);
      expect(fake.local.sites['other.org'].totalTime).toBe(5000);
    });

    it('pauses while the user is idle and does not count the time away', async () => {
      await advance(5000);
      fake.idleState = 'idle';
      await emit('idle', 'idle');
      jest.advanceTimersByTime(120000);
      await fireTrackerAlarm();
      expect(totalTime()).toBe(5000);

      fake.idleState = 'active';
      await emit('idle', 'active');
      await advance(5000);
      expect(totalTime()).toBe(10000);
    });

    it('archives the previous day on the first write after midnight', async () => {
      await advance(5000);
      const yesterday = new Date(START).toDateString();

      jest.setSystemTime(new Date('2025-07-22T00:00:01').getTime());
      await focusBrowser(); // restarts the clock on the new day
      await advance(5000);

      expect(fake.local.history[yesterday].totalTime).toBe(5000);
      expect(fake.local.lastDate).toBe(new Date('2025-07-22T00:00:06').toDateString());
      expect(totalTime()).toBe(5000);
    });
  });

  describe('idle threshold setting', () => {
    const lastQueryInterval = () => fake.idleQueryIntervals[fake.idleQueryIntervals.length - 1];

    it('uses five minutes when nothing is stored', async () => {
      await startWorker();
      await advance(5000);

      expect(fake.idleDetectionInterval).toBe(300);
      expect(lastQueryInterval()).toBe(300);
    });

    it('uses the stored "consider idle after" setting, in minutes', async () => {
      fake.local.settings = { idleTime: 2 };

      await startWorker();
      await advance(5000);

      expect(fake.idleDetectionInterval).toBe(120);
      expect(lastQueryInterval()).toBe(120);
    });

    it('applies a changed setting without a restart', async () => {
      fake.local.settings = { idleTime: 2 };
      await startWorker();

      await emit('storageChanged', { settings: { newValue: { idleTime: 10 } } }, 'local');
      await advance(5000);

      expect(fake.idleDetectionInterval).toBe(600);
      expect(lastQueryInterval()).toBe(600);
    });

    it('ignores changes to other storage areas and keys', async () => {
      fake.local.settings = { idleTime: 2 };
      await startWorker();

      await emit('storageChanged', { settings: { newValue: { idleTime: 10 } } }, 'session');
      await emit('storageChanged', { sites: { newValue: {} } }, 'local');

      expect(fake.idleDetectionInterval).toBe(120);
    });

    it('falls back to five minutes for an unusable stored value', async () => {
      fake.local.settings = { idleTime: null };

      await startWorker();

      expect(fake.idleDetectionInterval).toBe(300);
    });
  });

  describe('service worker restart', () => {
    it('continues the clock of the tab that was being tracked', async () => {
      await startWorker();
      await advance(5000);
      jest.advanceTimersByTime(3000); // not written yet when the worker stops

      await startWorker();
      await advance(5000);

      expect(totalTime()).toBe(13000);
      expect(fake.local.sites['example.com'].visits).toBe(1);
    });

    it('credits the old tab and switches when the active tab changed meanwhile', async () => {
      await startWorker();
      await advance(5000);
      fake.tabs[10].url = 'https://other.org/';

      jest.advanceTimersByTime(2000);
      await startWorker();
      await advance(5000);

      expect(fake.local.sites['example.com'].totalTime).toBe(7000);
      expect(fake.local.sites['other.org'].totalTime).toBe(5000);
    });

    it('stays paused when restarted while the user is idle', async () => {
      await startWorker();
      await advance(5000);
      fake.idleState = 'idle';
      await emit('idle', 'idle');

      jest.advanceTimersByTime(60000);
      await startWorker();
      await fireTrackerAlarm();
      await advance(5000);

      expect(totalTime()).toBe(5000);
    });

    it('does not count the time away when the user returned while it was suspended', async () => {
      await startWorker();
      await advance(5000);
      fake.idleState = 'idle';
      await emit('idle', 'idle');

      jest.advanceTimersByTime(120000);
      fake.idleState = 'active';
      await startWorker();
      await advance(5000);

      expect(totalTime()).toBe(10000);
    });
  });

  describe('messages', () => {
    beforeEach(() => startWorker());

    it('answers a known action exactly once', async () => {
      const responses = await send({ action: 'getTrackingStatus' });

      expect(responses).toHaveLength(1);
      expect(responses[0].success).toBe(true);
    });

    it('answers an unknown action once with an error', async () => {
      const responses = await send({ action: 'no-such-action' });

      expect(responses).toEqual([{ success: false, error: 'Unknown action' }]);
    });

    it('answers a manual sync request without throwing', async () => {
      const responses = await send({ action: 'syncWithApi', manual: true });

      expect(responses).toEqual([{ success: true }]);
    });
  });

  describe('blocking rules', () => {
    beforeEach(async () => {
      fake.local.blockingEnabled = true;
      fake.local.blockedSites = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'];
    });

    it('enforces every site for a premium account', async () => {
      fake.local.freeMode = false;
      await startWorker();

      expect(blockedDomainsInRules()).toEqual(['a.com', 'b.com', 'c.com', 'd.com', 'e.com']);
    });

    it('enforces only three sites in free mode but keeps the stored list', async () => {
      fake.local.freeMode = true;
      await startWorker();

      expect(blockedDomainsInRules()).toEqual(['a.com', 'b.com', 'c.com']);
      expect(fake.local.blockedSites).toHaveLength(5);
    });

    it('lifts a temporary unblock and keeps it lifted when the list is edited', async () => {
      fake.local.freeMode = false;
      await startWorker();

      await send({ action: 'updateTemporaryUnblocks', domain: 'a.com', expirationTime: Date.now() + 300000 });
      expect(blockedDomainsInRules()).not.toContain('a.com');

      await send({ action: 'updateBlockedSites' });
      expect(blockedDomainsInRules()).toEqual(['b.com', 'c.com', 'd.com', 'e.com']);
    });

    it('removes all rules when blocking is turned off', async () => {
      fake.local.freeMode = false;
      await startWorker();

      fake.local.blockingEnabled = false;
      await send({ action: 'updateBlockedSites' });

      expect(fake.rules).toEqual([]);
    });
  });
});
