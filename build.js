const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const archiver = require('archiver');
const https = require('https');

// Parse command line arguments
const args = process.argv.slice(2);
const buildChromeBool = args.includes('--chrome') || !args.length;
const buildFirefoxBool = args.includes('--firefox') || !args.length;

// Font Awesome CSS URL
const FONT_AWESOME_URL = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
const FONT_AWESOME_LOCAL_PATH = 'css/fontawesome.min.css';

// Ensure the dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// List of files to copy to both Chrome and Firefox builds
const commonFiles = [
  'background.js',
  'popup.html',
  'LICENSE',
  'README.md',
  'js/chart.min.js',
  'js/popup.js',
  'css/popup.css',
  'css/fontawesome.min.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

// Function to download Font Awesome CSS
function downloadFontAwesome() {
  return new Promise((resolve, reject) => {
    // Make sure the css directory exists
    const cssDir = path.join(__dirname, 'css');
    if (!fs.existsSync(cssDir)) {
      fs.mkdirSync(cssDir, { recursive: true });
    }

    const destPath = path.join(__dirname, FONT_AWESOME_LOCAL_PATH);
    
    // If the file already exists, no need to download it again
    if (fs.existsSync(destPath)) {
      resolve();
      return;
    }

    console.log('Downloading Font Awesome CSS...');
    const file = fs.createWriteStream(destPath);
    
    https.get(FONT_AWESOME_URL, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Font Awesome CSS downloaded successfully.');
        resolve();
      });
    }).on('error', err => {
      fs.unlink(destPath);
      console.error('Error downloading Font Awesome CSS:', err.message);
      reject(err);
    });
  });
}

// Function to modify popup.html to use local Font Awesome
function updatePopupHtml(targetDir) {
  const popupPath = path.join(targetDir, 'popup.html');
  let content = fs.readFileSync(popupPath, 'utf8');
  
  // Replace CDN link with local link
  content = content.replace(
    /<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/6\.4\.0\/css\/all\.min\.css">/,
    '<link rel="stylesheet" href="css/fontawesome.min.css">'
  );
  
  fs.writeFileSync(popupPath, content);
}

// Build for Chrome
async function buildChrome() {
  console.log('Building Chrome extension...');
  
  // Download Font Awesome CSS if needed
  try {
    await downloadFontAwesome();
  } catch (error) {
    console.error('Failed to download Font Awesome CSS. Building without it.');
  }
  
  const chromeDir = path.join(distDir, 'chrome');
  if (!fs.existsSync(chromeDir)) {
    fs.mkdirSync(chromeDir, { recursive: true });
  }
  
  // Copy common files
  commonFiles.forEach(file => {
    const destDir = path.dirname(path.join(chromeDir, file));
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Skip if the file doesn't exist (might be the case for Font Awesome if download failed)
    if (fs.existsSync(path.join(__dirname, file))) {
      fs.copyFileSync(path.join(__dirname, file), path.join(chromeDir, file));
    }
  });
  
  // Copy manifest.json
  fs.copyFileSync(path.join(__dirname, 'manifest.json'), path.join(chromeDir, 'manifest.json'));
  
  // Update popup.html to use local Font Awesome
  updatePopupHtml(chromeDir);
  
  // Create zip file
  const output = fs.createWriteStream(path.join(distDir, 'argus-chrome.zip'));
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  output.on('close', () => {
    console.log(`Chrome extension packaged successfully: ${archive.pointer()} bytes`);
  });
  
  archive.on('error', (err) => {
    throw err;
  });
  
  archive.pipe(output);
  archive.directory(chromeDir, false);
  archive.finalize();
}

// Build for Firefox
async function buildFirefox() {
  console.log('Building Firefox extension...');
  
  // Download Font Awesome CSS if needed
  try {
    await downloadFontAwesome();
  } catch (error) {
    console.error('Failed to download Font Awesome CSS. Building without it.');
  }
  
  const firefoxDir = path.join(distDir, 'firefox');
  if (!fs.existsSync(firefoxDir)) {
    fs.mkdirSync(firefoxDir, { recursive: true });
  }
  
  // Copy common files
  commonFiles.forEach(file => {
    const destDir = path.dirname(path.join(firefoxDir, file));
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Skip if the file doesn't exist (might be the case for Font Awesome if download failed)
    if (fs.existsSync(path.join(__dirname, file))) {
      fs.copyFileSync(path.join(__dirname, file), path.join(firefoxDir, file));
    }
  });
  
  // Determine which Firefox manifest to use
  fs.copyFileSync(
    path.join(__dirname, 'manifest-firefox.json'), 
    path.join(firefoxDir, 'manifest.json')
  );
  
  // Update popup.html to use local Font Awesome
  updatePopupHtml(firefoxDir);
  
  // Create zip file
  const output = fs.createWriteStream(path.join(distDir, 'argus-firefox.zip'));
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  output.on('close', () => {
    console.log(`Firefox extension packaged successfully: ${archive.pointer()} bytes`);
  });
  
  archive.on('error', (err) => {
    throw err;
  });
  
  archive.pipe(output);
  archive.directory(firefoxDir, false);
  archive.finalize();
}

// Run the build process if this file is run directly
if (require.main === module) {
  if (buildChromeBool) {
    buildChrome();
  }
  
  if (buildFirefoxBool) {
    buildFirefox();
  }
  
  console.log('Build process initiated. Check the dist/ directory when complete.');
}

// Export functions for use in dev.js
module.exports = {
  buildChrome,
  buildFirefox,
  commonFiles
}; 