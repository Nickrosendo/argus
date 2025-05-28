# Argus - Screen Time Tracker

![Argus Logo](icons/icon128.png)

A browser extension for Chrome and Firefox that monitors and visualizes the time you spend on different websites, similar to the iPhone's Screen Time feature.

## Features

- **Real-time tracking**: Monitors the time you spend on each website as you browse
- **Daily summaries**: Shows a breakdown of your browsing habits for the current day
- **Historical data**: View your screen time for previous days
- **Interactive charts**: Visualize your usage patterns with easy-to-understand charts
- **Automatic idle detection**: Pauses tracking when you're away from your computer
- **Data export**: Export your screen time data as JSON
- **Privacy-focused**: All data is stored locally on your device, not on external servers
- **Cross-browser support**: Works on both Chrome and Firefox

## Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store (link to be added)
2. Click "Add to Chrome"
3. Confirm the installation when prompted

### From Firefox Add-ons (Coming Soon)

1. Visit the Firefox Add-ons site (link to be added)
2. Click "Add to Firefox"
3. Confirm the installation when prompted

### Manual Installation

#### Chrome

1. Download or clone this repository
2. Run `npm run build:chrome` to build the Chrome extension
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" by toggling the switch in the top-right corner
5. Click "Load unpacked" and select the `dist/chrome` folder
6. The Argus extension icon should now appear in your Chrome toolbar

#### Firefox

1. Download or clone this repository
2. Run `npm run build:firefox` to build the Firefox extension
3. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on..."
5. Select the `dist/firefox/manifest.json` file
6. The Argus extension icon should now appear in your Firefox toolbar

For permanent installation in Firefox:
1. Go to `about:config` and set `xpinstall.signatures.required` to `false`
2. Open `about:addons`
3. Click the gear icon and select "Install Add-on From File..."
4. Select the `dist/argus-firefox.zip` file

## Usage

1. Click on the Argus icon in your browser toolbar to open the popup
2. The default "Today" tab shows your current screen time statistics
3. Navigate through the tabs to view different aspects of your usage:
   - **Today**: Current day's screen time
   - **Stats**: Visual charts of your usage patterns
   - **History**: Browse through past days' data
   - **Settings**: Configure the extension's behavior

## Settings

- **Consider idle after**: Set how long until inactivity is detected (default: 5 minutes)
- **Daily screen time goal**: Set a target for your daily screen time (default: 8 hours)
- **Show notifications**: Enable/disable notifications
- **Export Data**: Save your usage data as a JSON file
- **Clear All Data**: Reset all stored data (requires confirmation)

## Privacy

Argus respects your privacy:
- All data is stored locally in your browser's storage
- No data is sent to external servers
- No personally identifiable information is collected

## Development

### Project Structure

- `manifest.json`: Chrome extension configuration
- `manifest-firefox.json`: Firefox extension configuration
- `background.js`: Background script for tracking
- `popup.html/css/js`: User interface files
- `icons/`: Extension icons in various sizes
- `webpack.*.js`: Webpack configuration files for building the extensions
- `scripts/`: Build and utility scripts

### Building the Extension

```bash
# Install dependencies
npm install

# Generate icons (if needed)
npm run generate-icons

# Build for both Chrome and Firefox
npm run build

# Build for Chrome only
npm run build:chrome

# Build for Firefox only
npm run build:firefox

# Build for development (includes source maps)
npm run build:dev

# Watch for changes (Chrome)
npm run watch:chrome

# Watch for changes (Firefox)
npm run watch:firefox

# Development mode with automatic rebuilding
npm run dev

# Package extensions into ZIP files
npm run package

# Build and package for release
npm run release
```

### Testing

The extension includes unit tests for core functionality:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage
```

Tests are organized in the `tests/` directory and cover:
- Background script functionality
- Popup UI utility functions
- Browser storage interactions

See `tests/README.md` for detailed information about the testing approach.

### Built With

- HTML, CSS, and JavaScript
- Chart.js for data visualization
- Webpack for bundling
- Jest for testing

## License

This project is licensed under the MIT License - see the LICENSE file for details. 