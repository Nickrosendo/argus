import { mergeRemoteUsage } from '../../src/utils/mergeUsage';
import { StorageData } from '../../src/types/storage';

const TODAY = 'Mon Jul 21 2025';
const YESTERDAY = 'Sun Jul 20 2025';

const local = (): StorageData =>
  ({
    sites: { 'a.com': { totalTime: 1000, visits: 1, favicon: 'local.ico' } },
    totalTime: 1000,
    history: {
      [YESTERDAY]: { sites: { 'b.com': { totalTime: 400 } }, totalTime: 400, date: YESTERDAY },
    },
    settings: { idleTime: 5, dailyLimit: 8, enableBlocking: false },
    blockedSites: [],
    freeMode: false,
  }) as unknown as StorageData;

describe('mergeRemoteUsage', () => {
  it('should return the data unchanged when there is nothing from other devices', () => {
    const data = local();

    expect(mergeRemoteUsage(data, undefined, TODAY)).toBe(data);
    expect(mergeRemoteUsage(data, {}, TODAY)).toBe(data);
  });

  it('should add other devices to today, summing shared sites', () => {
    const merged: any = mergeRemoteUsage(
      local(),
      { [TODAY]: { sites: { 'a.com': { totalTime: 500, visits: 2 }, 'phone.com': { totalTime: 300 } }, totalTime: 800 } } as any,
      TODAY
    );

    expect(merged.totalTime).toBe(1800);
    expect(merged.sites['a.com']).toMatchObject({ totalTime: 1500, visits: 3, favicon: 'local.ico' });
    expect(merged.sites['phone.com'].totalTime).toBe(300);
  });

  it('should add other devices to past days, including days this device has no record of', () => {
    const merged: any = mergeRemoteUsage(
      local(),
      {
        [YESTERDAY]: { sites: { 'b.com': { totalTime: 100 } }, totalTime: 100 },
        'Sat Jul 19 2025': { sites: { 'c.com': { totalTime: 50 } }, totalTime: 50 },
      } as any,
      TODAY
    );

    expect(merged.history[YESTERDAY].totalTime).toBe(500);
    expect(merged.history[YESTERDAY].sites['b.com'].totalTime).toBe(500);
    expect(merged.history['Sat Jul 19 2025']).toMatchObject({ totalTime: 50, date: 'Sat Jul 19 2025' });
    expect(merged.totalTime).toBe(1000);
  });

  it('should ignore a remote site name that would resolve to the object prototype', () => {
    const remote = JSON.parse(`{"${TODAY}":{"sites":{"__proto__":{"totalTime":500},"ok.com":{"totalTime":100}},"totalTime":600}}`);

    const merged: any = mergeRemoteUsage(local(), remote, TODAY);

    expect(({} as any).totalTime).toBeUndefined();
    expect(Object.getPrototypeOf(merged.sites)).toBe(Object.prototype);
    expect(Object.keys(merged.sites).sort()).toEqual(['a.com', 'ok.com']);
  });

  it('should not modify the stored local data', () => {
    const data: any = local();

    mergeRemoteUsage(data, { [TODAY]: { sites: { 'a.com': { totalTime: 500 } }, totalTime: 500 } } as any, TODAY);
    mergeRemoteUsage(data, { [YESTERDAY]: { sites: { 'b.com': { totalTime: 100 } }, totalTime: 100 } } as any, TODAY);

    expect(data.totalTime).toBe(1000);
    expect(data.sites['a.com'].totalTime).toBe(1000);
    expect(data.history[YESTERDAY].sites['b.com'].totalTime).toBe(400);
  });
});
