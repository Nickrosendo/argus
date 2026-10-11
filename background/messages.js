// Messages from the popup, blocked page and content scripts
import browserApiService from "../services/BrowserApiService";
import authService from "../services/AuthService";
import freeService from "../services/FreeService";
import { SocialAuthService } from '../services/SocialAuthService.js';
import { endFocusSession, startFocusSession } from './focus.js';
import { state } from './state.js';
import {
  updateBlockedSites,
  handleTemporaryUnblock,
  isUrlBlocked,
} from './blocking.js';
import { syncDataWithApi } from './sync.js';

// Handle messages from the popup, blocked page and content scripts
export function handleCoreMessage(message, sender, sendResponse) {
  if (message.action === "updateBlockedSites") {
    updateBlockedSites()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error updating blocked sites:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "updateTemporaryUnblocks") {
    handleTemporaryUnblock(message.domain, message.expirationTime)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error updating temporary unblocks:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "startFocusSession") {
    startFocusSession(message.minutes)
      .then((result) => {
        sendResponse(
          result.ok
            ? { success: true, session: result.session }
            : { success: false, error: result.reason }
        );
      })
      .catch((error) => {
        console.error("Error starting focus session:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "stopFocusSession") {
    endFocusSession(false)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error stopping focus session:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "openBlocklistSettings") {
    browserApiService
      .createTab(browserApiService.getExtensionUrl("popup.html"))
      .then((popup) => {
        // Add a small delay to make sure the popup is loaded
        setTimeout(() => {
          browserApiService.runtime.sendMessage({
            action: "openSettingsTab",
          });
        }, 500);
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Error opening blocklist settings:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "syncWithApi") {
    // Check if this is a manual sync request (user-initiated)
    const isManualSync = message.manual === true;
    
    syncDataWithApi(isManualSync)
      .then((result) => {
        sendResponse(
          result.ok
            ? { success: true }
            : { success: false, error: result.reason }
        );
      })
      .catch((error) => {
        console.error("Error syncing with api:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "checkAuthentication") {
    authService
      .isAuthenticated()
      .then((isAuthenticated) => {
        sendResponse({ success: true, isAuthenticated });
      })
      .catch((error) => {
        console.error("Error checking authentication:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "checkFreeMode") {
    freeService
      .isFreeMode()
      .then((isFreeMode) => {
        sendResponse({ success: true, isFreeMode });
      })
      .catch((error) => {
        console.error("Error checking free mode:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "trackKeyAction") {
    freeService
      .trackKeyAction()
      .then((shouldShowAd) => {
        sendResponse({ success: true, shouldShowAd });
      })
      .catch((error) => {
        console.error("Error tracking key action:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "getTrackingStatus") {
    // Return current tracking status for debugging
    const status = {
      isTracking: state.isTracking,
      hasCurrentTab: !!state.currentTab,
      currentDomain: state.currentTab?.domain || null,
      hasRealTimeTimer: !!state.realTimeUpdateTimer,
      isAuthenticated: state.isAuthenticated,
      isFreeMode: state.isFreeMode
    };
    sendResponse({ success: true, status });
  } else if (message.action === "checkUrlBlocked") {
    // Check if a specific URL is blocked
    isUrlBlocked(message.url)
      .then((isBlocked) => {
        sendResponse({ success: true, isBlocked });
      })
      .catch((error) => {
        console.error("Error checking URL blocked status:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "getBlockedAttempts") {
    // Get blocked attempts for analytics
    browserApiService.getStorage(['blockedAttempts'])
      .then((result) => {
        sendResponse({ success: true, blockedAttempts: result.blockedAttempts || {} });
      })
      .catch((error) => {
        console.error("Error getting blocked attempts:", error);
        sendResponse({ success: false, error: error.message });
      });
  } else if (message.action === "signin") {
    try {
      const { username, password } = message;
      authService
        .signin(username, password)
        .then(async (response) => {
          // Update authentication state
          state.isAuthenticated = true;
          state.isFreeMode = response.type === "free";

          // Store user info in browser storage
          await browserApiService.setStorage({
            authToken: response.accessToken,
            userInfo: {
              id: response.user.id,
              email: response.user.email,
              name: response.user.name || response.user.username,
              username: response.user.username,
            },
            freeMode: false,
          });

          // Start API sync
          await syncDataWithApi();

          sendResponse({
            success: true,
            data: {
              token: response.accessToken,
              user: {
                id: response.user.id,
                email: response.user.email,
                name: response.user.name || response.user.username,
              },
            },
          });
        })
        .catch((error) => {
          console.error("Error on signin:", error);
          sendResponse({ success: false, error: error.message });
        });
    } catch (error) {
      console.error("Signin error:", error);
      sendResponse({
        success: false,
        error: error.message || "Failed to sign in",
      });
    }
  } else if (message.action === "signup") {
    try {
      const { username, password, email } = message;
      authService
        .signup(username, password, email)
        .then(async (response) => {
          // Update authentication state
          state.isAuthenticated = true;
          state.isFreeMode = response.type === "free";

          // Store user info in browser storage
          await browserApiService.setStorage({
            authToken: response.accessToken,
            userInfo: {
              id: response.user.id,
              email: response.user.email,
              name: response.user.name || response.user.username,
              username: response.user.username,
            },
            freeMode: state.isFreeMode,
          });

          // Start API sync
          await syncDataWithApi();

          return sendResponse({
            success: true,
            data: {
              token: response.accessToken,
              user: {
                id: response.user.id,
                email: response.user.email,
                name: response.user.name || response.user.username,
              },
            },
          });
        })
        .catch((error) => {
          console.error("Error on signup:", error);
          sendResponse({ success: false, error: error.message });
        });
    } catch (error) {
      console.error("Signup error:", error);
      sendResponse({
        success: false,
        error: error.message || "Failed to sign up",
      });
    }
  } else if (message.action === "signout") {
    try {
      authService
        .signout()
        .then(async () => {
          // Update authentication state
          state.isAuthenticated = false;
          state.isFreeMode = true;

          // Clear user info from browser storage
          await browserApiService.setStorage({
            authToken: null,
            userInfo: null,
            freeMode: true,
            // Usage fetched from the account's other devices, and the record
            // of what was uploaded to that account
            remoteDays: {},
            syncedDays: [],
          });

          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("Error on signout:", error);
          sendResponse({ success: false, error: error.message });
        });
    } catch (error) {
      console.error("Signout error:", error);
      sendResponse({
        success: false,
        error: error.message || "Failed to sign out",
      });
    }
  } else if (message.action === "socialAuth") {
    try {
      const { provider } = message;
      console.log(`Starting ${provider} social authentication...`);
      
      SocialAuthService.loginWithProvider(provider)
        .then(async (socialResponse) => {
          console.log(`${provider} auth successful`);
          
          // Call our API with the social auth data
          const response = await fetch(`${authService.API_BASE_URL}/auth/social`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              provider: socialResponse.provider,
              providerId: socialResponse.user.id,
              accessToken: socialResponse.authToken,
              email: socialResponse.user.email,
              name: socialResponse.user.name,
              picture: socialResponse.user.picture
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `${provider} authentication failed`);
          }

          const backendResponse = await response.json();
          
          // Update authentication state
          state.isAuthenticated = true;
          
          // Check subscription status to determine if user is premium
          let isPremium = false;
          let updatedUserInfo = {
            id: backendResponse.user.id,
            email: backendResponse.user.email,
            name: backendResponse.user.name,
            picture: backendResponse.user.picture,
            username: backendResponse.user.username,
          };
          
          try {
            const subscriptionData = await freeService.checkSubscriptionStatus(backendResponse.accessToken);
            isPremium = subscriptionData.userType === 'premium';
            
            // Update user info with subscription data
            updatedUserInfo = {
              ...updatedUserInfo,
              type: subscriptionData.userType,
              subscriptionStatus: subscriptionData.subscriptionStatus
            };
            
            console.log("Social auth subscription check result:", subscriptionData);
          } catch (error) {
            console.error("Failed to check subscription status during social auth:", error);
            // Default to free mode if subscription check fails
            updatedUserInfo = {
              ...updatedUserInfo,
              type: 'free'
            };
          }
          
          state.isFreeMode = !isPremium;

          // Store user info in browser storage
          await browserApiService.setStorage({
            authToken: backendResponse.accessToken,
            userInfo: updatedUserInfo,
            freeMode: !isPremium,
          });

          // Start API sync
          await syncDataWithApi();

          sendResponse({
            success: true,
            data: {
              token: backendResponse.accessToken,
              user: updatedUserInfo,
            },
          });
        })
        .catch((error) => {
          console.error(`${provider} authentication error:`, error);
          sendResponse({ 
            success: false, 
            error: error.message || `${provider} authentication failed` 
          });
        });
    } catch (error) {
      console.error("Social auth error:", error);
      sendResponse({
        success: false,
        error: error.message || "Social authentication failed",
      });
    }
  }
}

// Actions handled by handleCoreMessage
export const CORE_ACTIONS = new Set([
  'updateBlockedSites',
  'updateTemporaryUnblocks',
  'startFocusSession',
  'stopFocusSession',
  'openBlocklistSettings',
  'syncWithApi',
  'checkAuthentication',
  'checkFreeMode',
  'trackKeyAction',
  'getTrackingStatus',
  'checkUrlBlocked',
  'getBlockedAttempts',
  'signin',
  'signup',
  'signout',
  'socialAuth',
]);
