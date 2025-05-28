// Add error handling for script loading
window.addEventListener('error', function(event) {
  console.error('Script error in error-handler.js:', event.filename, event.lineno, event.message);
  
  // Log to storage for debugging purposes
  if (typeof browser !== 'undefined') {
    browser.storage.local.set({
      last_error: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        timestamp: new Date().toISOString()
      }
    });
  } else if (typeof chrome !== 'undefined') {
    chrome.storage.local.set({
      last_error: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        timestamp: new Date().toISOString()
      }
    });
  }
}); 