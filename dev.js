const chokidar = require('chokidar');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse command line arguments to determine which browser to build for
const args = process.argv.slice(2);
const buildChrome = args.includes('--chrome') || !args.length;
const buildFirefox = args.includes('--firefox') || !args.length;

// Function to get relative path for logging
function getRelativePath(filePath) {
  return path.relative(process.cwd(), filePath);
}

// Function to run webpack
function runWebpack(config) {
  return new Promise((resolve, reject) => {
    exec(`npx webpack --config ${config}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running webpack: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Webpack stderr: ${stderr}`);
      }
      console.log(stdout);
      resolve();
    });
  });
}

// Function to handle file changes
async function handleChange(filePath) {
  const relativePath = getRelativePath(filePath);
  console.log(`\n[${new Date().toLocaleTimeString()}] File changed: ${relativePath}`);
  
  try {
    if (buildChrome) {
      console.log('Rebuilding Chrome extension...');
      await runWebpack('webpack.chrome.dev.js');
    }
    
    if (buildFirefox) {
      console.log('Rebuilding Firefox extension...');
      await runWebpack('webpack.firefox.dev.js');
    }
    
    console.log(`\nWatching for changes... Press Ctrl+C to stop.`);
  } catch (error) {
    console.error('Error rebuilding extension:', error);
  }
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
  try {
    if (buildChrome) {
      console.log('Building Chrome extension...');
      await runWebpack('webpack.chrome.dev.js');
    }
    
    if (buildFirefox) {
      console.log('Building Firefox extension...');
      await runWebpack('webpack.firefox.dev.js');
    }
  } catch (error) {
    console.error('Error building extension:', error);
    process.exit(1);
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
    console.log('  Extension directory: ' + path.resolve(__dirname, 'dist/chrome'));
  }
  
  if (buildFirefox) {
    console.log('- Firefox: Go to about:debugging#/runtime/this-firefox');
    console.log('  Click "Reload" next to the Argus extension');
    console.log('  Extension directory: ' + path.resolve(__dirname, 'dist/firefox'));
  }
}

// Start watching
initWatcher().catch(err => {
  console.error('Error in development mode:', err);
  process.exit(1);
}); 