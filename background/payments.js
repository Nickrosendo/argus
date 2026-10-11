// Checkout and subscription state messages
import {
  API_BASE_URL,
} from './constants.js';
import { state, browserAPI } from './state.js';

// Handle checkout session creation
export async function handleCreateCheckoutSession(request, sendResponse) {
  try {
    const { priceId, authToken } = request;
    
    if (!authToken) {
      sendResponse({ success: false, error: 'Authentication required' });
      return;
    }

    // Call API to create Stripe checkout session
    const response = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ priceId }),
    });

    const result = await response.json();

    if (response.ok) {
      sendResponse({ 
        success: true, 
        checkoutUrl: result.url
      });
    } else {
      sendResponse({ success: false, error: result.message || 'Failed to create checkout session' });
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    sendResponse({ success: false, error: 'Failed to create checkout session' });
  }
}

export async function handleVerifyPayment(request, sendResponse) {
  console.log('🔍 Starting payment verification process...');
  console.log('Verification request:', request);
  
  try {
    const { sessionId } = request;
    
    if (!sessionId) {
      console.error('❌ No session ID provided');
      sendResponse({ success: false, error: 'Session ID required' });
      return;
    }

    console.log('📋 Session ID to verify:', sessionId);
    console.log('🔑 Retrieving stored auth token...');

    // Get auth token
    const authToken = await getStoredAuthToken();
    if (!authToken) {
      console.error('❌ No authentication token found');
      sendResponse({ success: false, error: 'Authentication token not found' });
      return;
    }

    console.log('✅ Auth token retrieved successfully');
    console.log('🌐 Making API request to verify subscription status...');

    // Check subscription status from backend
    const apiUrl = `${API_BASE_URL}/payments/subscription-status`;
    console.log('API URL:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });

    console.log('📨 API Response status:', response.status);
    console.log('📨 API Response OK:', response.ok);

    const subscriptionData = await response.json();
    console.log('📊 Subscription data received:', subscriptionData);

    if (!response.ok) {
      console.error('❌ API request failed:', subscriptionData.message);
      sendResponse({ success: false, error: subscriptionData.message || 'Payment verification failed' });
      return;
    }

    if (!subscriptionData.hasSubscription) {
      console.error('❌ No subscription found for user');
      sendResponse({ success: false, error: 'Subscription not found. Payment may still be processing.' });
      return;
    }

    console.log('✅ Subscription verified, updating local user state...');
    
    // Update local user state to reflect premium status
    await updateLocalUserState(subscriptionData);

    console.log('✅ Payment verification completed successfully');
    
    sendResponse({ 
      success: true, 
      data: subscriptionData 
    });

  } catch (error) {
    console.error('💥 Error verifying payment:', error);
    console.error('Error stack:', error.stack);
    sendResponse({ success: false, error: 'Payment verification failed' });
  }
}

export async function handleLogPaymentCancellation(request, sendResponse) {
  try {
    const { data } = request;
    
    // Get auth token
    const authToken = await getStoredAuthToken();
    
    if (authToken) {
      // Make optional API call to log cancellation
      try {
        await fetch(`${API_BASE_URL}/payments/log-cancellation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify(data),
        });
      } catch (error) {
        console.log('Could not log cancellation to API:', error);
      }
    }
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error logging payment cancellation:', error);
    sendResponse({ success: false, error: 'Failed to log cancellation' });
  }
}

export async function handleInitiatePayment(sendResponse) {
  try {
    // Get auth token
    const authToken = await getStoredAuthToken();
    if (!authToken) {
      sendResponse({ success: false, error: 'Authentication required' });
      return;
    }

    // Create new checkout session (reuse existing logic)
    const response = await fetch(`${API_BASE_URL}/payments/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ priceId: 'price_default' }), // Use default price
    });

    const result = await response.json();

    if (response.ok) {
      // Open checkout URL in new tab
      browserAPI.tabs.create({ url: result.url });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: result.message || 'Failed to initiate payment' });
    }
  } catch (error) {
    console.error('Error initiating payment:', error);
    sendResponse({ success: false, error: 'Failed to initiate payment' });
  }
}

export async function handleSetFreeMode(request, sendResponse) {
  try {
    const { data } = request;
    const { freeMode } = data;

    // Update local storage
    browserAPI.storage.local.set({
      freeMode: freeMode,
      userType: freeMode ? 'free' : 'premium'
    }, () => {
      state.isFreeMode = freeMode;
      sendResponse({ success: true });
    });
  } catch (error) {
    console.error('Error setting free mode:', error);
    sendResponse({ success: false, error: 'Failed to set free mode' });
  }
}

// Helper function to get stored auth token
export async function getStoredAuthToken() {
  console.log('🔑 Retrieving auth token from local storage...');
  
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['authToken'], (result) => {
      const token = result.authToken || null;
      console.log('Auth token found:', !!token);
      resolve(token);
    });
  });
}

// Helper function to update local user state
export async function updateLocalUserState(subscriptionData) {
  console.log('💾 Updating local user state with subscription data...');
  console.log('Subscription data to save:', subscriptionData);
  
  return new Promise((resolve) => {
    browserAPI.storage.local.get(['userInfo'], (result) => {
      console.log('Current userInfo:', result.userInfo);
      
      const updatedUserInfo = {
        ...result.userInfo,
        userType: 'premium',
        hasSubscription: true,
        subscriptionStatus: subscriptionData.status,
        subscriptionId: subscriptionData.subscriptionId,
        currentPeriodEnd: subscriptionData.currentPeriodEnd
      };
      
      console.log('Updated userInfo to save:', updatedUserInfo);
      
      browserAPI.storage.local.set({
        userInfo: updatedUserInfo,
        freeMode: false
      }, () => {
        state.isFreeMode = false;
        console.log('✅ Local user state updated to premium successfully');
        console.log('isFreeMode set to:', state.isFreeMode);
        resolve();
      });
    });
  });
}
