import { useCallback } from 'react';

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

interface AuthSigninRequest {
  action: 'signin';
  username: string;
  password: string;
}

interface AuthSignupRequest {
  action: 'signup';
  username: string;
  password: string;
  email: string;
}

interface SocialAuthRequest {
  action: 'socialAuth';
  provider: 'google' | 'microsoft';
}

interface AuthResponse {
  success: boolean;
  data?: {
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
    };
  };
  error?: string;
}

interface CheckAuthResponse {
  isAuthenticated: boolean;
  userData?: {
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
    };
  };
}

type MessageRequest = AuthSigninRequest | AuthSignupRequest | SocialAuthRequest | { action: 'signout' } | { action: 'checkAuthentication' };
type MessageResponse = AuthResponse | CheckAuthResponse;

export const useBrowserMessaging = () => {
  const sendMessage = useCallback(async <T extends MessageResponse>(
    message: MessageRequest
  ): Promise<T> => {
    try {
      const response = await browserAPI.runtime.sendMessage(message);
      console.log('sendMessage response:', response);
      return response as T;
    } catch (error) {
      console.error('Browser messaging error:', error);
      throw error;
    }
  }, []);

  const signin = async (username: string, password: string): Promise<AuthResponse> => {
    return sendMessage<AuthResponse>({
      action: 'signin',
      username,
      password
    });
  };

  const signup = useCallback(async (username: string, password: string, email: string): Promise<AuthResponse> => {
    return sendMessage<AuthResponse>({
      action: 'signup',
      username,
      password,
      email
    });
  }, [sendMessage]);

  const socialAuth = useCallback(async (provider: 'google' | 'microsoft'): Promise<AuthResponse> => {
    return sendMessage<AuthResponse>({
      action: 'socialAuth',
      provider
    });
  }, [sendMessage]);

  const signout = useCallback(async (): Promise<AuthResponse> => {
    return sendMessage<AuthResponse>({
      action: 'signout'
    });
  }, [sendMessage]);

  const checkAuthentication = useCallback(async (): Promise<CheckAuthResponse> => {
    return sendMessage<CheckAuthResponse>({
      action: 'checkAuthentication'
    });
  }, [sendMessage]);

  return {
    sendMessage,
    signin,
    signup,
    socialAuth,
    signout,
    checkAuthentication
  };
}; 
