// Argus Extension - Website Communication Content Script
// This script runs on the Argus website to handle payment page communication

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Configuration
const WEBSITE_ORIGIN = 'https://argusextension.com';
const DETECTION_TIMEOUT = 2000;
const COMMUNICATION_TIMEOUT = 5000;

// Initialize communication when script loads
initializeWebsiteCommunication();

function initializeWebsiteCommunication() {
  console.log('=== Argus Extension Communication Initializing ===');
  console.log('Current URL:', window.location.href);
  console.log('Document ready state:', document.readyState);
  
  // Mark extension as present for detection
  markExtensionPresent();
  
  // Listen for messages from website
  window.addEventListener('message', handleWebsiteMessage);
  
  console.log('Argus extension communication initialized successfully');
  console.log('Message listener added for website communication');
}

function markExtensionPresent() {
  console.log('Marking extension as present for detection...');
  
  // Method 1: Add detection element
  const detectionElement = document.createElement('div');
  detectionElement.setAttribute('data-argus-extension', 'true');
  detectionElement.style.display = 'none';
  document.documentElement.appendChild(detectionElement);
  console.log('Added data-argus-extension detection element to DOM');
  
  // Method 2: Add global property
  window.argusExtension = {
    version: '1.0.0',
    present: true
  };
  console.log('Added window.argusExtension property:', window.argusExtension);
}

async function handleWebsiteMessage(event) {
  console.log('=== Extension Received Message from Website ===');
  console.log('Event origin:', event.origin);
  console.log('Event data:', event.data);
  console.log('Expected website origin:', WEBSITE_ORIGIN);
  
  // Verify origin for security
  const isValidOrigin = event.origin === WEBSITE_ORIGIN || 
                       event.origin.includes('localhost') || 
                       event.origin.includes('127.0.0.1');
  
  if (!isValidOrigin) {
    console.log('❌ Message rejected - invalid origin:', event.origin);
    return;
  }
  
  console.log('✅ Origin validation passed');
  
  const { type, action, data, source, timestamp } = event.data;
  
  console.log('Message details:');
  console.log('  Type:', type);
  console.log('  Action:', action);
  console.log('  Data:', data);
  console.log('  Source:', source);
  console.log('  Timestamp:', timestamp);
  
  if (source !== 'argus-website') {
    console.log('❌ Message rejected - invalid source:', source);
    return;
  }
  
  console.log('✅ Source validation passed');
  
  try {
    switch (type) {
      case 'ARGUS_EXTENSION_DETECTION':
        console.log('📡 Handling detection request...');
        handleDetectionRequest();
        break;
        
      case 'ARGUS_EXTENSION_MESSAGE':
        console.log('💬 Handling action message:', action);
        await handleActionMessage(action, data);
        break;
        
      default:
        console.log('❓ Unknown message type:', type);
    }
  } catch (error) {
    console.error('💥 Error handling website message:', error);
    console.error('Error stack:', error.stack);
    sendResponse(action, false, error.message);
  }
}

function handleDetectionRequest() {
  console.log('🔍 Handling detection request from website');
  
  const responseMessage = {
    type: 'ARGUS_EXTENSION_DETECTED',
    source: 'argus-extension',
    timestamp: Date.now()
  };
  
  console.log('📤 Sending detection response:', responseMessage);
  
  // Respond to detection request
  window.postMessage(responseMessage, '*');
  
  console.log('✅ Detection response sent successfully');
}

async function handleActionMessage(action, data) {
  console.log(`🎯 Processing action message: ${action}`);
  console.log('Action data:', data);
  
  switch (action) {
    case 'paymentSuccess':
      console.log('💳 Handling payment success...');
      await handlePaymentSuccess(data);
      break;
      
    case 'paymentCancelled':
      console.log('❌ Handling payment cancellation...');
      await handlePaymentCancelled(data);
      break;
      
    case 'initiatePayment':
      console.log('🚀 Handling payment initiation...');
      await handleInitiatePayment();
      break;
      
    case 'continueWithFree':
      console.log('🆓 Handling continue with free...');
      await handleContinueWithFree();
      break;
      
    default:
      console.error(`❓ Unknown action received: ${action}`);
      throw new Error(`Unknown action: ${action}`);
  }
  
  console.log(`✅ Action ${action} completed successfully`);
}

async function handlePaymentSuccess(data) {
  console.log('💳 Starting payment success handling...');
  console.log('Payment data received:', data);
  
  try {
    const { sessionId } = data;
    
    if (!sessionId) {
      console.error('❌ No session ID provided in payment data');
      throw new Error('No session ID provided');
    }
    
    console.log('📋 Session ID extracted:', sessionId);
    console.log('📡 Sending payment verification request to background script...');
    
    // Send message to background script to verify payment
    const backgroundMessage = {
      action: 'verifyPayment',
      sessionId: sessionId
    };
    
    console.log('Background message to send:', backgroundMessage);
    
    const response = await sendMessageToBackground(backgroundMessage);
    
    console.log('📨 Background script response:', response);
    
    if (response && response.success) {
      console.log('✅ Payment verification successful');
      sendResponse('paymentSuccess', true, 'Payment verified successfully');
    } else {
      const errorMsg = response ? response.error : 'Payment verification failed';
      console.error('❌ Payment verification failed:', errorMsg);
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error('💥 Payment success handling failed:', error);
    console.error('Error details:', error.stack);
    sendResponse('paymentSuccess', false, error.message);
  }
}

async function handlePaymentCancelled(data) {
  try {
    // Send cancellation log to background script
    await sendMessageToBackground({
      action: 'logPaymentCancellation',
      data: data
    });
    
    sendResponse('paymentCancelled', true, 'Cancellation logged');
  } catch (error) {
    console.error('Payment cancellation handling failed:', error);
    sendResponse('paymentCancelled', false, error.message);
  }
}

async function handleInitiatePayment() {
  try {
    // Send message to background script to initiate payment
    const response = await sendMessageToBackground({
      action: 'initiatePayment'
    });
    
    if (response && response.success) {
      sendResponse('initiatePayment', true, 'Payment flow initiated');
    } else {
      throw new Error(response ? response.error : 'Failed to initiate payment');
    }
  } catch (error) {
    console.error('Payment initiation failed:', error);
    sendResponse('initiatePayment', false, error.message);
  }
}

async function handleContinueWithFree() {
  try {
    // Ensure user stays in free mode
    await sendMessageToBackground({
      action: 'setFreeMode',
      data: { freeMode: true }
    });
    
    sendResponse('continueWithFree', true, 'Free mode confirmed');
  } catch (error) {
    console.error('Continue with free handling failed:', error);
    sendResponse('continueWithFree', false, error.message);
  }
}

function sendMessageToBackground(message) {
  console.log('📤 Sending message to background script...');
  console.log('Message to background:', message);
  console.log('Communication timeout set to:', COMMUNICATION_TIMEOUT + 'ms');
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('⏰ Background script communication timeout after', COMMUNICATION_TIMEOUT + 'ms');
      resolve({ success: false, error: 'Background script timeout' });
    }, COMMUNICATION_TIMEOUT);
    
    browserAPI.runtime.sendMessage(message, (response) => {
      clearTimeout(timeout);
      
      console.log('📨 Received response from background script');
      console.log('Background response:', response);
      console.log('Runtime last error:', browserAPI.runtime.lastError);
      
      if (browserAPI.runtime.lastError) {
        console.error('❌ Runtime error:', browserAPI.runtime.lastError.message);
        resolve({ success: false, error: browserAPI.runtime.lastError.message });
      } else {
        console.log('✅ Background communication successful');
        resolve(response);
      }
    });
  });
}

function sendResponse(action, success, message) {
  console.log(`Sending response for action: ${action}, success: ${success}, message: ${message}`);
  window.postMessage({
    type: 'ARGUS_EXTENSION_RESPONSE',
    action: action,
    success: success,
    message: message,
    source: 'argus-extension',
    timestamp: Date.now()
  }, '*');
}
