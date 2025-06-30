// Argus - Payment Success JavaScript

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// DOM elements
const loadingEl = document.getElementById('loading');
const continueBtn = document.getElementById('continue-btn');
const closeBtn = document.getElementById('close-tab');

// Initialize the payment success page
document.addEventListener('DOMContentLoaded', async () => {
  // Show loading state
  showLoading();
  
  try {
    // Get session_id from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (!sessionId) {
      throw new Error('No session ID found in URL');
    }
    
    // Verify payment via background script
    await verifyPaymentViaBackground(sessionId);
    
    // Hide loading and show success content
    hideLoading();
    
    // Set up event listeners
    setupEventListeners();
    
  } catch (error) {
    console.error('Payment verification failed:', error);
    handlePaymentError(error.message);
  }
});

// Verify payment via background script
async function verifyPaymentViaBackground(sessionId) {
  return new Promise((resolve, reject) => {
    // Send message to background script to verify payment
    browserAPI.runtime.sendMessage({
      action: 'verifyPayment',
      sessionId: sessionId
    }, (response) => {
      if (browserAPI.runtime.lastError) {
        reject(new Error(browserAPI.runtime.lastError.message));
        return;
      }
      
      if (response && response.success) {
        console.log('Payment verification successful:', response.data);
        resolve(response.data);
      } else {
        reject(new Error(response ? response.error : 'Payment verification failed'));
      }
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Continue to Argus button
  continueBtn.addEventListener('click', () => {
    // Open extension popup
    browserAPI.runtime.sendMessage({
      action: 'openExtensionPopup'
    });
    
    // Close current tab after a short delay
    setTimeout(() => {
      window.close();
    }, 500);
  });
  
  // Close tab button
  closeBtn.addEventListener('click', () => {
    window.close();
  });
}

// Show loading state
function showLoading() {
  loadingEl.style.display = 'block';
  continueBtn.style.display = 'none';
  closeBtn.style.display = 'none';
}

// Hide loading state
function hideLoading() {
  loadingEl.style.display = 'none';
  continueBtn.style.display = 'inline-block';
  closeBtn.style.display = 'inline-block';
}

// Handle payment verification errors
function handlePaymentError(errorMessage) {
  hideLoading();
  
  // Update page content to show error
  const successCard = document.querySelector('.success-card');
  successCard.innerHTML = `
    <img src="icons/icon128.png" alt="Argus Logo" class="logo">
    
    <div class="error-icon">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#e74c3c"/>
        <path d="M15 9l-6 6M9 9l6 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    
    <h1 style="color: #e74c3c;">Payment Verification Failed</h1>
    
    <div class="error-info" style="background-color: #fdeaea; border-left: 3px solid #e74c3c; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: left;">
      <p><strong>Error:</strong> ${errorMessage}</p>
      <p>If you completed the payment successfully, please try refreshing this page or contact support.</p>
    </div>
    
    <div class="actions">
      <button onclick="window.location.reload()" class="continue-btn">Retry Verification</button>
      <button onclick="window.close()" class="close-btn">Close Tab</button>
    </div>
  `;
}