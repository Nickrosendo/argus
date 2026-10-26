// Browser extension API types
export interface Tab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  windowId?: number;
}

export interface StorageArea {
  get(keys?: string | string[] | { [key: string]: any } | null, callback?: (result: { [key: string]: any }) => void): Promise<{ [key: string]: any }>;
  set(items: { [key: string]: any }, callback?: () => void): Promise<void>;
  remove(keys: string | string[], callback?: () => void): Promise<void>;
  clear(callback?: () => void): Promise<void>;
}

export interface StorageChangeEvent {
  [key: string]: {
    oldValue?: any;
    newValue?: any;
  };
}

export interface Runtime {
  onMessage: {
    addListener(callback: (message: any, sender: any, sendResponse: (response?: any) => void) => void): void;
  };
  sendMessage(message: any): Promise<any>;
  getURL(path: string): string;
  lastError?: Error;
}

export interface DeclarativeNetRequest {
  getDynamicRules(callback: (rules: any[]) => void): void;
  updateDynamicRules(options: {
    removeRuleIds?: number[];
    addRules?: any[];
  }): void;
}

export interface BrowserAPI {
  tabs: {
    query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
    create(createProperties: { url: string }): Promise<Tab>;
    onActivated: {
      addListener(callback: (activeInfo: { tabId: number; windowId: number }) => void): void;
    };
    onUpdated: {
      addListener(callback: (tabId: number, changeInfo: any, tab: Tab) => void): void;
    };
  };
  storage: {
    local: StorageArea;
    sync: StorageArea;
    onChanged: {
      addListener(callback: (changes: StorageChangeEvent, areaName: string) => void): void;
      removeListener(callback: (changes: StorageChangeEvent, areaName: string) => void): void;
    };
  };
  runtime: Runtime;
  declarativeNetRequest?: DeclarativeNetRequest;
}

declare global {
  const chrome: BrowserAPI;
  const browser: BrowserAPI;
  
  // Build-time constants (replaced during build process)
  const __GOOGLE_CLIENT_ID__: string;
  const __MICROSOFT_CLIENT_ID__: string;
  const __ENABLE_MICROSOFT_AUTH__: string;
  const __VERSION__: string;
} 
