import {
  BACKUP_FORMAT,
  BACKUP_KEYS,
  backupFileName,
  createBackup,
  mergeBackup,
  parseBackup,
  summarizeBackup,
} from '../../services/backupUtils';

const day = (totalTime, extra = {}) => ({
  sites: { 'a.com': { time: totalTime } },
  totalTime,
  hourly: new Array(24).fill(0),
  ...extra,
});

describe('backupUtils', () => {
  describe('createBackup', () => {
    it('should keep only the backup keys and stamp the format and time', () => {
      const now = new Date(2026, 9, 5, 12);
      const storage = {
        authToken: 't',
        userInfo: {},
        remoteDays: {},
        unblockData: {},
        dataVersion: 3,
      };
      BACKUP_KEYS.forEach((key) => {
        storage[key] = { [key]: true };
      });

      const backup = createBackup(storage, now);

      expect(backup.argusBackup).toBe(1);
      expect(backup.argusBackup).toBe(BACKUP_FORMAT);
      expect(backup.exportedAt).toBe(now.toISOString());
      expect(Object.keys(backup.data).sort()).toEqual([...BACKUP_KEYS].sort());
    });
  });

  describe('backupFileName', () => {
    it('should use the local date', () => {
      expect(backupFileName(new Date(2026, 9, 5))).toBe('argus-backup-2026-10-05.json');
    });
  });

  describe('parseBackup', () => {
    it('should accept a raw 1.x dump and drop non-backup keys', () => {
      const raw = { authToken: 't', userInfo: {}, syncedDays: {}, history: {}, sites: {} };

      const result = parseBackup(JSON.stringify(raw));

      expect(result.ok).toBe(true);
      expect(result.exportedAt).toBeNull();
      expect(Object.keys(result.data)).toEqual(expect.arrayContaining(['history', 'sites']));
      ['authToken', 'userInfo', 'syncedDays'].forEach((key) =>
        expect(Object.keys(result.data)).not.toContain(key)
      );
    });

    it('should accept the wrapped format', () => {
      const text = JSON.stringify({
        argusBackup: 1,
        exportedAt: '2026-10-05T10:00:00.000Z',
        data: { history: {}, settings: { a: 1 }, authToken: 'x' },
      });

      expect(parseBackup(text)).toEqual({
        ok: true,
        data: { history: {}, settings: { a: 1 } },
        exportedAt: '2026-10-05T10:00:00.000Z',
      });
    });

    it('should reject text that is not JSON', () => {
      expect(parseBackup('not json')).toEqual({
        ok: false,
        reason: "This file isn't an Argus backup.",
      });
    });

    it('should reject JSON without Argus data', () => {
      expect(parseBackup('{"foo":1}')).toEqual({
        ok: false,
        reason: 'This file has no Argus data.',
      });
    });

    it('should reject a backup from a newer format', () => {
      const text = JSON.stringify({ argusBackup: 2, data: { history: {} } });

      expect(parseBackup(text)).toEqual({
        ok: false,
        reason: 'This backup was made by a newer version of Argus.',
      });
    });
  });

  describe('summarizeBackup', () => {
    it('should count days with time plus the last day when not in history', () => {
      const data = {
        history: {
          'Mon Jul 21 2025': day(100),
          'Tue Jul 22 2025': day(0),
          'Wed Jul 23 2025': day(50),
        },
        lastDate: 'Thu Jul 24 2025',
        totalTime: 10,
        blockedSites: ['a.com', 'b.com'],
      };

      expect(summarizeBackup(data)).toEqual({ days: 3, blockedSites: 2 });
    });

    it('should not count the last day twice or when it has no time', () => {
      const history = { 'Mon Jul 21 2025': day(100) };

      expect(
        summarizeBackup({ history, lastDate: 'Mon Jul 21 2025', totalTime: 5 }).days
      ).toBe(1);
      expect(
        summarizeBackup({ history, lastDate: 'Tue Jul 22 2025', totalTime: 0 }).days
      ).toBe(1);
      expect(summarizeBackup({ sites: {} })).toEqual({ days: 0, blockedSites: 0 });
    });
  });

  describe('mergeBackup', () => {
    const TODAY = 'Fri Jul 25 2025';
    const local = () => ({
      history: { 'Mon Jul 21 2025': day(100) },
      sites: { 'l.com': { time: 30 } },
      totalTime: 30,
      hourly: new Array(24).fill(1),
      lastDate: TODAY,
      focusStats: { date: TODAY, sessions: 1 },
    });

    it('should add a day that only exists in the backup', () => {
      const backup = { history: { 'Tue Jul 22 2025': day(70) } };

      const updates = mergeBackup(local(), backup, 90);

      expect(Object.keys(updates.history).sort()).toEqual(
        ['Mon Jul 21 2025', 'Tue Jul 22 2025'].sort()
      );
    });

    it('should keep the day with more time in both directions', () => {
      const date = 'Mon Jul 21 2025';

      const bigger = mergeBackup(local(), { history: { [date]: day(500) } }, 90);
      const smaller = mergeBackup(local(), { history: { [date]: day(5) } }, 90);

      expect(bigger.history[date].totalTime).toBe(500);
      expect(smaller.history[date].totalTime).toBe(100);
    });

    it('should turn a past backup lastDate into a history day', () => {
      const backup = {
        history: {},
        lastDate: 'Wed Jul 23 2025',
        totalTime: 60,
        sites: { 'b.com': { time: 60 } },
        hourly: new Array(24).fill(2),
      };

      const updates = mergeBackup(local(), backup, 90);

      expect(updates.history['Wed Jul 23 2025']).toEqual({
        sites: backup.sites,
        totalTime: 60,
        hourly: backup.hourly,
        date: 'Wed Jul 23 2025',
      });
      expect(updates).not.toHaveProperty('totalTime');
      expect(updates).not.toHaveProperty('sites');
      expect(updates).not.toHaveProperty('hourly');
    });

    it("should take the backup's today counters when they have more time", () => {
      const backup = {
        history: {},
        lastDate: TODAY,
        totalTime: 90,
        sites: { 'b.com': { time: 90 } },
        hourly: new Array(24).fill(3),
        focusStats: { date: TODAY, sessions: 4 },
      };

      const updates = mergeBackup(local(), backup, 90);

      expect(updates.totalTime).toBe(90);
      expect(updates.sites).toEqual(backup.sites);
      expect(updates.hourly).toEqual(backup.hourly);
      expect(updates.focusStats).toEqual(backup.focusStats);
      expect(updates.history).not.toHaveProperty(TODAY);
    });

    it('should not take focusStats from another date', () => {
      const backup = {
        history: {},
        lastDate: TODAY,
        totalTime: 90,
        sites: {},
        hourly: [],
        focusStats: { date: 'Mon Jul 21 2025', sessions: 4 },
      };

      expect(mergeBackup(local(), backup, 90)).not.toHaveProperty('focusStats');
    });

    it("should leave today's counters alone when the backup has less time", () => {
      const backup = {
        history: {},
        lastDate: TODAY,
        totalTime: 10,
        sites: {},
        hourly: [],
      };

      const updates = mergeBackup(local(), backup, 90);

      expect(updates).not.toHaveProperty('totalTime');
      expect(updates).not.toHaveProperty('sites');
    });

    it('should prune to the limit, dropping the oldest days', () => {
      const history = {};
      for (let i = 0; i < 100; i += 1) {
        history[new Date(2025, 0, 1 + i).toDateString()] = day(10);
      }

      const updates = mergeBackup({ history: {}, lastDate: TODAY }, { history }, 90);

      expect(Object.keys(updates.history)).toHaveLength(90);
      expect(updates.history).not.toHaveProperty(new Date(2025, 0, 1).toDateString());
      expect(updates.history).toHaveProperty(new Date(2025, 0, 100).toDateString());
    });

    it('should not mutate its inputs', () => {
      const l = local();
      const b = { history: { 'Tue Jul 22 2025': day(70) } };
      const lCopy = JSON.parse(JSON.stringify(l));
      const bCopy = JSON.parse(JSON.stringify(b));

      mergeBackup(l, b, 1);

      expect(l).toEqual(lCopy);
      expect(b).toEqual(bCopy);
    });

    it('should copy settings, blocked sites and blocking flag only when present', () => {
      const withAll = mergeBackup(
        local(),
        { history: {}, settings: { a: 1 }, blockedSites: ['x.com'], blockingEnabled: false },
        90
      );
      const without = mergeBackup(local(), { history: {} }, 90);

      expect(withAll.settings).toEqual({ a: 1 });
      expect(withAll.blockedSites).toEqual(['x.com']);
      expect(withAll.blockingEnabled).toBe(false);
      ['settings', 'blockedSites', 'blockingEnabled'].forEach((key) =>
        expect(without).not.toHaveProperty(key)
      );
    });
  });
});
