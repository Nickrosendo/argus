/**
 * AuthService
 * Handles authentication with the Argus API, including login, signup, and token management.
 */

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

/**
 * AuthService class for handling API authentication
 */
const AuthService = {
  /**
   * API base URL
   * In a production environment, this should be configurable or loaded from environment variables
   */
  API_BASE_URL: 'http://localhost:3000',

  /**
   * Sign up a new user
   * @param {string} username The username to register
   * @param {string} password The password for the new account
   * @param {string} email The email address for the new account
   * @returns {Promise<Object>} The response data with the access token
   */
  async signup(username, password, email) {
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/signup`, {
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
      
      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  },

  /**
   * Sign in an existing user
   * @param {string} username The username
   * @param {string} password The password
   * @returns {Promise<Object>} The response data with the access token
   */
  async signin(username, password) {
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/signin`, {
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
      
      return data;
    } catch (error) {
      console.error('Signin error:', error);
      throw error;
    }
  },

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signout() {
    try {
      await this.clearToken();
    } catch (error) {
      console.error('Signout error:', error);
      throw error;
    }
  },

  /**
   * Check if the user is authenticated
   * @returns {Promise<boolean>} True if authenticated, false otherwise
   */
  async isAuthenticated() {
    try {
      const token = await this.getToken();
      
      if (!token) {
        return false;
      }
      
      // Verify the token by making a request to a protected endpoint
      // We could also decode the JWT and check if it's expired, but
      // this approach verifies with the server
      const verified = await this.verifyToken(token);
      return verified;
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  },

  /**
   * Verify if a token is valid
   * @param {string} token The JWT token to verify
   * @returns {Promise<boolean>} True if valid, false otherwise
   */
  async verifyToken(token) {
    try {
      const response = await fetch(`${this.API_BASE_URL}/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      return response.ok;
    } catch (error) {
      console.error('Token verification error:', error);
      return false;
    }
  },

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
  },

  /**
   * Save an authentication token
   * @param {string} token The token to save
   * @returns {Promise<void>}
   */
  async saveToken(token) {
    return new Promise((resolve) => {
      browserAPI.storage.local.set({ 'authToken': token }, () => {
        resolve();
      });
    });
  },

  /**
   * Clear the authentication token
   * @returns {Promise<void>}
   */
  async clearToken() {
    return new Promise((resolve) => {
      browserAPI.storage.local.remove(['authToken'], () => {
        resolve();
      });
    });
  },

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
      
      const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to get user data');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get user data error:', error);
      return null;
    }
  }
};

// Export for ES modules
export default AuthService;
