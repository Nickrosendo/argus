/**
 * SocialAuthService
 * Handles OAuth 2.0 authentication with Google and Microsoft for social login
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
      authUrl: 'https://accounts.google.com/oauth/authorize',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      clientId: '450760387971-ierhhjcfqk21pn7v062mh8gda3iml283.apps.googleusercontent.com',
      redirectUri: browserAPI.identity ? browserAPI.identity.getRedirectURL() : 'chrome-extension://hjcigmcmcdpphbbblkmmjlmocogceeko/oauth.html',
      scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']
    },
    microsoft: {
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      clientId: 'YOUR_MICROSOFT_CLIENT_ID',
      redirectUri: browserAPI.identity ? browserAPI.identity.getRedirectURL() : 'chrome-extension://YOUR_EXTENSION_ID/oauth.html',
      scopes: ['https://graph.microsoft.com/User.Read']
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

      const config = this.OAUTH_CONFIGS[provider];
      
      // Get OAuth token
      const authToken = await this.getOAuthToken(config);
      
      // Get user information
      const userInfo = await this.getUserInfo(config, authToken);
      
      // Return structured user data
      return {
        provider,
        authToken,
        user: {
          id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim(),
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
   * Get OAuth token using Chrome identity API or manual flow
   * @param {Object} config - OAuth configuration
   * @returns {Promise<string>} Access token
   */
  async getOAuthToken(config) {
    // Try Chrome identity API first (works in Chrome)
    if (browserAPI.identity && browserAPI.identity.launchWebAuthFlow) {
      return this.getChromeIdentityToken(config);
    }
    
    // Fallback to manual OAuth flow (for Firefox and other browsers)
    return this.getManualOAuthToken(config);
  },

  /**
   * Use Chrome identity API for OAuth
   * @param {Object} config - OAuth configuration
   * @returns {Promise<string>} Access token
   */
  async getChromeIdentityToken(config) {
    const authUrl = this.buildAuthUrl(config);
    console.log('Chrome Identity API - Auth URL:', authUrl);
    console.log('Chrome Identity API - Config:', config);
    
    return new Promise((resolve, reject) => {
      // Check if identity API is available
      if (!browserAPI.identity || !browserAPI.identity.launchWebAuthFlow) {
        reject(new Error('Chrome Identity API not available'));
        return;
      }

      console.log('Launching Chrome Identity web auth flow...');
      browserAPI.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true
        },
        (responseUrl) => {
          console.log('Chrome Identity response URL:', responseUrl);
          console.log('Chrome runtime lastError:', browserAPI.runtime.lastError);
          
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message));
            return;
          }
          
          if (!responseUrl) {
            reject(new Error('No response URL received from OAuth flow'));
            return;
          }
          
          try {
            const token = this.extractTokenFromUrl(responseUrl);
            console.log('Successfully extracted token from response URL');
            resolve(token);
          } catch (error) {
            console.error('Error extracting token from URL:', error);
            reject(error);
          }
        }
      );
    });
  },

  /**
   * Manual OAuth flow for browsers that don't support identity API
   * @param {Object} config - OAuth configuration
   * @returns {Promise<string>} Access token
   */
  async getManualOAuthToken(config) {
    const authUrl = this.buildAuthUrl(config);
    
    // Create a popup window for OAuth
    return new Promise((resolve, reject) => {
      const popup = window.open(authUrl, 'oauth', 'width=500,height=600');
      
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          reject(new Error('OAuth popup was closed by user'));
        }
      }, 1000);
      
      // Listen for postMessage from oauth popup
      window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'OAUTH_SUCCESS') {
          clearInterval(checkClosed);
          popup.close();
          resolve(event.data.token);
        } else if (event.data.type === 'OAUTH_ERROR') {
          clearInterval(checkClosed);
          popup.close();
          reject(new Error(event.data.error));
        }
      }, { once: true });
    });
  },

  /**
   * Build OAuth authorization URL
   * @param {Object} config - OAuth configuration
   * @returns {string} Authorization URL
   */
  buildAuthUrl(config) {
    console.log('Building auth URL with config:', config);
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'token',
      scope: config.scopes.join(' '),
      state: Math.random().toString(36).substring(2, 15)
    });
    
    const authUrl = `${config.authUrl}?${params.toString()}`;
    console.log('Built auth URL:', authUrl);
    console.log('Auth URL params:', {
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'token',
      scope: config.scopes.join(' ')
    });
    
    return authUrl;
  },

  /**
   * Extract access token from OAuth redirect URL
   * @param {string} url - Redirect URL containing token
   * @returns {string} Access token
   */
  extractTokenFromUrl(url) {
    const urlParams = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
    const accessToken = urlParams.get('access_token');
    
    if (!accessToken) {
      const error = urlParams.get('error') || 'No access token received';
      throw new Error(`OAuth error: ${error}`);
    }
    
    return accessToken;
  },

  /**
   * Get user information from provider API
   * @param {Object} config - OAuth configuration
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User information
   */
  async getUserInfo(config, accessToken) {
    const response = await fetch(config.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }
    
    return response.json();
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
  }
};
