/**
 * AuthService
 * Handles authentication with the Argus API, including login, signup, and token management.
 */

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

/**
 * AuthService class for handling API authentication
 */
class AuthService {
  constructor() {
    this.config = {
      // API_BASE_URL: 'https://argus-api-z73bt.kinsta.app',
      API_BASE_URL: process.env.API_URL,
      endpoints: {
        login: '/auth/login',
        register: '/auth/register',
        logout: '/auth/logout',
        refresh: '/auth/refresh',
        profile: '/auth/profile'
      }
    };
    
    // Authentication cache to minimize API requests
    this.authCache = {
      isAuthenticated: null,
      lastCheck: null,
      cacheValidityMs: 5 * 60 * 1000, // 5 minutes cache
      token: null
    };
  }

  /**
   * Check if the user is authenticated with intelligent caching
   * This method caches the authentication status to minimize API requests
   * @param {boolean} forceRefresh Force a fresh check ignoring cache
   * @returns {Promise<boolean>} True if authenticated, false otherwise
   */
  async isAuthenticated(forceRefresh = false) {
    try {
      const token = await this.getToken();
      
      if (!token) {
        // No token means definitely not authenticated
        this.authCache.isAuthenticated = false;
        this.authCache.lastCheck = Date.now();
        this.authCache.token = null;
        return false;
      }
      
      // If token changed, invalidate cache
      if (this.authCache.token !== token) {
        this.authCache.isAuthenticated = null;
        this.authCache.lastCheck = null;
        this.authCache.token = token;
      }
      
      // Check if we have a valid cached result and don't need to force refresh
      const now = Date.now();
      const cacheValid = this.authCache.lastCheck && 
                        (now - this.authCache.lastCheck) < this.authCache.cacheValidityMs;
      
      if (!forceRefresh && cacheValid && this.authCache.isAuthenticated !== null) {
        console.log('AuthService: Using cached authentication status:', this.authCache.isAuthenticated);
        return this.authCache.isAuthenticated;
      }
      
      // Need to verify token with server
      console.log('AuthService: Verifying token with server...');
      const verified = await this.verifyToken(token);

      if (verified === null) {
        // Could not reach the server: keep the token and the previous answer,
        // and check again next time instead of signing the user out
        return this.authCache.isAuthenticated !== false;
      }
      
      // Update cache
      this.authCache.isAuthenticated = verified;
      this.authCache.lastCheck = now;
      this.authCache.token = token;
      
      if (!verified) {
        // Token is invalid, clear it
        await this.clearToken();
        this.authCache.token = null;
      }
      
      return verified;
    } catch (error) {
      console.error('Auth check error:', error);
      // On error, invalidate cache and return false
      this.authCache.isAuthenticated = false;
      this.authCache.lastCheck = Date.now();
      return false;
    }
  }

  /**
   * Clear authentication cache
   * Call this when authentication state changes (login, logout, etc.)
   */
  clearAuthCache() {
    this.authCache.isAuthenticated = null;
    this.authCache.lastCheck = null;
    this.authCache.token = null;
    console.log('AuthService: Authentication cache cleared');
  }

  /**
   * Sign up a new user
   * @param {string} username The username to register
   * @param {string} password The password for the new account
   * @param {string} email The email address for the new account
   * @returns {Promise<Object>} The response data with the access token
   */
  async signup(username, password, email) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          email
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to sign up');
      }

      const data = await response.json();
      
      // Save the access token to local storage
      await this.saveToken(data.accessToken);
      
      // Save user info to storage if available
      if (data.user) {
        await this.saveUserInfo(data.user);
      }
      
      // Clear cache since authentication state changed
      this.clearAuthCache();
      
      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  /**
   * Sign in an existing user
   * @param {string} username The username
   * @param {string} password The password
   * @returns {Promise<Object>} The response data with the access token
   */
  async signin(username, password) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to sign in');
      }

      const data = await response.json();
      
      // Save the access token to local storage
      await this.saveToken(data.accessToken);
      
      // Save user info to storage if available
      if (data.user) {
        await this.saveUserInfo(data.user);
      }
      
      // Clear cache since authentication state changed
      this.clearAuthCache();
      
      return data;
    } catch (error) {
      console.error('Signin error:', error);
      throw error;
    }
  }

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signout() {
    try {
      await this.clearToken();
      
      // Clear stored user info
      await this.clearUserInfo();
      
      // Clear cache since authentication state changed
      this.clearAuthCache();
    } catch (error) {
      console.error('Signout error:', error);
      throw error;
    }
  }

  /**
   * Verify if a token is valid
   * @param {string} token The JWT token to verify
   * @returns {Promise<boolean>} True if valid, false otherwise
   */
  async verifyToken(token) {
    try {
      const response = await fetch(`${this.config.API_BASE_URL}/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) return true;
      // Only an explicit rejection means the token is bad. A server error or
      // rate limit says nothing about the token.
      return response.status === 401 || response.status === 403 ? false : null;
    } catch (error) {
      // Offline or the server is unreachable: unknown
      console.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Get the current authentication token
   * @returns {Promise<string|null>} The token or null if not found
   */
  async getToken() {
    return new Promise((resolve) => {
      browserAPI.storage.local.get(['authToken'], (result) => {
        resolve(result.authToken || null);
      });
    });
  }

  /**
   * Save an authentication token
   * @param {string} token The token to save
   * @returns {Promise<void>}
   */
  async saveToken(token) {
    return new Promise((resolve) => {
      browserAPI.storage.local.set({ 'authToken': token }, () => {
        // Clear cache when token changes
        this.clearAuthCache();
        resolve();
      });
    });
  }

  /**
   * Clear the authentication token
   * @returns {Promise<void>}
   */
  async clearToken() {
    return new Promise((resolve) => {
      browserAPI.storage.local.remove(['authToken'], () => {
        // Clear cache when token is removed
        this.clearAuthCache();
        resolve();
      });
    });
  }

  /**
   * Get stored user information from browser storage
   * @returns {Promise<Object|null>} The stored user info or null if not found
   */
  async getStoredUserInfo() {
    return new Promise((resolve) => {
      browserAPI.storage.local.get(['userInfo'], (result) => {
        resolve(result.userInfo || null);
      });
    });
  }

  /**
   * Save user information to browser storage
   * @param {Object} userInfo The user information to save
   * @returns {Promise<void>}
   */
  async saveUserInfo(userInfo) {
    return new Promise((resolve) => {
      browserAPI.storage.local.set({ 'userInfo': userInfo }, () => {
        resolve();
      });
    });
  }

  /**
   * Clear stored user information from browser storage
   * @returns {Promise<void>}
   */
  async clearUserInfo() {
    return new Promise((resolve) => {
      browserAPI.storage.local.remove(['userInfo'], () => {
        resolve();
      });
    });
  }

  /**
   * Get the authenticated user data
   * @returns {Promise<Object|null>} The user data or null if not authenticated
   */
  async getUserData() {
    try {
      const token = await this.getToken();
      
      if (!token) {
        return null;
      }

      // First try to get user data from storage (includes the database ID)
      const storedUserInfo = await this.getStoredUserInfo();
      
      if (storedUserInfo && storedUserInfo.id) {
        // If we have stored user info with ID, fetch fresh data using the actual database ID
        const response = await fetch(`${this.config.API_BASE_URL}/users/${storedUserInfo.id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          return await response.json();
        }
        
        // If user-specific endpoint fails, fall back to /auth/me
        console.warn('Failed to fetch user by ID, falling back to /auth/me');
      }
      
      // Fallback to /auth/me if no stored user info or user-specific fetch failed
      const response = await fetch(`${this.config.API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, clear it and cache
          await this.clearToken();
        }
        throw new Error(`Failed to get user data: ${response.status}`);
      }
      
      const userData = await response.json();
      
      // Store the user data for next time (so we can use the database ID)
      await this.saveUserInfo(userData);
      
      return userData;
    } catch (error) {
      console.error('Get user data error:', error);
      return null;
    }
  }

  /**
   * Force a sync check - useful when user manually requests sync
   * This bypasses the cache and forces a fresh authentication check
   * @returns {Promise<boolean>} True if authenticated, false otherwise
   */
  async forceSyncCheck() {
    console.log('AuthService: Force sync check requested');
    return await this.isAuthenticated(true);
  }

  /**
   * Get the API base URL
   * @returns {string} The API base URL
   */
  get API_BASE_URL() {
    return this.config.API_BASE_URL;
  }
}

// Export a singleton instance
const authService = new AuthService();
export default authService;
