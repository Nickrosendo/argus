const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`Syncing version ${version} to all manifest files...`);

// Update manifest.json
const manifestPath = path.resolve(__dirname, '../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = version;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`✓ Updated manifest.json to version ${version}`);

// Update manifest-firefox.json
const manifestFirefoxPath = path.resolve(__dirname, '../manifest-firefox.json');
const manifestFirefox = JSON.parse(fs.readFileSync(manifestFirefoxPath, 'utf8'));
manifestFirefox.version = version;
fs.writeFileSync(manifestFirefoxPath, JSON.stringify(manifestFirefox, null, 2) + '\n');
console.log(`✓ Updated manifest-firefox.json to version ${version}`);

console.log('✅ Version sync complete!');
console.log('\nNote: The Footer component now automatically uses the version from package.json');
console.log('To change the version, update package.json and run this script again.'); 