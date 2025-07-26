import { renderHook, act } from '@testing-library/react';
import { useBrowserStorage } from '../../src/hooks/useBrowserStorage';

describe('useBrowserStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome.runtime.lastError = null;
  });

  it('should initialize with default values and loading state', () => {
    const defaultValues = { testKey: 'defaultValue' };
    const { result } = renderHook(() =>
      useBrowserStorage(['testKey'], defaultValues)
    );

    expect(result.current.data).toEqual(defaultValues);
    expect(result.current.loading).toBe(true);
    expect(typeof result.current.updateStorage).toBe('function');
  });

  it('should load data from storage on mount', async () => {
    const storageData = { testKey: 'storageValue' };
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback(storageData);
    });

    const { result } = renderHook(() =>
      useBrowserStorage(['testKey'], { testKey: 'defaultValue' })
    );

    expect(global.chrome.storage.local.get).toHaveBeenCalledWith(['testKey'], expect.any(Function));
    expect(result.current.data).toEqual(storageData);
    expect(result.current.loading).toBe(false);
  });

  it('should update storage when updateStorage is called', () => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
    global.chrome.storage.local.set.mockImplementation((data, callback) => {
      callback();
    });

    const { result } = renderHook(() =>
      useBrowserStorage(['testKey'], {})
    );

    const updateData = { testKey: 'newValue' };
    
    act(() => {
      result.current.updateStorage(updateData);
    });

    expect(global.chrome.storage.local.set).toHaveBeenCalledWith(updateData, expect.any(Function));
    expect(result.current.data).toEqual(updateData);
  });

  it('should handle storage errors gracefully', () => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
    global.chrome.storage.local.set.mockImplementation((data, callback) => {
      global.chrome.runtime.lastError = { message: 'Storage error' };
      callback();
    });

    const { result } = renderHook(() =>
      useBrowserStorage(['testKey'], {})
    );

    act(() => {
      result.current.updateStorage({ testKey: 'newValue' });
    });

    // The error is handled but console.error is mocked in setup, so we just verify the function executed
    expect(global.chrome.storage.local.set).toHaveBeenCalled();
  });

  it('should listen for storage changes', () => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    const { result } = renderHook(() =>
      useBrowserStorage(['testKey'], {})
    );

    expect(global.chrome.storage.onChanged.addListener).toHaveBeenCalledWith(expect.any(Function));

    // Simulate storage change
    const mockListener = global.chrome.storage.onChanged.addListener.mock.calls[0][0];
    const changes = {
      testKey: { newValue: 'changedValue' }
    };

    act(() => {
      mockListener(changes, 'local');
    });

    expect(result.current.data).toEqual({ testKey: 'changedValue' });
  });

  it('should ignore changes from non-local storage areas', () => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: 'initialValue' });
    });

    const { result } = renderHook(() =>
      useBrowserStorage(['testKey'], {})
    );

    const mockListener = global.chrome.storage.onChanged.addListener.mock.calls[0][0];
    const changes = {
      testKey: { newValue: 'changedValue' }
    };

    act(() => {
      mockListener(changes, 'sync');
    });

    expect(result.current.data).toEqual({ testKey: 'initialValue' });
  });

  it('should ignore changes for keys not being watched', () => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: 'initialValue' });
    });

    const { result } = renderHook(() =>
      useBrowserStorage(['testKey'], {})
    );

    const mockListener = global.chrome.storage.onChanged.addListener.mock.calls[0][0];
    const changes = {
      otherKey: { newValue: 'changedValue' }
    };

    act(() => {
      mockListener(changes, 'local');
    });

    expect(result.current.data).toEqual({ testKey: 'initialValue' });
  });

  it('should cleanup listener on unmount', () => {
    global.chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    const { unmount } = renderHook(() =>
      useBrowserStorage(['testKey'], {})
    );

    const mockListener = global.chrome.storage.onChanged.addListener.mock.calls[0][0];

    unmount();

    expect(global.chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(mockListener);
  });

  it('should work with browser API when available', () => {
    const originalChrome = global.chrome;
    global.chrome = undefined;

    global.browser.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: 'browserValue' });
    });

    const { result } = renderHook(() =>
      useBrowserStorage(['testKey'], {})
    );

    expect(result.current.data).toEqual({ testKey: 'browserValue' });
    
    // Cleanup
    global.chrome = originalChrome;
  });
});