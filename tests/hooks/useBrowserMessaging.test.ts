import { renderHook, act } from '@testing-library/react';
import { useBrowserMessaging } from '../../src/hooks/useBrowserMessaging';

describe('useBrowserMessaging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide messaging functions', () => {
    const { result } = renderHook(() => useBrowserMessaging());

    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.signin).toBe('function');
    expect(typeof result.current.signup).toBe('function');
    expect(typeof result.current.socialAuth).toBe('function');
    expect(typeof result.current.signout).toBe('function');
    expect(typeof result.current.checkAuthentication).toBe('function');
  });

  it('should send generic messages', async () => {
    const { result } = renderHook(() => useBrowserMessaging());

    let response;
    await act(async () => {
      response = await result.current.sendMessage({ action: 'checkAuthentication' });
    });

    expect(response).toEqual({ isAuthenticated: false });
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'checkAuthentication' });
  });

  it('should handle sendMessage errors', async () => {
    const mockError = new Error('Browser messaging failed');
    global.chrome.runtime.sendMessage.mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useBrowserMessaging());

    await act(async () => {
      await expect(result.current.sendMessage({ action: 'checkAuthentication' })).rejects.toThrow('Browser messaging failed');
    });
  });

  it('should sign in with username and password', async () => {
    const { result } = renderHook(() => useBrowserMessaging());

    let response;
    await act(async () => {
      response = await result.current.signin('testuser', 'password123');
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'signin',
      username: 'testuser',
      password: 'password123'
    });
    expect(response.success).toBe(true);
    expect(response.data.user.name).toBe('testuser');
  });

  it('should sign up with username, password, and email', async () => {
    const { result } = renderHook(() => useBrowserMessaging());

    let response;
    await act(async () => {
      response = await result.current.signup('testuser', 'password123', 'test@test.com');
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'signup',
      username: 'testuser',
      password: 'password123',
      email: 'test@test.com'
    });
    expect(response.success).toBe(true);
    expect(response.data.user.email).toBe('test@test.com');
  });

  it('should perform social auth with Google', async () => {
    const mockResponse = { 
      success: true,
      data: {
        token: 'google-token',
        user: { id: '1', email: 'google@test.com', name: 'Google User' }
      }
    };
    global.chrome.runtime.sendMessage.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useBrowserMessaging());

    let response;
    await act(async () => {
      response = await result.current.socialAuth('google');
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'socialAuth',
      provider: 'google'
    });
    expect(response).toEqual(mockResponse);
  });

  it('should perform social auth with Microsoft', async () => {
    const mockResponse = { 
      success: true,
      data: {
        token: 'microsoft-token',
        user: { id: '1', email: 'microsoft@test.com', name: 'Microsoft User' }
      }
    };
    global.chrome.runtime.sendMessage.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useBrowserMessaging());

    let response;
    await act(async () => {
      response = await result.current.socialAuth('microsoft');
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'socialAuth',
      provider: 'microsoft'
    });
    expect(response).toEqual(mockResponse);
  });

  it('should sign out', async () => {
    const { result } = renderHook(() => useBrowserMessaging());

    let response;
    await act(async () => {
      response = await result.current.signout();
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'signout'
    });
    expect(response).toEqual({ success: true });
  });

  it('should check authentication status', async () => {
    const { result } = renderHook(() => useBrowserMessaging());

    let response;
    await act(async () => {
      response = await result.current.checkAuthentication();
    });

    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'checkAuthentication'
    });
    expect(response).toEqual({ isAuthenticated: false });
  });

  it('should work with browser API when available', async () => {
    const originalChrome = global.chrome;
    global.chrome = undefined;

    const { result } = renderHook(() => useBrowserMessaging());

    await act(async () => {
      await result.current.sendMessage({ action: 'signout' });
    });

    expect(global.browser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'signout' });
    
    // Cleanup
    global.chrome = originalChrome;
  });

  it('should handle authentication failure', async () => {
    const mockResponse = { 
      success: false,
      error: 'Invalid credentials'
    };
    global.chrome.runtime.sendMessage.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useBrowserMessaging());

    let response;
    await act(async () => {
      response = await result.current.signin('wronguser', 'wrongpass');
    });

    expect(response).toEqual(mockResponse);
    expect(response.success).toBe(false);
    expect(response.error).toBe('Invalid credentials');
  });
});