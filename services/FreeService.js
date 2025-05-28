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
   * @returns {Promise<boolean>} True if in free mode, false if authenticated
   */
  async isFreeMode() {
    const storage = await browserAPI.storage.local.get('freeMode');
    return storage.freeMode === true;
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
  }
};

// Export for ES modules
export default FreeService; 