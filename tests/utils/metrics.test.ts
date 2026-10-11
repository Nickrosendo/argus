import {
  compareWithYesterday,
  getDailyAverage,
  getGoalProgress,
  getHourlyChart,
  getPastDays,
  getPeakHour,
  getSessionStats,
  getTimeUpTo,
  getTopSite,
  formatHour,
} from '../../src/utils/metrics';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const NOW = new Date(2025, 6, 21, 14, 30); // Monday 2:30 PM
const dayString = (daysAgo: number) => new Date(2025, 6, 21 - daysAgo).toDateString();
const hourly = (values: { [hour: number]: number }) => {
  const buckets: number[] = [];
  for (let hour = 0; hour < 24; hour++) buckets.push(values[hour] || 0);
  return buckets;
};

describe('metrics', () => {
  describe('formatHour', () => {
    it('should format hours on a 12-hour clock', () => {
      expect([0, 9, 12, 13, 23].map(formatHour)).toEqual(['12 AM', '9 AM', '12 PM', '1 PM', '11 PM']);
    });
  });

  describe('getTimeUpTo', () => {
    it('should sum finished hours and the elapsed share of the current hour', () => {
      // 9-10: 30 min, 14-15: 40 min; at 14:30 half of the 14h bucket counts
      expect(getTimeUpTo(hourly({ 9: 30 * MIN, 14: 40 * MIN, 20: HOUR }), NOW)).toBe(50 * MIN);
    });

    it('should return null when the day has no hourly record', () => {
      expect(getTimeUpTo(undefined, NOW)).toBeNull();
      expect(getTimeUpTo([], NOW)).toBeNull();
    });
  });

  describe('compareWithYesterday', () => {
    it('should compare against yesterday up to the same time, not its full total', () => {
      const yesterday = { totalTime: 5 * HOUR, hourly: hourly({ 9: HOUR, 20: 4 * HOUR }) };

      // One hour by 14:30 yesterday; 90 minutes so far today
      expect(compareWithYesterday(90 * MIN, yesterday, NOW)).toEqual({
        label: '+50% vs this time yesterday',
        direction: 'up',
      });
      expect(compareWithYesterday(30 * MIN, yesterday, NOW).label).toBe('-50% vs this time yesterday');
      expect(compareWithYesterday(HOUR, yesterday, NOW).direction).toBe('same');
    });

    it('should say so when there is no data for yesterday', () => {
      expect(compareWithYesterday(HOUR, undefined, NOW)).toEqual({ label: 'No data for yesterday', direction: 'none' });
      expect(compareWithYesterday(HOUR, { totalTime: 0 }, NOW).direction).toBe('none');
    });

    it('should show the plain total for a day recorded without hourly data', () => {
      expect(compareWithYesterday(HOUR, { totalTime: 2 * HOUR }, NOW)).toEqual({
        label: '2h 0m all of yesterday',
        direction: 'none',
      });
    });

    it('should not divide by zero when yesterday had nothing by this time', () => {
      const yesterday = { totalTime: HOUR, hourly: hourly({ 22: HOUR }) };

      expect(compareWithYesterday(10 * MIN, yesterday, NOW).label).toBe('More than by this time yesterday');
      expect(compareWithYesterday(0, yesterday, NOW).direction).toBe('same');
    });
  });

  describe('getDailyAverage', () => {
    it('should average the previous days with data and leave today out', () => {
      const history: any = {
        [dayString(0)]: { totalTime: 99 * HOUR }, // today must not count
        [dayString(1)]: { totalTime: 2 * HOUR },
        [dayString(3)]: { totalTime: 4 * HOUR },
        [dayString(8)]: { totalTime: 50 * HOUR }, // outside the window
      };

      expect(getDailyAverage(history, NOW)).toEqual({ average: 3 * HOUR, daysCounted: 2 });
    });

    it('should report zero days when there is no history', () => {
      expect(getDailyAverage({}, NOW)).toEqual({ average: 0, daysCounted: 0 });
      expect(getDailyAverage(undefined, NOW).daysCounted).toBe(0);
    });
  });

  describe('getHourlyChart', () => {
    it('should give minutes per hour for today and stop at the current hour', () => {
      const chart = getHourlyChart(hourly({ 9: 30 * MIN, 14: 12 * MIN }), {}, NOW);

      expect(chart).toHaveLength(24);
      expect(chart[9]).toMatchObject({ time: '9 AM', today: 30, average: null });
      expect(chart[14].today).toBe(12);
      expect(chart[15].today).toBeNull();
    });

    it('should average only the past days that have an hourly record', () => {
      const history: any = {
        [dayString(1)]: { totalTime: HOUR, hourly: hourly({ 9: 20 * MIN }) },
        [dayString(2)]: { totalTime: HOUR, hourly: hourly({ 9: 40 * MIN }) },
        [dayString(3)]: { totalTime: HOUR }, // recorded before hourly tracking
      };

      const chart = getHourlyChart(undefined, history, NOW);

      expect(chart[9].average).toBe(30);
      expect(chart[10].average).toBe(0);
      expect(chart[9].today).toBe(0);
    });

    it('should never exceed the minutes in an hour or the time recorded', () => {
      const today = hourly({ 9: 30 * MIN, 10: 60 * MIN, 14: 12 * MIN });

      const chart = getHourlyChart(today, {}, NOW);
      const charted = chart.reduce((sum, point) => sum + (point.today || 0), 0);

      expect(charted).toBe(102);
      expect(chart.every((point) => (point.today || 0) <= 60)).toBe(true);
    });
  });

  describe('getPeakHour', () => {
    it('should return the hour with the most time', () => {
      expect(getPeakHour(hourly({ 9: 10 * MIN, 16: 45 * MIN }))).toEqual({ hour: 16, label: '4 PM', time: 45 * MIN });
    });

    it('should return null when nothing is recorded', () => {
      expect(getPeakHour(undefined)).toBeNull();
      expect(getPeakHour(hourly({}))).toBeNull();
    });
  });

  describe('getGoalProgress', () => {
    it('should report progress and time left against the goal', () => {
      expect(getGoalProgress(2 * HOUR, 8)).toEqual({ percent: 25, remaining: 6 * HOUR, over: false, goal: 8 * HOUR });
    });

    it('should report how far over the goal the day is', () => {
      expect(getGoalProgress(9 * HOUR, 8)).toMatchObject({ percent: 113, remaining: HOUR, over: true });
    });

    it('should return null when no goal is set', () => {
      expect(getGoalProgress(HOUR, 0)).toBeNull();
      expect(getGoalProgress(HOUR, undefined)).toBeNull();
      expect(getGoalProgress(HOUR, NaN)).toBeNull();
    });
  });

  describe('getSessionStats', () => {
    it('should use the recorded visits, not an estimate', () => {
      const sites: any = { 'a.com': { totalTime: 30 * MIN, visits: 2 }, 'b.com': { totalTime: 30 * MIN, visits: 1 } };

      expect(getSessionStats(sites, HOUR)).toEqual({ sessions: 3, averageLength: 20 * MIN });
    });

    it('should cope with no data', () => {
      expect(getSessionStats({}, 0)).toEqual({ sessions: 0, averageLength: 0 });
    });
  });

  describe('getTopSite', () => {
    it('should return the site with the most time', () => {
      const sites: any = { 'a.com': { totalTime: 5 }, 'b.com': { totalTime: 9 } };

      expect(getTopSite(sites)).toEqual({ domain: 'b.com', time: 9 });
      expect(getTopSite({})).toBeNull();
    });
  });

  describe('getPastDays', () => {
    it('should list stored days newest first with their totals', () => {
      const history: any = {
        [dayString(3)]: { totalTime: HOUR, sites: { 'a.com': { totalTime: HOUR } } },
        [dayString(1)]: { totalTime: 2 * HOUR, sites: { 'a.com': { totalTime: HOUR }, 'b.com': { totalTime: HOUR + 1 } } },
        [dayString(2)]: { totalTime: 0, sites: {} },
      };

      const days = getPastDays(history);

      expect(days.map((day) => day.date)).toEqual([dayString(1), dayString(3)]);
      expect(days[0]).toMatchObject({ totalTime: 2 * HOUR, sitesCount: 2, topSite: 'b.com' });
    });

    it('should return an empty list without history', () => {
      expect(getPastDays(undefined)).toEqual([]);
    });
  });
});
