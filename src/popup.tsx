import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './utils/errorHandler';

// Browser API compatibility
const browserAPI = (typeof browser !== 'undefined') ? browser : chrome;

// Initialize the React app
function initializeApp(): void {
  console.log('Initializing React app...');
  const container = document.getElementById('react-root');
  
  if (!container) {
    console.error('React root container not found!');
    return;
  }
  
  console.log('Container found, creating React root...');
  const root = createRoot(container);
  root.render(<App />);
  console.log('React app rendered');
}

// Handle both cases: DOM already loaded or still loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already loaded
  initializeApp();
}

// Setup message listener for switching to the settings tab
browserAPI.runtime.onMessage.addListener((message: any) => {
  if (message.action === 'openSettingsTab') {
    // This will be handled by the App component through a custom event
    window.dispatchEvent(new CustomEvent('openSettingsTab'));
  }
}); 