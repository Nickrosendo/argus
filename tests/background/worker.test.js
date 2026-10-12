/**
 * Runs the real background service worker against an in-memory fake of the
 * browser extension API, with a controllable clock. Unlike the unit tests that
 * mock BrowserApiService, nothing inside the worker is mocked here.
 */

// Real macrotask scheduler: unaffected by jest's fake timers and absent from jsdom
const { setImmediate } = require('timers');

const START = new Date('2025-07-21T10:00:00').getTime();
const EVENTS = ['alarm', 'tabActivated', 'tabUpdated', 'focus', 'idle', 'message', 'beforeNavigate', 'storageChanged', 'connect'];

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
      onConnect: event('connect'),
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
  // By default a popup is open, so totals are saved on every 5-second tick
  const startWorker = async ({ waitForInit = true, popupOpen = true } = {}) => {
    fake.listeners = {};
    jest.resetModules();
    require('../../background.js');
    const registeredSynchronously = EVENTS.filter((name) => (fake.listeners[name] || []).length === 1);
    if (popupOpen) openPopup();
    if (waitForInit) await flush();
    return registeredSynchronously;
  };

  // Connect a popup the way the real one does; returns a function that closes it
  const openPopup = () => {
    const disconnectListeners = [];
    const port = { name: 'popup', onDisconnect: { addListener: (listener) => disconnectListeners.push(listener) } };
    (fake.listeners.connect || []).forEach((listener) => listener(port));
    return () => disconnectListeners.forEach((listener) => listener(port));
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
    jest.spyOn(console, 'error').mockImplementation((...a) => process.env.DEBUG_WORKER && process.stderr.write('ERR ' + a.map(String).join(' ').slice(0, 300) + '\n'));
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

    it('counts www and non-www addresses of a site as one site', async () => {
      fake.tabs[10].url = 'https://www.example.com/other';
      await emit('tabUpdated', 10, { url: fake.tabs[10].url }, fake.tabs[10]);
      await advance(5000);

      expect(Object.keys(fake.local.sites)).toEqual(['example.com']);
      expect(fake.local.sites['example.com'].visits).toBe(1);
    });

    it('does not track browser pages, extension pages or local files', async () => {
      for (const url of ['chrome://extensions/', 'chrome-extension://abcdefgh/blocked.html', 'file:///home/me/notes.txt', 'about:blank']) {
        fake.tabs[10].url = url;
        await emit('tabUpdated', 10, { url }, fake.tabs[10]);
        await advance(10000);
      }

      expect(Object.keys(fake.local.sites || {})).toEqual([]);
      expect(totalTime()).toBe(0);
    });

    it('records the time under the hour of day it was spent in', async () => {
      await advance(10000); // 10:00 local time

      expect(fake.local.hourly).toHaveLength(24);
      expect(fake.local.hourly[10]).toBe(10000);
      expect(fake.local.hourly.reduce((sum, ms) => sum + ms, 0)).toBe(totalTime());
    });

    it('keeps the hourly breakdown with the day when it is archived', async () => {
      await advance(5000);
      const yesterday = new Date(START).toDateString();

      jest.setSystemTime(new Date('2025-07-22T00:00:01').getTime());
      await focusBrowser();
      await advance(5000);

      expect(fake.local.history[yesterday].hourly[10]).toBe(5000);
      expect(fake.local.hourly[0]).toBe(5000);
      expect(fake.local.hourly[10]).toBe(0);
    });

    it('does not track a page whose hostname would resolve to the object prototype', async () => {
      fake.tabs[10].url = 'http://__proto__/';
      await emit('tabUpdated', 10, { url: fake.tabs[10].url }, fake.tabs[10]);
      await advance(10000);

      expect({}.totalTime).toBeUndefined();
      expect({}.visits).toBeUndefined();
      expect(Object.keys(fake.local.sites || {})).toEqual([]);
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

  describe('pause tracking', () => {
    it('records nothing while paused and resumes without counting the pause', async () => {
      await startWorker();
      await advance(5000);

      await emit('storageChanged', { settings: { newValue: { trackingPaused: true } } }, 'local');
      await advance(60000);
      await fireTrackerAlarm();
      expect(totalTime()).toBe(5000);

      await emit('storageChanged', { settings: { newValue: { trackingPaused: false } } }, 'local');
      await advance(5000);
      expect(totalTime()).toBe(10000);
    });

    it('credits the time spent up to the moment tracking is paused', async () => {
      await startWorker();
      jest.advanceTimersByTime(3000);

      await emit('storageChanged', { settings: { newValue: { trackingPaused: true } } }, 'local');

      expect(totalTime()).toBe(3000);
    });

    it('stays paused across a restart and a tab switch', async () => {
      fake.local.settings = { trackingPaused: true };
      await startWorker();

      fake.tabs[10].url = 'https://other.org/';
      await emit('tabUpdated', 10, { url: fake.tabs[10].url }, fake.tabs[10]);
      await advance(30000);

      expect(totalTime()).toBe(0);
      expect(fake.local.sites || {}).toEqual({});
    });
  });

  describe('write frequency', () => {
    it('saves about every 30 seconds while no popup is open, without losing time', async () => {
      await startWorker({ popupOpen: false });

      await advance(25000);
      expect(totalTime()).toBe(0);

      await advance(5000);
      expect(totalTime()).toBe(30000);
    });

    it('saves immediately when a popup opens and every tick while it stays open', async () => {
      await startWorker({ popupOpen: false });
      await advance(12000);

      const closePopup = openPopup();
      await flush();
      expect(totalTime()).toBe(12000);

      await advance(5000);
      expect(totalTime()).toBe(17000);

      closePopup();
      await advance(10000);
      expect(totalTime()).toBe(17000);
    });

    it('still saves on a tab switch while no popup is open', async () => {
      await startWorker({ popupOpen: false });
      jest.advanceTimersByTime(7000);

      fake.tabs[10].url = 'https://other.org/';
      await emit('tabUpdated', 10, { url: fake.tabs[10].url }, fake.tabs[10]);

      expect(fake.local.sites['example.com'].totalTime).toBe(7000);
    });
  });

  describe('stored data from earlier versions', () => {
    it('merges www entries into their site once, in today and in history', async () => {
      const day = new Date(START - 86400000).toDateString();
      fake.local.lastDate = new Date(START).toDateString();
      fake.local.sites = {
        'www.example.com': { totalTime: 1000, visits: 1 },
        'example.com': { totalTime: 500, visits: 2 },
        'news.site.org': { totalTime: 200, visits: 1 },
      };
      fake.local.totalTime = 1700;
      fake.local.history = { [day]: { sites: { 'www.a.com': { totalTime: 300, visits: 1 } }, totalTime: 300, date: day } };

      await startWorker();

      expect(fake.local.sites['example.com']).toMatchObject({ totalTime: 1500, visits: 3 });
      expect(fake.local.sites['www.example.com']).toBeUndefined();
      expect(fake.local.sites['news.site.org'].totalTime).toBe(200);
      expect(Object.keys(fake.local.history[day].sites)).toEqual(['a.com']);
      expect(fake.local.dataVersion).toBe(2);
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

    it('answers a manual sync request honestly when it cannot sync', async () => {
      const responses = await send({ action: 'syncWithApi', manual: true });

      expect(responses).toEqual([{ success: false, error: 'Sync is turned off' }]);
    });
  });

  describe('cloud sync', () => {
    const today = new Date(START).toDateString();
    const yesterday = new Date(START - 86400000).toDateString();
    const twoDaysAgo = new Date(START - 2 * 86400000).toDateString();
    let uploads;
    let dayRequests;
    let remoteDays;

    // A minimal stand-in for the API
    const fakeApi = jest.fn(async (url, options = {}) => {
      const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

      if (url.endsWith('/auth/verify')) return json({ verified: true });
      if (url.endsWith('/browser-usage/sync')) {
        uploads.push(JSON.parse(options.body));
        return json({ id: 1 }, 201);
      }
      if (url.includes('/browser-usage/days')) {
        dayRequests.push(new URL(url, 'http://api.test').searchParams); // no API host is configured under test
        return json({ days: remoteDays });
      }
      return json({ message: 'not found' }, 404);
    });

    beforeEach(() => {
      uploads = [];
      dayRequests = [];
      remoteDays = {};
      fakeApi.mockClear();
      global.fetch = fakeApi;
      fake.local.authToken = 'stored-token';
      fake.local.freeMode = false;
      fake.local.syncEnabled = true; // the user turned sync on
      fake.local.deviceId = 'device-1';
      fake.local.lastDate = today;
      fake.local.sites = { 'example.com': { totalTime: 60000, visits: 2 } };
      fake.local.totalTime = 60000;
      fake.local.history = {
        [yesterday]: { sites: { 'a.com': { totalTime: 1000 } }, totalTime: 1000, date: yesterday },
        [twoDaysAgo]: { sites: { 'b.com': { totalTime: 2000 } }, totalTime: 2000, date: twoDaysAgo },
      };
    });

    it('uploads today and the finished days, keyed by date', async () => {
      await startWorker();
      await send({ action: 'syncWithApi', manual: true });

      expect(uploads).toHaveLength(1);
      expect(uploads[0].deviceId).toBe('device-1');
      expect(uploads[0].userId).toBeUndefined();
      expect(Object.keys(uploads[0].data.days).sort()).toEqual(['2025-07-19', '2025-07-20', '2025-07-21']);
      expect(uploads[0].data.days['2025-07-21'].totalTime).toBe(60000);
      expect(uploads[0].data.days['2025-07-20'].sites['a.com'].totalTime).toBe(1000);
    });

    it('uploads a finished day only once, but today every time', async () => {
      await startWorker();
      await send({ action: 'syncWithApi', manual: true });
      await send({ action: 'syncWithApi', manual: true });

      expect(fake.local.syncedDays).toEqual(['2025-07-19', '2025-07-20']);
      expect(Object.keys(uploads[1].data.days)).toEqual(['2025-07-21']);
    });

    it('stores what the other devices recorded, without touching local data', async () => {
      remoteDays = {
        '2025-07-21': { sites: { 'phone.com': { totalTime: 5000 } }, totalTime: 5000 },
        '2025-07-20': { sites: { 'a.com': { totalTime: 700 } }, totalTime: 700 },
      };

      await startWorker();
      await send({ action: 'syncWithApi', manual: true });

      expect(dayRequests[0].get('excludeDeviceId')).toBe('device-1');
      expect(dayRequests[0].get('since')).toBe('2025-06-21');
      expect(fake.local.remoteDays[today].sites['phone.com'].totalTime).toBe(5000);
      expect(fake.local.remoteDays[yesterday].totalTime).toBe(700);
      expect(fake.local.history[yesterday].totalTime).toBe(1000);
      expect(fake.local.sites['phone.com']).toBeUndefined();
    });

    it('does not mark days as uploaded when the upload fails', async () => {
      global.fetch = jest.fn(async (url) =>
        url.endsWith('/auth/verify')
          ? { ok: true, status: 200, json: async () => ({}) }
          : { ok: false, status: 500, json: async () => ({ message: 'boom' }) }
      );

      await startWorker();
      await send({ action: 'syncWithApi', manual: true });

      expect(fake.local.syncedDays).toBeUndefined();
    });

    it('uploads nothing until the user turns sync on', async () => {
      delete fake.local.syncEnabled;

      await startWorker();
      const [response] = await send({ action: 'syncWithApi', manual: true });
      jest.advanceTimersByTime(20 * 60000);
      await emit('alarm', { name: 'api-sync' });

      expect(response).toEqual({ success: false, error: 'Sync is turned off' });
      expect(uploads).toHaveLength(0);
      expect(dayRequests).toHaveLength(0);
    });

    it('does not upload page titles', async () => {
      fake.local.sites = { 'mail.example.com': { totalTime: 60000, visits: 1, title: 'Re: your test results', favicon: 'f.ico' } };

      await startWorker();
      await send({ action: 'syncWithApi', manual: true });

      const uploaded = uploads[0].data.days['2025-07-21'].sites['mail.example.com'];
      expect(uploaded).toEqual({ totalTime: 60000, visits: 1, favicon: 'f.ico' });
      expect(JSON.stringify(uploads[0])).not.toContain('test results');
      // The title is still available locally
      expect(fake.local.sites['mail.example.com'].title).toBe('Re: your test results');
    });

    it('erases the synced data on request and turns sync off', async () => {
      const deletes = [];
      global.fetch = jest.fn(async (url, options = {}) => {
        if (options.method === 'DELETE') {
          deletes.push(url);
          return { ok: true, status: 200, json: async () => ({ deleted: 2 }) };
        }
        return fakeApi(url, options);
      });
      remoteDays = { '2025-07-21': { sites: {}, totalTime: 5000 } };
      await startWorker();
      await send({ action: 'syncWithApi', manual: true });

      const [response] = await send({ action: 'deleteSyncedData' });

      expect(response).toEqual({ success: true, deleted: 2 });
      expect(deletes).toHaveLength(1);
      expect(deletes[0]).toMatch(/\/browser-usage$/);
      expect(fake.local.syncEnabled).toBe(false);
      expect(fake.local.remoteDays).toEqual({});
      expect(fake.local.syncedDays).toEqual([]);

      // Nothing is uploaded again afterwards
      const before = uploads.length;
      await send({ action: 'syncWithApi', manual: true });
      expect(uploads).toHaveLength(before);
    });

    it('keeps sync on when erasing fails, and says so', async () => {
      global.fetch = jest.fn(async (url, options = {}) =>
        options.method === 'DELETE'
          ? { ok: false, status: 500, json: async () => ({ message: 'boom' }) }
          : fakeApi(url, options)
      );
      await startWorker();

      const [response] = await send({ action: 'deleteSyncedData' });

      expect(response).toEqual({ success: false, error: 'boom' });
      expect(fake.local.syncEnabled).toBe(true);
    });

    it('does not sync for a free account', async () => {
      fake.local.freeMode = true;

      await startWorker();
      await send({ action: 'syncWithApi', manual: true });

      expect(uploads).toHaveLength(0);
    });

    it('forgets the other devices\' data on sign-out', async () => {
      remoteDays = { '2025-07-21': { sites: {}, totalTime: 5000 } };
      await startWorker();
      await send({ action: 'syncWithApi', manual: true });
      expect(Object.keys(fake.local.remoteDays)).toHaveLength(1);

      await send({ action: 'signout' });

      expect(fake.local.remoteDays).toEqual({});
      expect(fake.local.syncedDays).toEqual([]);
      // The next account on this browser starts with sync off
      expect(fake.local.syncEnabled).toBe(false);
    });
  });

  describe('focus sessions', () => {
    const fireAlarm = (name) => emit('alarm', { name });

    beforeEach(() => {
      fake.local.freeMode = false;
      fake.local.blockedSites = ['a.com', 'b.com'];
      fake.local.blockingEnabled = false; // blocking switched off outside sessions
    });

    it('blocks the block list for the length of the session, even with blocking switched off', async () => {
      await startWorker();
      expect(fake.rules).toEqual([]);

      const [response] = await send({ action: 'startFocusSession', minutes: 25 });

      expect(response.success).toBe(true);
      expect(blockedDomainsInRules()).toEqual(['a.com', 'b.com']);
      expect(fake.local.focusSession.endsAt).toBe(Date.now() + 25 * 60000);
      expect(fake.alarms['focus-end']).toEqual({ when: fake.local.focusSession.endsAt });
    });

    it('stops blocking and records a completed session when the time is up', async () => {
      await startWorker();
      await send({ action: 'startFocusSession', minutes: 25 });

      jest.advanceTimersByTime(25 * 60000);
      await fireAlarm('focus-end');

      expect(fake.rules).toEqual([]);
      expect(fake.local.focusSession).toBeNull();
      expect(fake.local.focusStats).toMatchObject({ started: 1, completed: 1, focusTime: 25 * 60000 });
    });

    it('records a session ended early as started but not completed', async () => {
      await startWorker();
      await send({ action: 'startFocusSession', minutes: 25 });

      jest.advanceTimersByTime(10 * 60000);
      await send({ action: 'stopFocusSession' });

      expect(fake.rules).toEqual([]);
      expect(fake.local.focusStats).toMatchObject({ started: 1, completed: 0, focusTime: 10 * 60000 });
    });

    it('refuses temporary unblocks while a session is running', async () => {
      await startWorker();
      await send({ action: 'startFocusSession', minutes: 25 });

      const [response] = await send({ action: 'updateTemporaryUnblocks', domain: 'a.com', expirationTime: Date.now() + 300000 });

      expect(response.success).toBe(false);
      expect(response.error).toMatch(/focus session/i);
      expect(blockedDomainsInRules()).toEqual(['a.com', 'b.com']);
    });

    it('ignores an unblock granted before the session started', async () => {
      fake.local.blockingEnabled = true;
      await startWorker();
      await send({ action: 'updateTemporaryUnblocks', domain: 'a.com', expirationTime: Date.now() + 30 * 60000 });
      expect(blockedDomainsInRules()).toEqual(['b.com']);

      await send({ action: 'startFocusSession', minutes: 25 });

      expect(blockedDomainsInRules()).toEqual(['a.com', 'b.com']);
    });

    it('keeps blocking after a service worker restart', async () => {
      await startWorker();
      await send({ action: 'startFocusSession', minutes: 25 });

      jest.advanceTimersByTime(5 * 60000);
      fake.rules = [];
      await startWorker();

      expect(blockedDomainsInRules()).toEqual(['a.com', 'b.com']);
    });

    it('closes a session that ended while the worker was not running', async () => {
      await startWorker();
      await send({ action: 'startFocusSession', minutes: 25 });

      jest.advanceTimersByTime(40 * 60000);
      await startWorker();

      expect(fake.rules).toEqual([]);
      expect(fake.local.focusSession).toBeNull();
      expect(fake.local.focusStats).toMatchObject({ completed: 1, focusTime: 25 * 60000 });
    });

    it('does not start a session for a free account', async () => {
      fake.local.freeMode = true;
      await startWorker();

      const [response] = await send({ action: 'startFocusSession', minutes: 25 });

      expect(response).toEqual({ success: false, error: 'Focus sessions are part of Premium' });
      expect(fake.rules).toEqual([]);
    });

    it('does not start a second session on top of a running one', async () => {
      await startWorker();
      await send({ action: 'startFocusSession', minutes: 25 });

      const [response] = await send({ action: 'startFocusSession', minutes: 50 });

      expect(response.success).toBe(false);
      expect(fake.local.focusStats.started).toBe(1);
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
