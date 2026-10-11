import {
  buildUploadDays,
  fromIsoDate,
  toIsoDate,
  toLocalDays,
  updateSyncedDays,
} from '../../services/syncUtils';

const dateString = (iso) => new Date(`${iso}T12:00:00`).toDateString();

describe('syncUtils', () => {
  describe('date conversion', () => {
    it('should convert a local date string to an ISO date and back', () => {
      expect(toIsoDate('Mon Jul 21 2025')).toBe('2025-07-21');
      expect(fromIsoDate('2025-07-21')).toBe('Mon Jul 21 2025');
    });

    it('should use the local calendar day, not UTC, late in the evening', () => {
      expect(toIsoDate(new Date(2025, 6, 21, 23, 59))).toBe('2025-07-21');
      expect(toIsoDate(new Date(2025, 0, 1, 0, 1))).toBe('2025-01-01');
    });
  });

  describe('buildUploadDays', () => {
    const history = {
      [dateString('2025-07-18')]: { sites: { 'c.com': { totalTime: 3 } }, totalTime: 3 },
      [dateString('2025-07-19')]: { sites: { 'b.com': { totalTime: 2 } }, totalTime: 2 },
      [dateString('2025-07-20')]: { sites: { 'a.com': { totalTime: 1 } }, totalTime: 1 },
    };
    const today = { sites: { 'x.com': { totalTime: 9 } }, totalTime: 9, currentDate: dateString('2025-07-21') };

    it('should always include the current day', () => {
      const { days, historyDates } = buildUploadDays({ ...today, history: {}, syncedDays: [] });

      expect(days).toEqual({ '2025-07-21': { sites: today.sites, totalTime: 9 } });
      expect(historyDates).toEqual([]);
    });

    it('should include finished days that were not uploaded yet', () => {
      const { days, historyDates } = buildUploadDays({ ...today, history, syncedDays: ['2025-07-19'] });

      expect(Object.keys(days).sort()).toEqual(['2025-07-18', '2025-07-20', '2025-07-21']);
      expect(historyDates.sort()).toEqual(['2025-07-18', '2025-07-20']);
    });

    it('should take the most recent finished days first when limited', () => {
      const { historyDates } = buildUploadDays({ ...today, history, syncedDays: [], maxHistoryDays: 2 });

      expect(historyDates).toEqual(['2025-07-20', '2025-07-19']);
    });

    it('should cope with missing data', () => {
      const { days } = buildUploadDays({ currentDate: dateString('2025-07-21') });

      expect(days).toEqual({ '2025-07-21': { sites: {}, totalTime: 0 } });
    });
  });

  describe('updateSyncedDays', () => {
    it('should add the uploaded days and forget days no longer kept locally', () => {
      const history = { [dateString('2025-07-20')]: {}, [dateString('2025-07-19')]: {} };

      expect(updateSyncedDays(['2025-06-01', '2025-07-19'], ['2025-07-20'], history)).toEqual([
        '2025-07-19',
        '2025-07-20',
      ]);
    });
  });

  describe('toLocalDays', () => {
    it('should key the days by local date string', () => {
      const local = toLocalDays({ '2025-07-21': { sites: {}, totalTime: 5 } });

      expect(local).toEqual({ 'Mon Jul 21 2025': { sites: {}, totalTime: 5, date: 'Mon Jul 21 2025' } });
    });

    it('should return an empty object when there is nothing', () => {
      expect(toLocalDays(undefined)).toEqual({});
    });
  });
});
