// Add global error handler for debugging extension issues
window.addEventListener('error', function(event: ErrorEvent): void {
  console.error('Script error:', event.filename, event.lineno, event.message);
});

window.addEventListener('unhandledrejection', function(event: PromiseRejectionEvent): void {
  console.error('Unhandled promise rejection:', event.reason);
}); 