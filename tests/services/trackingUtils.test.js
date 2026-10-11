import {
  addHourlyTime,
  claimElapsedTime,
  getIdleThresholdSeconds,
  getTrackableDomain,
  normalizeSites,
  pruneHistory,
} from '../../services/trackingUtils';

const MAX_INACTIVE = 5 * 60 * 1000;

describe('trackingUtils', () => {
  describe('claimElapsedTime', () => {
    it('should return the elapsed time and restart the clock', () => {
      const tab = { startTime: 1000 };

      expect(claimElapsedTime(tab, 6000, MAX_INACTIVE)).toBe(5000);
      expect(tab.startTime).toBe(6000);
    });

    it('should never credit the same interval twice', () => {
      // The timer and the alarm both flush the same tab
      const tab = { startTime: 0 };

      const fromTimer = claimElapsedTime(tab, 5000, MAX_INACTIVE);
      const fromAlarm = claimElapsedTime(tab, 5200, MAX_INACTIVE);
      const fromNextTimer = claimElapsedTime(tab, 10000, MAX_INACTIVE);

      expect(fromTimer + fromAlarm + fromNextTimer).toBe(10000);
    });

    it('should keep accumulating intervals too short to record', () => {
      const tab = { startTime: 1000 };

      expect(claimElapsedTime(tab, 1200, MAX_INACTIVE)).toBe(0);
      expect(tab.startTime).toBe(1000);
      expect(claimElapsedTime(tab, 1800, MAX_INACTIVE)).toBe(800);
    });

    it('should discard a gap longer than the inactivity limit and restart the clock', () => {
      const tab = { startTime: 0 };

      expect(claimElapsedTime(tab, MAX_INACTIVE + 1, MAX_INACTIVE)).toBe(0);
      expect(tab.startTime).toBe(MAX_INACTIVE + 1);
    });

    it('should discard a negative interval after a clock change', () => {
      const tab = { startTime: 10000 };

      expect(claimElapsedTime(tab, 4000, MAX_INACTIVE)).toBe(0);
      expect(tab.startTime).toBe(4000);
    });
  });

  describe('pruneHistory', () => {
    const day = (iso) => new Date(`${iso}T12:00:00`).toDateString();

    it('should remove the oldest days, not the alphabetically first ones', () => {
      // Ten consecutive days: as strings these sort by weekday name
      const history = {};
      for (let d = 1; d <= 10; d++) {
        history[day(`2025-07-${String(d).padStart(2, '0')}`)] = { totalTime: d };
      }

      pruneHistory(history, 7);

      expect(Object.keys(history).sort()).toEqual(
        [4, 5, 6, 7, 8, 9, 10].map((d) => day(`2025-07-${String(d).padStart(2, '0')}`)).sort()
      );
    });

    it('should order days across a month and year boundary', () => {
      const history = {
        [day('2026-01-01')]: {},
        [day('2025-12-30')]: {},
        [day('2025-12-31')]: {},
      };

      pruneHistory(history, 2);

      expect(history[day('2025-12-30')]).toBeUndefined();
      expect(Object.keys(history)).toHaveLength(2);
    });

    it('should keep everything when under the limit', () => {
      const history = { [day('2025-07-01')]: {}, [day('2025-07-02')]: {} };

      pruneHistory(history, 7);

      expect(Object.keys(history)).toHaveLength(2);
    });
  });

  describe('getIdleThresholdSeconds', () => {
    it('should convert the setting from minutes to seconds', () => {
      expect(getIdleThresholdSeconds({ idleTime: 5 })).toBe(300);
      expect(getIdleThresholdSeconds({ idleTime: 1 })).toBe(60);
      expect(getIdleThresholdSeconds({ idleTime: 60 })).toBe(3600);
    });

    it('should default to five minutes when the setting is missing or unusable', () => {
      expect(getIdleThresholdSeconds()).toBe(300);
      expect(getIdleThresholdSeconds({})).toBe(300);
      expect(getIdleThresholdSeconds({ idleTime: NaN })).toBe(300);
      expect(getIdleThresholdSeconds({ idleTime: 0 })).toBe(300);
      expect(getIdleThresholdSeconds({ idleTime: -3 })).toBe(300);
      expect(getIdleThresholdSeconds({ idleTime: null })).toBe(300);
    });

    it('should never go below the 15 seconds the browser accepts', () => {
      expect(getIdleThresholdSeconds({ idleTime: 0.1 })).toBe(15);
    });
  });

  describe('getTrackableDomain', () => {
    it('should return the hostname without a leading www', () => {
      expect(getTrackableDomain('https://www.Example.com/page?x=1')).toBe('example.com');
      expect(getTrackableDomain('http://m.youtube.com/watch')).toBe('m.youtube.com');
      expect(getTrackableDomain('http://localhost:3000/')).toBe('localhost');
    });

    it('should return null for anything that is not a website', () => {
      expect(getTrackableDomain('chrome://newtab/')).toBeNull();
      expect(getTrackableDomain('chrome-extension://abc/popup.html')).toBeNull();
      expect(getTrackableDomain('file:///tmp/a.html')).toBeNull();
      expect(getTrackableDomain('about:blank')).toBeNull();
      expect(getTrackableDomain('not a url')).toBeNull();
      expect(getTrackableDomain('http://__proto__/')).toBeNull();
    });
  });

  describe('normalizeSites', () => {
    it('should add together entries that normalize to the same site', () => {
      const result = normalizeSites({
        'www.a.com': { totalTime: 100, visits: 1, lastVisit: 5 },
        'a.com': { totalTime: 50, visits: 2, lastVisit: 9, favicon: 'f.ico' },
      });

      expect(result).toEqual({ 'a.com': { totalTime: 150, visits: 3, lastVisit: 9, favicon: 'f.ico' } });
    });

    it('should not modify its input and should cope with nothing', () => {
      const sites = { 'www.a.com': { totalTime: 100 } };

      normalizeSites(sites);

      expect(sites).toEqual({ 'www.a.com': { totalTime: 100 } });
      expect(normalizeSites(undefined)).toEqual({});
    });
  });

  describe('addHourlyTime', () => {
    it('should add to the bucket of the local hour and keep 24 buckets', () => {
      const at = new Date(2025, 6, 21, 14, 30).getTime();

      const hourly = addHourlyTime(undefined, at, 5000);
      const again = addHourlyTime(hourly, at, 2000);

      expect(hourly).toHaveLength(24);
      expect(hourly[14]).toBe(5000);
      expect(again[14]).toBe(7000);
      expect(hourly[14]).toBe(5000);
    });

    it('should repair a missing or partial array', () => {
      const at = new Date(2025, 6, 21, 3, 0).getTime();

      expect(addHourlyTime([], at, 1000)[3]).toBe(1000);
      expect(addHourlyTime([10, null, 'x'], at, 1000).slice(0, 4)).toEqual([10, 0, 0, 1000]);
    });
  });
});
