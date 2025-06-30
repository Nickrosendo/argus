/**
 * SocialAuthService
 * Handles OAuth 2.0 authentication with Google and Microsoft for social login
 * Simplified version using Chrome Identity API without manual redirect URL handling
 */

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

/**
 * SocialAuthService class for handling OAuth authentication
 */
export const SocialAuthService = {
  /**
   * OAuth configurations for different providers
   */
  OAUTH_CONFIGS: {
    google: {
      // Google uses chrome.identity.getAuthToken() with manifest oauth2 config
      clientId: process.env.GOOGLE_CLIENT_ID || __GOOGLE_CLIENT_ID__,
      scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo'
    },
    microsoft: {
      // Microsoft uses launchWebAuthFlow with simplified URL handling
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      clientId: process.env.MICROSOFT_CLIENT_ID || __MICROSOFT_CLIENT_ID__,
      scopes: ['https://graph.microsoft.com/User.Read'],
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me'
    }
  },

  /**
   * Initiate OAuth login flow for the specified provider
   * @param {string} provider - 'google' or 'microsoft'
   * @returns {Promise<Object>} User information and tokens
   */
  async loginWithProvider(provider) {
    try {
      if (!this.OAUTH_CONFIGS[provider]) {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      console.log(`Starting ${provider} OAuth flow...`);
      
      // Get OAuth token using provider-specific method
      const authToken = await this.getAuthToken(provider);
      
      // Get user information
      const userInfo = await this.getUserInfo(provider, authToken);

      console.log('userInfo for priovider:', provider, userInfo);
      
      // Return structured user data
      return {
        provider,
        authToken,
        user: {
          id: userInfo.id,
          email: userInfo.email || userInfo.mail || userInfo.userPrincipalName,
          name: userInfo.name || userInfo.displayName || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim(),
          picture: userInfo.picture || userInfo.photo,
          provider
        }
      };
    } catch (error) {
      console.error(`OAuth login error for ${provider}:`, error);
      throw error;
    }
  },

  /**
   * Get authentication token for the specified provider
   * @param {string} provider - 'google' or 'microsoft'
   * @returns {Promise<string>} Access token
   */
  async getAuthToken(provider) {
    if (provider === 'google') {
      return this.getGoogleAuthToken();
    } else if (provider === 'microsoft') {
      return this.getMicrosoftAuthToken();
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  },

  /**
   * Get Google authentication token using Chrome Identity API
   * @returns {Promise<string>} Access token
   */
  async getGoogleAuthToken() {
    return new Promise((resolve, reject) => {
      if (!browserAPI.identity || !browserAPI.identity.getAuthToken) {
        reject(new Error('Chrome Identity API not available'));
        return;
      }

      console.log('Using Chrome Identity API for Google authentication...');
      
      browserAPI.identity.getAuthToken(
        { 
          interactive: true,
          scopes: this.OAUTH_CONFIGS.google.scopes
        },
        (token) => {
          if (browserAPI.runtime.lastError) {
            console.error('Google auth error:', browserAPI.runtime.lastError);
            reject(new Error(browserAPI.runtime.lastError.message));
            return;
          }
          
          if (!token) {
            reject(new Error('No auth token received from Google'));
            return;
          }
          
          console.log('Successfully received Google auth token');
          resolve(token);
        }
      );
    });
  },

  /**
   * Get Microsoft authentication token using simplified web auth flow
   * @returns {Promise<string>} Access token
   */
  async getMicrosoftAuthToken() {
    return new Promise((resolve, reject) => {
      if (!browserAPI.identity || !browserAPI.identity.launchWebAuthFlow) {
        reject(new Error('Chrome Identity API not available'));
        return;
      }

      const config = this.OAUTH_CONFIGS.microsoft;
      
      // Build auth URL with automatic redirect URL from Chrome
      const redirectUrl = browserAPI.identity.getRedirectURL();
      const authUrl = this.buildMicrosoftAuthUrl(config, redirectUrl);
      
      console.log('Launching Microsoft web auth flow...');
      console.log('Auth URL:', authUrl);
      
      browserAPI.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true
        },
        (responseUrl) => {
          if (browserAPI.runtime.lastError) {
            console.error('Microsoft auth error:', browserAPI.runtime.lastError);
            reject(new Error(browserAPI.runtime.lastError.message));
            return;
          }
          
          if (!responseUrl) {
            reject(new Error('No response URL received from Microsoft OAuth'));
            return;
          }
          
          try {
            const token = this.extractTokenFromUrl(responseUrl);
            console.log('Successfully extracted Microsoft auth token');
            resolve(token);
          } catch (error) {
            console.error('Error extracting token from Microsoft response:', error);
            reject(error);
          }
        }
      );
    });
  },

  /**
   * Build Microsoft OAuth authorization URL
   * @param {Object} config - OAuth configuration
   * @param {string} redirectUrl - Redirect URL from Chrome Identity API
   * @returns {string} Authorization URL
   */
  buildMicrosoftAuthUrl(config, redirectUrl) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUrl,
      response_type: 'token',
      scope: config.scopes.join(' '),
      response_mode: 'fragment',
      state: Math.random().toString(36).substring(2, 15)
    });
    
    return `${config.authUrl}?${params.toString()}`;
  },

  /**
   * Extract access token from OAuth redirect URL
   * @param {string} url - Redirect URL containing token
   * @returns {string} Access token
   */
  extractTokenFromUrl(url) {
    console.log('Extracting token from URL:', url);
    
    // Try to get token from URL fragment first (Microsoft OAuth)
    const fragmentParams = new URLSearchParams(url.split('#')[1] || '');
    let accessToken = fragmentParams.get('access_token');
    
    // If not in fragment, try query parameters
    if (!accessToken) {
      const queryParams = new URLSearchParams(url.split('?')[1] || '');
      accessToken = queryParams.get('access_token');
    }
    
    if (!accessToken) {
      // Check for error in response
      const error = fragmentParams.get('error') || new URLSearchParams(url.split('?')[1] || '').get('error') || 'No access token received';
      const errorDescription = fragmentParams.get('error_description') || new URLSearchParams(url.split('?')[1] || '').get('error_description') || '';
      throw new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
    }
    
    return accessToken;
  },

  /**
   * Get user information from provider API
   * @param {string} provider - 'google' or 'microsoft'
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User information
   */
  async getUserInfo(provider, accessToken) {
    const config = this.OAUTH_CONFIGS[provider];
    
    console.log(`Fetching user info from ${provider}...`);
    
    const response = await fetch(config.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get user info from ${provider}: ${response.statusText}`);
    }
    
    const userInfo = await response.json();
    console.log(`Successfully retrieved user info from ${provider}`);
    
    return userInfo;
  },

  /**
   * Sign in with Google
   * @returns {Promise<Object>} User data and tokens
   */
  async signInWithGoogle() {
    return this.loginWithProvider('google');
  },

  /**
   * Sign in with Microsoft/Outlook
   * @returns {Promise<Object>} User data and tokens
   */
  async signInWithMicrosoft() {
    return this.loginWithProvider('microsoft');
  },

  /**
   * Sign out from Google (revoke token)
   * @returns {Promise<void>}
   */
  async signOutFromGoogle() {
    return new Promise((resolve, reject) => {
      if (!browserAPI.identity || !browserAPI.identity.removeCachedAuthToken) {
        resolve(); // Gracefully handle if API not available
        return;
      }

      // First get the cached token
      browserAPI.identity.getAuthToken({ interactive: false }, (token) => {
        if (token) {
          // Remove the cached token
          browserAPI.identity.removeCachedAuthToken({ token }, () => {
            console.log('Google auth token removed from cache');
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }
};
