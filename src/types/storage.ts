// Storage data type definitions

export interface Settings {
  idleTime: number;
  dailyLimit: number;
  showNotifications: boolean;
  enableBlocking: boolean;
}

export interface SiteInfo {
  totalTime: number;
  favicon?: string;
}

export interface SiteData {
  [domain: string]: SiteInfo; // domain -> site info
}

export interface DayData {
  totalTime: number;
  [domain: string]: number | SiteInfo; // Can contain both totalTime and site data
}

export interface HistoryData {
  [date: string]: DayData; // date -> day data for that date
}

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
}

export interface StorageData {
  sites: SiteData;
  totalTime: number;
  history: HistoryData;
  settings: Settings;
  blockedSites: string[];
  authToken?: string | boolean | null;
  userInfo?: UserInfo | null;
  freeMode: boolean;
}

export type StorageKey = keyof StorageData;

export interface UpdateStorageFunction {
  (updates: Partial<StorageData>): void;
} 
