import { HistoryData, SiteData } from '../types/storage';
import { formatTime } from './timeUtils';

/**
 * Everything the popup shows is computed here from what the tracker records:
 * time per site, visits per site, and time per hour of day. Nothing is
 * estimated; when the data for a figure does not exist, the result says so.
 */

export interface UsageDay {
  sites?: SiteData;
  totalTime?: number;
  hourly?: number[];
  date?: string;
}

export interface Comparison {
  label: string;
  direction: 'up' | 'down' | 'same' | 'none';
}

const MS_PER_MINUTE = 60 * 1000;

function daysAgo(now: Date, count: number): Date {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() - count);
  return date;
}

export function getDay(history: HistoryData | undefined, date: Date): UsageDay | undefined {
  return history ? (history[date.toDateString()] as unknown as UsageDay | undefined) : undefined;
}

export function countSites(sites: SiteData | undefined): number {
  return sites ? Object.keys(sites).length : 0;
}

export function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${suffix}`;
}

/**
 * Time recorded up to the same time of day as `now`, from a day's hourly
 * buckets. Null when the day has no hourly record.
 */
export function getTimeUpTo(hourly: number[] | undefined, now: Date): number | null {
  if (!hourly || hourly.length === 0) return null;

  let total = 0;
  for (let hour = 0; hour < now.getHours(); hour++) {
    total += hourly[hour] || 0;
  }
  // Part of the current hour, in proportion to the minutes gone by
  total += (hourly[now.getHours()] || 0) * (now.getMinutes() / 60);

  return total;
}

/**
 * Today so far against yesterday up to the same time of day. Comparing against
 * yesterday's full total would always look like a drop until late evening.
 */
export function compareWithYesterday(totalTime: number, yesterday: UsageDay | undefined, now: Date): Comparison {
  if (!yesterday || !yesterday.totalTime) {
    return { label: 'No data for yesterday', direction: 'none' };
  }

  const yesterdaySoFar = getTimeUpTo(yesterday.hourly, now);
  if (yesterdaySoFar === null) {
    // Recorded before hourly tracking existed: show the plain total
    return { label: `${formatTime(yesterday.totalTime)} all of yesterday`, direction: 'none' };
  }

  if (yesterdaySoFar < MS_PER_MINUTE) {
    return totalTime >= MS_PER_MINUTE
      ? { label: 'More than by this time yesterday', direction: 'up' }
      : { label: 'Same as by this time yesterday', direction: 'same' };
  }

  const change = Math.round(((totalTime - yesterdaySoFar) / yesterdaySoFar) * 100);
  if (change === 0) {
    return { label: 'Same as by this time yesterday', direction: 'same' };
  }

  return {
    label: `${change > 0 ? '+' : ''}${change}% vs this time yesterday`,
    direction: change > 0 ? 'up' : 'down',
  };
}

/**
 * Average daily time over the previous `days` calendar days that have data.
 * Today is left out because it is not finished.
 */
export function getDailyAverage(
  history: HistoryData | undefined,
  now: Date,
  days: number = 7
): { average: number; daysCounted: number } {
  let total = 0;
  let daysCounted = 0;

  for (let i = 1; i <= days; i++) {
    const day = getDay(history, daysAgo(now, i));
    if (day && day.totalTime && day.totalTime > 0) {
      total += day.totalTime;
      daysCounted++;
    }
  }

  return { average: daysCounted > 0 ? total / daysCounted : 0, daysCounted };
}

export interface HourPoint {
  hour: number;
  time: string;
  today: number | null; // minutes; null for hours that have not happened yet
  average: number | null; // minutes; null when there is no hourly history
}

/**
 * Minutes per hour for today, next to the average of the previous days that
 * have an hourly record.
 */
export function getHourlyChart(
  todayHourly: number[] | undefined,
  history: HistoryData | undefined,
  now: Date,
  days: number = 7
): HourPoint[] {
  const sums: number[] = [];
  let daysWithHourly = 0;
  for (let hour = 0; hour < 24; hour++) sums.push(0);

  for (let i = 1; i <= days; i++) {
    const day = getDay(history, daysAgo(now, i));
    if (day && day.hourly && day.hourly.length > 0) {
      daysWithHourly++;
      for (let hour = 0; hour < 24; hour++) sums[hour] += day.hourly[hour] || 0;
    }
  }

  const points: HourPoint[] = [];
  for (let hour = 0; hour < 24; hour++) {
    points.push({
      hour,
      time: formatHour(hour),
      today: hour <= now.getHours() ? Math.round(((todayHourly && todayHourly[hour]) || 0) / MS_PER_MINUTE) : null,
      average: daysWithHourly > 0 ? Math.round(sums[hour] / daysWithHourly / MS_PER_MINUTE) : null,
    });
  }

  return points;
}

/**
 * The hour with the most recorded time, or null when nothing is recorded.
 */
export function getPeakHour(hourly: number[] | undefined): { hour: number; label: string; time: number } | null {
  if (!hourly) return null;

  let peak = -1;
  for (let hour = 0; hour < 24; hour++) {
    if ((hourly[hour] || 0) > 0 && (peak === -1 || hourly[hour] > hourly[peak])) {
      peak = hour;
    }
  }

  return peak === -1 ? null : { hour: peak, label: formatHour(peak), time: hourly[peak] };
}

/**
 * Progress against the "daily screen time goal" setting (hours). Null when no
 * goal is set.
 */
export function getGoalProgress(
  totalTime: number,
  dailyLimitHours: number | undefined
): { percent: number; remaining: number; over: boolean; goal: number } | null {
  const hours = Number(dailyLimitHours);
  if (!hours || hours <= 0 || !isFinite(hours)) return null;

  const goal = hours * 60 * MS_PER_MINUTE;
  return {
    percent: Math.round((totalTime / goal) * 100),
    remaining: Math.abs(goal - totalTime),
    over: totalTime > goal,
    goal,
  };
}

/**
 * Visits recorded today and the average time per visit.
 */
export function getSessionStats(sites: SiteData | undefined, totalTime: number): { sessions: number; averageLength: number } {
  let sessions = 0;
  Object.keys(sites || {}).forEach((domain) => {
    sessions += ((sites as any)[domain].visits as number) || 0;
  });

  return { sessions, averageLength: sessions > 0 ? totalTime / sessions : 0 };
}

export function getTopSite(sites: SiteData | undefined): { domain: string; time: number } | null {
  let top: { domain: string; time: number } | null = null;
  Object.keys(sites || {}).forEach((domain) => {
    const time = ((sites as SiteData)[domain] && (sites as SiteData)[domain].totalTime) || 0;
    if (time > 0 && (!top || time > top.time)) top = { domain, time };
  });
  return top;
}

export interface PastDay {
  date: string;
  label: string;
  totalTime: number;
  sitesCount: number;
  topSite: string | null;
}

/**
 * The stored past days, most recent first.
 */
export function getPastDays(history: HistoryData | undefined, limit: number = 30): PastDay[] {
  const days: PastDay[] = Object.keys(history || {})
    .map((date) => {
      const day = (history as HistoryData)[date] as unknown as UsageDay;
      const top = getTopSite(day.sites);
      return {
        date,
        label: new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        totalTime: day.totalTime || 0,
        sitesCount: countSites(day.sites),
        topSite: top ? top.domain : null,
      };
    })
    .filter((day) => day.totalTime > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return days.slice(0, limit);
}
