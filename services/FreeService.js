/**
 * FreeService
 * Handles free mode functionality and ad display for the Argus extension.
 */

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

/**
 * FreeService class for handling free mode and ad management
 */
const FreeService = {
  /**
   * Check if the user is in free mode
   * @returns {Promise<boolean>} True if in free mode, false if premium
   */
  async isFreeMode() {
    try {
      const storage = await browserAPI.storage.local.get(['freeMode', 'authToken', 'userInfo']);
      
      // If not authenticated, definitely free mode
      if (!storage.authToken || storage.authToken === true || storage.authToken === false) {
        return true;
      }
      
      // If explicitly set to free mode and no user info, stay in free mode
      if (storage.freeMode === true && !storage.userInfo) {
        return true;
      }
      
      // Check user info for premium status
      if (storage.userInfo) {
        const userInfo = storage.userInfo;
        
        // Check if user has premium type
        if (userInfo.type === 'premium') {
          // Also check subscription status if available
          if (userInfo.subscriptionStatus && 
              ['active'].includes(userInfo.subscriptionStatus)) {
            return false; // User is premium
          } else if (userInfo.subscriptionStatus && 
                     ['inactive', 'cancelled', 'past_due'].includes(userInfo.subscriptionStatus)) {
            return true; // Subscription expired/cancelled
          } else if (!userInfo.subscriptionStatus) {
            // No subscription status but marked as premium - assume premium
            return false;
          }
        }
        
        // If user type is FREE or not set, they're in free mode
        if (userInfo.type === 'free' || !userInfo.type) {
          return true;
        }
      }
      
      // If authenticated but no user info cached, check with API
      if (storage.authToken && !storage.userInfo) {
        console.log('FreeService: No cached user info, checking subscription status with API...');
        try {
          const subscriptionData = await this.checkSubscriptionStatus(storage.authToken);
          
          // Update storage with fetched subscription data
          if (subscriptionData && subscriptionData.userType) {
            // Preserve any existing userInfo fields while updating subscription data
            const existingUserInfo = storage.userInfo || {};
            const updatedUserInfo = {
              ...existingUserInfo,
              type: subscriptionData.userType,
              subscriptionStatus: subscriptionData.subscriptionStatus
            };
            
            console.log('FreeService: Updating user info with subscription data:', {
              userType: subscriptionData.userType,
              subscriptionStatus: subscriptionData.subscriptionStatus,
              isFree: subscriptionData.userType !== 'premium'
            });
            
            await browserAPI.storage.local.set({ 
              userInfo: updatedUserInfo,
              freeMode: subscriptionData.userType !== 'premium'
            });
            
            return subscriptionData.userType !== 'premium';
          }
        } catch (error) {
          console.error('FreeService: Failed to check subscription status, preserving authentication state:', error);
          // For authenticated users with valid token, default to free but preserve auth state
          // Don't clear userInfo or authToken as this preserves authentication
          return true;
        }
      }
      
      // Default to free mode if we can't determine status
      return true;
    } catch (error) {
      console.error('Error checking free mode status:', error);
      return true; // Default to free mode on error
    }
  },

  /**
   * Check subscription status with API
   * @param {string} authToken - Authentication token
   * @returns {Promise<Object>} Subscription data with userType and subscriptionStatus
   */
  async checkSubscriptionStatus(authToken) {
    try {
      const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_BASE_URL}/payments/subscription-status`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          userType: data.userType || 'free',
          subscriptionStatus: data.subscriptionStatus || null,
          ...data
        };
      } else {
        console.warn('FreeService: Failed to check subscription status:', response.status);
        // For authenticated users, throw error instead of defaulting to free
        throw new Error(`API request failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      // Re-throw error so calling code can handle appropriately
      throw error;
    }
  },

  /**
   * Enable free mode
   * @returns {Promise<void>}
   */
  async enableFreeMode() {
    await browserAPI.storage.local.set({ 
      freeMode: true,
      freeActionCount: 0,
      lastAdTime: Date.now()
    });
  },

  /**
   * Disable free mode (when user authenticates)
   * @returns {Promise<void>}
   */
  async disableFreeMode() {
    await browserAPI.storage.local.set({ freeMode: false });
  },

  /**
   * Track a key action that might trigger an ad in free mode
   * @returns {Promise<boolean>} True if an ad should be displayed
   */
  async trackKeyAction() {
    if (!(await this.isFreeMode())) {
      return false;
    }

    const storage = await browserAPI.storage.local.get(['freeActionCount', 'lastAdTime']);
    const actionCount = storage.freeActionCount || 0;
    const lastAdTime = storage.lastAdTime || 0;
    const currentTime = Date.now();
    
    // Show ad after every 5 actions or if 24 hours have passed since last ad
    const shouldShowAd = actionCount >= 5 || (currentTime - lastAdTime) > 24 * 60 * 60 * 1000;
    
    if (shouldShowAd) {
      // Reset counter and update last ad time
      await browserAPI.storage.local.set({ 
        freeActionCount: 0,
        lastAdTime: currentTime 
      });
      return true;
    } else {
      // Increment action counter
      await browserAPI.storage.local.set({ 
        freeActionCount: actionCount + 1 
      });
      return false;
    }
  },

  /**
   * Display an ad for free mode users
   * @returns {Promise<void>}
   */
  async displayAd() {
    // Create popup with ad content
    const adPopup = document.createElement('div');
    adPopup.className = 'ad-overlay';
    adPopup.innerHTML = `
      <div class="ad-container">
        <div class="ad-header">
          <h3>Support Argus</h3>
          <button class="ad-close">&times;</button>
        </div>
        <div class="ad-content">
          <p>You're using Argus in free mode. Upgrade to Premium for:</p>
          <ul>
            <li>No advertisements</li>
            <li>Cloud sync across devices</li>
            <li>Advanced insights and analytics</li>
            <li>Unlimited website blocking</li>
          </ul>
          <div class="ad-cta">
            <button class="ad-upgrade-btn">Upgrade to Premium</button>
            <button class="ad-continue-btn">Continue with Free</button>
          </div>
        </div>
      </div>
    `;

    // Add to body when available
    if (document.body) {
      document.body.appendChild(adPopup);
      this._setupAdEventListeners(adPopup);
    } else {
      // If document body isn't ready yet, wait for it
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(adPopup);
        this._setupAdEventListeners(adPopup);
      });
    }
  },

  /**
   * Setup event listeners for ad interactions
   * @param {HTMLElement} adPopup The ad popup element
   * @private
   */
  _setupAdEventListeners(adPopup) {
    // Close button
    const closeBtn = adPopup.querySelector('.ad-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(adPopup);
    });

    // Upgrade button
    const upgradeBtn = adPopup.querySelector('.ad-upgrade-btn');
    upgradeBtn.addEventListener('click', () => {
      // Show auth overlay with signup tab active
      const authOverlay = document.getElementById('auth-overlay');
      const signupTab = document.getElementById('signup-tab');
      
      if (authOverlay && signupTab) {
        authOverlay.style.display = 'flex';
        signupTab.click();
      }
      
      document.body.removeChild(adPopup);
    });

    // Continue button
    const continueBtn = adPopup.querySelector('.ad-continue-btn');
    continueBtn.addEventListener('click', () => {
      document.body.removeChild(adPopup);
    });
  },

  /**
   * Get the free mode limitations information
   * @returns {Object} Free mode limitations
   */
  getFreeModeInfo() {
    return {
      maxBlockedSites: 3,  // Maximum number of sites that can be blocked in free mode
      maxHistoryDays: 7,   // Maximum days of history stored in free mode
      featureRestrictions: [
        'Cloud sync unavailable',
        'Limited to 3 blocked sites',
        'Limited to 7 days of history',
        'Basic statistics only'
      ]
    };
  },

  /**
   * Check if a feature is available based on user subscription
   * @param {string} feature - Feature name to check
   * @returns {Promise<boolean>} True if feature is available
   */
  async isFeatureAvailable(feature) {
    const isFree = await this.isFreeMode();
    
    if (!isFree) {
      return true; // Premium users have access to all features
    }
    
    // Define free mode feature restrictions
    const freeFeatures = [
      'basic_tracking',
      'basic_stats',
      'limited_blocking',
      'limited_history'
    ];
    
    const premiumFeatures = [
      'cloud_sync',
      'unlimited_blocking',
      'full_history',
      'advanced_analytics',
      'data_export',
      'premium_support',
      'zen_mode',
      'top_sites'
    ];
    
    return freeFeatures.includes(feature);
  },

  /**
   * Enforce blocking limits for free users
   * @param {Array} currentBlockedSites - Current blocked sites
   * @returns {Promise<boolean>} True if user can add more blocked sites
   */
  async canAddBlockedSite(currentBlockedSites = []) {
    const isFree = await this.isFreeMode();
    
    if (!isFree) {
      return true; // Premium users have unlimited blocking
    }
    
    const info = this.getFreeModeInfo();
    return currentBlockedSites.length < info.maxBlockedSites;
  },

  /**
   * Check if a specific tab is restricted for free users
   * @param {string} tabId - Tab identifier ('focus' for zen mode, 'sites' for top sites)
   * @returns {Promise<boolean>} True if tab is restricted
   */
  async isTabRestricted(tabId) {
    const isFree = await this.isFreeMode();
    
    if (!isFree) {
      return false; // Premium users have access to all tabs
    }
    
    const restrictedTabs = ['focus', 'sites', 'history'];
    return restrictedTabs.includes(tabId);
  },

  /**
   * Get upgrade URL for restricted features
   * @returns {string} URL to upgrade page
   */
  getUpgradeUrl() {
    // In a real implementation, this would be your upgrade/pricing page
    return 'https://your-domain.com/upgrade';
  },

  /**
   * Refresh user's subscription status from API and update storage
   * @returns {Promise<boolean>} True if user is premium after refresh
   */
  async refreshSubscriptionStatus() {
    try {
      const storage = await browserAPI.storage.local.get(['authToken', 'userInfo']);
      
      if (!storage.authToken) {
        console.log('FreeService: No auth token, cannot refresh subscription status');
        return false;
      }
      
      console.log('FreeService: Refreshing subscription status...');
      const subscriptionData = await this.checkSubscriptionStatus(storage.authToken);
      
      if (subscriptionData) {
        const updatedUserInfo = {
          ...storage.userInfo,
          type: subscriptionData.userType,
          subscriptionStatus: subscriptionData.subscriptionStatus
        };
        
        const isPremium = subscriptionData.userType === 'premium';
        
        // Update storage with fresh subscription data
        await browserAPI.storage.local.set({
          userInfo: updatedUserInfo,
          freeMode: !isPremium
        });
        
        console.log('FreeService: Subscription status refreshed:', {
          userType: subscriptionData.userType,
          subscriptionStatus: subscriptionData.subscriptionStatus,
          isPremium
        });
        
        return isPremium;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing subscription status:', error);
      return false;
    }
  }
};

// Export for ES modules
export default FreeService; 