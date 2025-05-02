const chokidar = require('chokidar');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const build = require('./build');

// Parse command line arguments to determine which browser to build for
const args = process.argv.slice(2);
const buildChrome = args.includes('--chrome') || !args.length;
const buildFirefox = args.includes('--firefox') || !args.length;

// Function to get relative path for logging
function getRelativePath(filePath) {
  return path.relative(process.cwd(), filePath);
}

// Function to handle file changes
async function handleChange(filePath) {
  const relativePath = getRelativePath(filePath);
  console.log(`\n[${new Date().toLocaleTimeString()}] File changed: ${relativePath}`);
  
  if (buildChrome) {
    console.log('Rebuilding Chrome extension...');
    await build.buildChrome();
  }
  
  if (buildFirefox) {
    console.log('Rebuilding Firefox extension...');
    await build.buildFirefox();
  }
  
  console.log(`\nWatching for changes... Press Ctrl+C to stop.`);
}

// Initialize watcher
async function initWatcher() {
  // Files and directories to watch
  const watchPaths = [
    'manifest.json',
    'manifest-firefox.json',
    'background.js',
    'popup.html',
    'css/**/*.css',
    'js/**/*.js',
    'icons/**/*.png'
  ];

  // Files to ignore
  const ignoredPaths = [
    'node_modules/**',
    'dist/**',
    '.git/**',
    'css/fontawesome.min.css' // Ignore the downloaded Font Awesome CSS
  ];

  console.log('Starting development mode...');
  
  // Create initial build
  if (buildChrome) {
    console.log('Building Chrome extension...');
    await build.buildChrome();
  }
  
  if (buildFirefox) {
    console.log('Building Firefox extension...');
    await build.buildFirefox();
  }
  
  // Watch for changes
  const watcher = chokidar.watch(watchPaths, {
    ignored: ignoredPaths,
    persistent: true,
    ignoreInitial: true
  });

  watcher
    .on('add', handleChange)
    .on('change', handleChange)
    .on('unlink', handleChange);

  console.log(`\nWatching for changes... Press Ctrl+C to stop.`);
  console.log(`Watching: ${watchPaths.join(', ')}`);
  
  // Print browser reload instructions
  console.log('\nTo see your changes in the browser:');
  
  if (buildChrome) {
    console.log('- Chrome: Go to chrome://extensions/, click the refresh icon on the Argus extension');
  }
  
  if (buildFirefox) {
    console.log('- Firefox: Go to about:debugging#/runtime/this-firefox');
    console.log('  Click "Reload" next to the Argus extension');
  }
}

// Start watching
initWatcher().catch(err => {
  console.error('Error in development mode:', err);
  process.exit(1);
}); 