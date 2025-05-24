const fs = require('fs');
const path = require('path');

// Paths
const distDir = path.join(__dirname, '../dist');
const manifestPath = path.join(distDir, 'manifest.json');
const firefoxManifestPath = path.join(__dirname, '../manifest-firefox.json');

// Create Firefox-compatible manifest
console.log('Preparing Firefox extension...');

// Read manifests
const chromeManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const firefoxManifest = JSON.parse(fs.readFileSync(firefoxManifestPath, 'utf8'));

// Merge any additional Firefox settings
if (!fs.existsSync(path.join(distDir, 'background.html'))) {
  // Create background.html for Firefox
  const backgroundHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="background.js"></script>
</head>
<body></body>
</html>`;
  fs.writeFileSync(path.join(distDir, 'background.html'), backgroundHtml);
}

// Write the Firefox manifest
fs.writeFileSync(manifestPath, JSON.stringify(firefoxManifest, null, 2));

console.log('Firefox extension prepared successfully'); 