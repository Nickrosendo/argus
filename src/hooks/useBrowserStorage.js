import { useState, useEffect } from 'react';

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

export function useBrowserStorage(keys, defaultValues = {}) {
  const [data, setData] = useState(defaultValues);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('useBrowserStorage: Loading data for keys:', keys);
    
    // Load initial data
    browserAPI.storage.local.get(keys, (result) => {
      console.log('useBrowserStorage: Loaded data:', result);
      setData(prevData => ({ ...prevData, ...result }));
      setLoading(false);
    });

    // Listen for storage changes
    const handleStorageChange = (changes, areaName) => {
      console.log('useBrowserStorage: Storage changed:', changes, areaName);
      if (areaName === 'local') {
        const updatedData = {};
        for (const key in changes) {
          if (keys.includes(key)) {
            updatedData[key] = changes[key].newValue;
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

  const updateStorage = (updates) => {
    console.log('useBrowserStorage: Updating storage:', updates);
    browserAPI.storage.local.set(updates, () => {
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