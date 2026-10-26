// Storage data type definitions
import type { ThemeSetting } from '../lib/theme';

export interface Settings {
  idleTime: number;
  dailyLimit: number;
  enableBlocking: boolean;
  trackingPaused?: boolean;
  theme?: ThemeSetting; // light, dark or follow the computer (default)
}

export interface SiteInfo {
  totalTime: number;
  visits?: number;
  lastVisit?: number;
  favicon?: string;
  title?: string;
}

export interface SiteData {
  [domain: string]: SiteInfo; // domain -> site info
}

export interface DayData {
  totalTime: number;
  sites?: SiteData;
  hourly?: number[]; // milliseconds per hour of day (24 items)
  date?: string;
}

export interface HistoryData {
  [date: string]: DayData; // date -> day data for that date
}

export interface FocusSession {
  startedAt: number;
  endsAt: number;
  minutes: number;
}

export interface FocusStats {
  date: string;
  started: number;
  completed: number;
  focusTime: number; // milliseconds
  blocked: number;
}

export interface StorageData {
  sites: SiteData;
  totalTime: number;
  hourly?: number[]; // today's milliseconds per hour of day (24 items)
  history: HistoryData;
  settings: Settings;
  blockedSites: string[];
  blockingEnabled?: boolean;
  focusSession?: FocusSession | null; // set while a focus session is running
  focusStats?: FocusStats; // today's focus numbers
  onboardingDone?: boolean; // the first-run welcome was dismissed
  lastUpdated?: string;
}

export type StorageKey = keyof StorageData;

export interface UpdateStorageFunction {
  (updates: Partial<StorageData>): void;
} 
