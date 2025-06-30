// Argus - Payment Cancel JavaScript

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// DOM elements
const loadingEl = document.getElementById('loading');
const tryAgainBtn = document.getElementById('try-again-btn');
const continueFreeBtn = document.getElementById('continue-free-btn');
const closeBtn = document.getElementById('close-tab');

// Initialize the payment cancel page
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Set up event listeners
    setupEventListeners();
    
    // Log cancellation for analytics via background script
    await logPaymentCancellationViaBackground();
    
  } catch (error) {
    console.error('Payment cancel page initialization error:', error);
  }
});

// Log payment cancellation via background script
async function logPaymentCancellationViaBackground() {
  try {
    // Send message to background script to log cancellation
    browserAPI.runtime.sendMessage({
      action: 'logPaymentCancellation',
      data: {
        timestamp: new Date().toISOString(),
        reason: 'user_cancelled'
      }
    }, (response) => {
      if (response && response.success) {
        console.log('Cancellation logged successfully');
      } else {
        console.log('Could not log cancellation:', response ? response.error : 'Unknown error');
      }
    });
  } catch (error) {
    // Non-critical error, don't show to user
    console.log('Could not log cancellation:', error);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Try payment again button
  tryAgainBtn.addEventListener('click', async () => {
    showLoading();
    
    try {
      // Send message to background to initiate payment flow
      browserAPI.runtime.sendMessage({
        action: 'initiatePayment'
      }, (response) => {
        if (response && response.success) {
          // Payment flow initiated, close this tab
          setTimeout(() => {
            window.close();
          }, 500);
        } else {
          hideLoading();
          console.error('Failed to initiate payment flow');
        }
      });
      
    } catch (error) {
      hideLoading();
      console.error('Error initiating payment retry:', error);
    }
  });
  
  // Continue with free version button
  continueFreeBtn.addEventListener('click', () => {
    // Ensure user remains in free mode
    browserAPI.storage.local.set({
      freeMode: true,
      userType: 'free'
    }, () => {
      // Open extension popup
      browserAPI.runtime.sendMessage({
        action: 'openExtensionPopup'
      });
      
      // Close current tab after a short delay
      setTimeout(() => {
        window.close();
      }, 500);
    });
  });
  
  // Close tab button
  closeBtn.addEventListener('click', () => {
    window.close();
  });
}

// Show loading state
function showLoading() {
  loadingEl.style.display = 'block';
  tryAgainBtn.disabled = true;
  continueFreeBtn.disabled = true;
  closeBtn.disabled = true;
}

// Hide loading state
function hideLoading() {
  loadingEl.style.display = 'none';
  tryAgainBtn.disabled = false;
  continueFreeBtn.disabled = false;
  closeBtn.disabled = false;
}