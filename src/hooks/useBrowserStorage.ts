import { useState, useEffect } from 'react';
import { StorageData, StorageKey } from '../types/storage';

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

interface UseBrowserStorageReturn<T> {
  data: T;
  loading: boolean;
  updateStorage: (updates: Partial<T>) => void;
}

export function useBrowserStorage<T extends Partial<StorageData>>(
  keys: StorageKey[],
  defaultValues: T = {} as T
): UseBrowserStorageReturn<T> {
  const [data, setData] = useState<T>(defaultValues);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    console.log('useBrowserStorage: Loading data for keys:', keys);
    
    // Load initial data
    browserAPI.storage.local.get(keys, (result: Partial<StorageData>) => {
      console.log('useBrowserStorage: Loaded data:', result);
      setData(prevData => ({ ...prevData, ...result } as T));
      setLoading(false);
    });

    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: any }, areaName: string): void => {
      console.log('useBrowserStorage: Storage changed:', changes, areaName);
      if (areaName === 'local') {
        const updatedData: Partial<T> = {};
        for (const key in changes) {
          if (keys.includes(key as StorageKey)) {
            (updatedData as any)[key] = changes[key].newValue;
          }
        }
        if (Object.keys(updatedData).length > 0) {
          console.log('useBrowserStorage: Updating data:', updatedData);
          setData(prevData => ({ ...prevData, ...updatedData }));
        }
      }
    };

    browserAPI.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browserAPI.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [keys.join(',')]); // Convert keys array to string for dependency

  const updateStorage = (updates: Partial<T>): void => {
    console.log('useBrowserStorage: Updating storage:', updates);
    browserAPI.storage.local.set(updates as any, () => {
      if (browserAPI.runtime.lastError) {
        console.error('useBrowserStorage: Error updating storage:', browserAPI.runtime.lastError);
      } else {
        console.log('useBrowserStorage: Storage updated successfully');
        setData(prevData => ({ ...prevData, ...updates }));
      }
    });
  };

  return { data, loading, updateStorage };
} 