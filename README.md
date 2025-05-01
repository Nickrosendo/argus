# Argus - Screen Time Tracker

![Argus Logo](icons/icon128.png)

A Chrome extension that monitors and visualizes the time you spend on different websites, similar to the iPhone's Screen Time feature.

## Features

- **Real-time tracking**: Monitors the time you spend on each website as you browse
- **Daily summaries**: Shows a breakdown of your browsing habits for the current day
- **Historical data**: View your screen time for previous days
- **Interactive charts**: Visualize your usage patterns with easy-to-understand charts
- **Automatic idle detection**: Pauses tracking when you're away from your computer
- **Data export**: Export your screen time data as JSON
- **Privacy-focused**: All data is stored locally on your device, not on external servers

## Installation

### From Chrome Web Store (Coming Soon)

1. Visit the Chrome Web Store (link to be added)
2. Click "Add to Chrome"
3. Confirm the installation when prompted

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top-right corner
4. Click "Load unpacked" and select the extension folder
5. The Argus extension icon should now appear in your Chrome toolbar

## Usage

1. Click on the Argus icon in your Chrome toolbar to open the popup
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

- `manifest.json`: Extension configuration
- `background.js`: Background service worker for tracking
- `popup.html/css/js`: User interface files
- `icons/`: Extension icons in various sizes

### Built With

- HTML, CSS, and JavaScript
- Chart.js for data visualization

## License

This project is licensed under the MIT License - see the LICENSE file for details. 