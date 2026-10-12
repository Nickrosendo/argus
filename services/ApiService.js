/**
 * ApiService
 * Handles communication with the Argus API, including sending authenticated requests
 */

// Import the auth service
import authService from './AuthService.js';

/**
 * ApiService class for handling API communication
 */
class ApiService {
  constructor() {
    this.config = {
      // API_BASE_URL: 'https://argus-api-z73bt.kinsta.app',
      API_BASE_URL: process.env.API_URL,
      endpoints: {
        users: '/users',
        browserUsageSync: '/browser-usage/sync',
        browserUsage: '/browser-usage',
        screenTime: '/screen-time',
        productivity: '/productivity'
      }
    };
  }

  /**
   * Make an authenticated request to the API
   * @param {string} endpoint The API endpoint to request
   * @param {Object} options Request options (method, body, etc.)
   * @returns {Promise<Object>} The response data
   */
  async request(endpoint, options = {}) {
    try {
      // Get the authentication token
      const token = await authService.getToken();
      
      // Create headers with authentication
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
      };
      
      // Make the request
      const response = await fetch(`${this.config.API_BASE_URL}${endpoint}`, {
        ...options,
        headers
      });
      
      // Handle token expiration
      if (response.status === 401) {
        // Token might be expired, clear it
        await authService.clearToken();
        throw new Error('Authentication expired. Please sign in again.');
      }
      
      // Check if the request was successful
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }
      
      // Return the response data
      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  /**
   * Upload this device's usage. The API takes the user from the token.
   * @param {string} deviceId Device identifier
   * @param {Object} data Browser usage data to sync, as { days: { 'YYYY-MM-DD': { sites, totalTime } } }
   * @returns {Promise<Object>} The synced data
   */
  async syncBrowserUsage(deviceId, data) {
    return this.request(this.config.endpoints.browserUsageSync, {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        data
      })
    });
  }

  /**
   * Delete everything this account has synced, from every device
   * @returns {Promise<{deleted: number}>}
   */
  async deleteUsageData() {
    return this.request(this.config.endpoints.browserUsage, { method: 'DELETE' });
  }

  /**
   * Get the user's usage per day, added up across devices
   * @param {Object} options
   * @param {string} [options.since] Earliest date to return, as YYYY-MM-DD
   * @param {string} [options.excludeDeviceId] Leave out this device's own data
   * @returns {Promise<{days: Object}>} Days keyed by YYYY-MM-DD
   */
  async getUsageDays({ since, excludeDeviceId } = {}) {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (excludeDeviceId) params.set('excludeDeviceId', excludeDeviceId);

    const query = params.toString();
    return this.request(`${this.config.endpoints.browserUsage}/days${query ? `?${query}` : ''}`);
  }

  /**
   * Get the current user data
   * @returns {Promise<Object|null>} User data or null if not authenticated
   */
  async getUser() {
    // Check if user is authenticated first
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      return null;
    }
    
    // Get user data using AuthService which properly calls /auth/me
    return await authService.getUserData();
  }

  /**
   * Update user preferences
   * @param {number} userId User ID
   * @param {Object} preferences Preferences to update
   * @returns {Promise<Object>} Updated user data
   */
  async updatePreferences(userId, preferences) {
    return this.request(this.config.endpoints.users + `/${userId}/preferences`, {
      method: 'PATCH',
      body: JSON.stringify(preferences)
    });
  }
}

// Export a singleton instance
const apiService = new ApiService();
export default apiService;
