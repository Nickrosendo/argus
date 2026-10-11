import { HistoryData, SiteData, StorageData } from '../types/storage';

type UsageDay = { sites?: SiteData; totalTime?: number };

const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

// Add the sites of one day into another, summing time and visits per site
function mergeSites(local: SiteData = {}, remote: SiteData = {}): SiteData {
  const merged: Record<string, any> = { ...local };

  Object.keys(remote).forEach((domain) => {
    // Never use a name that would resolve to the object prototype as a key
    if (UNSAFE_KEYS.indexOf(domain) !== -1) return;

    const localSite = merged[domain];
    const site = remote[domain] as Record<string, any>;

    merged[domain] = localSite
      ? {
          ...site,
          ...localSite,
          totalTime: (localSite.totalTime || 0) + (site.totalTime || 0),
          visits: (localSite.visits || 0) + (site.visits || 0),
          lastVisit: Math.max(localSite.lastVisit || 0, site.lastVisit || 0) || undefined,
        }
      : site;
  });

  return merged as SiteData;
}

/**
 * Combine this device's usage with what the user's other devices recorded
 * (fetched by cloud sync), for display only. The stored local data is never
 * changed, so it can be uploaded again without counting other devices twice.
 */
export function mergeRemoteUsage(
  data: StorageData,
  remoteDays: Record<string, UsageDay> | undefined,
  today: string = new Date().toDateString()
): StorageData {
  if (!remoteDays || Object.keys(remoteDays).length === 0) {
    return data;
  }

  const history: HistoryData = { ...(data.history || {}) };
  let sites = data.sites;
  let totalTime = data.totalTime;

  Object.keys(remoteDays).forEach((date) => {
    const remoteDay = remoteDays[date];
    const remoteTime = remoteDay.totalTime || 0;

    if (date === today) {
      sites = mergeSites(data.sites, remoteDay.sites);
      totalTime = (data.totalTime || 0) + remoteTime;
      return;
    }

    const localDay = history[date] as (UsageDay & Record<string, any>) | undefined;
    history[date] = {
      ...localDay,
      date,
      sites: mergeSites(localDay?.sites, remoteDay.sites),
      totalTime: (localDay?.totalTime || 0) + remoteTime,
    } as unknown as HistoryData[string];
  });

  return { ...data, sites, totalTime, history };
}
