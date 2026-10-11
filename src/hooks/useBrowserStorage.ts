import { useState, useEffect } from 'react';
import { StorageData, StorageKey } from '../types/storage';

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

interface UseBrowserStorageReturn<T> {
  data: T;
  loading: boolean;
  updateStorage: (updates: Partial<StorageData>) => void;
}

export function useBrowserStorage<T extends Partial<StorageData>>(
  keys: StorageKey[],
  defaultValues: T = {} as T
): UseBrowserStorageReturn<T> {
  const [data, setData] = useState<T>(defaultValues);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Load initial data
    browserAPI.storage.local.get(keys, (result: Partial<StorageData>) => {
      setData(prevData => ({ ...prevData, ...result } as T));
      setLoading(false);
    });

    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: any }, areaName: string): void => {
      if (areaName === 'local') {
        const updatedData: Partial<StorageData> = {};
        for (const key in changes) {
          if (keys.includes(key as StorageKey)) {
            (updatedData as any)[key] = changes[key].newValue;
          }
        }
        if (Object.keys(updatedData).length > 0) {
          setData(prevData => ({ ...prevData, ...updatedData }));
        }
      }
    };

    browserAPI.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browserAPI.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [keys.join(',')]); // Convert keys array to string for dependency

  const updateStorage = (updates: Partial<StorageData>): void => {
    browserAPI.storage.local.set(updates as any, () => {
      if (browserAPI.runtime.lastError) {
        console.error('useBrowserStorage: Error updating storage:', browserAPI.runtime.lastError);
      } else {
        setData(prevData => ({ ...prevData, ...updates }));
      }
    });
  };

  return { data, loading, updateStorage };
} 
