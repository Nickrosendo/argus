# Argus - Screen Time Tracker

A Chrome and Firefox extension that monitors and visualizes the time you spend on different websites, now built with **React** for better state management and user experience.

## Features

- **Real-time tracking** of website usage
- **Daily, weekly, and historical** screen time statistics
- **Interactive charts** showing usage patterns by category
- **Website blocking** functionality with customizable block lists
- **Daily goals** and progress tracking
- **Data export** and privacy controls
- **Cross-browser support** (Chrome and Firefox)
- **Modern React UI** with component-based architecture

## Technology Stack

- **Frontend**: React 18 with hooks for state management
- **Build System**: Rollup with Babel for JSX transpilation
- **Charts**: Chart.js for data visualization
- **Storage**: Browser extension storage APIs
- **Styling**: CSS with modern responsive design

## Development

### Prerequisites
- Node.js 16+ and npm
- Chrome or Firefox for testing

### Setup
```bash
# Install dependencies
npm install

# Development build with source maps and hot reload
npm run build:dev

# Watch mode for active development
npm run watch:chrome    # For Chrome development
npm run watch:firefox   # For Firefox development

# Production build (optimized)
npm run build

# Package for distribution
npm run package
```

### Project Structure
```
src/
├── components/          # React components
│   ├── App.jsx         # Main application component
│   ├── Header.jsx      # Navigation header
│   ├── Footer.jsx      # Footer component
│   ├── AuthOverlay.jsx # Authentication overlay
│   └── tabs/           # Tab components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
└── popup.jsx          # Entry point

js/                     # Legacy JavaScript (being phased out)
css/                    # Stylesheets
icons/                  # Extension icons
services/               # API services
```

### React Architecture

The extension now uses a modern React architecture with:

- **Component-based UI**: Each tab and UI section is a separate React component
- **Custom hooks**: `useBrowserStorage` for seamless browser storage integration
- **State management**: Centralized state in the main App component with props drilling
- **Browser API integration**: Maintains full compatibility with Chrome and Firefox extension APIs

### Key Components

- **App.jsx**: Main application state and routing
- **TodayTab.jsx**: Today's screen time with progress tracking
- **StatsTab.jsx**: Charts and statistics with Chart.js integration
- **HistoryTab.jsx**: Historical data with date navigation
- **SettingsTab.jsx**: Settings management and website blocking
- **AccountTab.jsx**: User authentication and account management

## Browser Extension Development

### Loading in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `dist/chrome/`

### Loading in Firefox
1. Open `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on" and select `dist/firefox/manifest.json`

### Testing
The extension includes comprehensive error handling and logging for development:
- React error boundaries for component errors
- Global error handlers for unhandled exceptions
- Console logging for debugging storage and API interactions

## Building and Packaging

### Development Builds
```bash
npm run build:dev      # Both browsers with source maps
npm run build:chrome:dev
npm run build:firefox:dev
```

### Production Builds
```bash
npm run build          # Both browsers optimized
npm run build:chrome
npm run build:firefox
```

### Packaging for Distribution
```bash
npm run package        # Creates .zip files for both browsers
npm run package:chrome
npm run package:firefox
```

## React Migration

This extension was recently migrated from vanilla JavaScript to React. See [REACT_CONVERSION.md](./REACT_CONVERSION.md) for detailed migration notes and benefits.

### Benefits of React Version
- **Better state management** with hooks and centralized state
- **Component reusability** and better code organization
- **Improved developer experience** with React DevTools
- **Easier maintenance** and feature additions
- **Better performance** with React's virtual DOM

## Privacy

Argus respects your privacy:
- All data is stored locally in your browser
- No data is sent to external servers without explicit consent
- Optional cloud sync available with user account
- Data export functionality for user control

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes using the React component architecture
4. Test with both Chrome and Firefox
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check the [React conversion documentation](./REACT_CONVERSION.md) for technical details 