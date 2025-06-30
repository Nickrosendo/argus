# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Testing
```bash
# Install dependencies
npm install

# Development builds with source maps
npm run build:dev
npm run build:chrome:dev
npm run build:firefox:dev

# Production builds (optimized)
npm run build
npm run build:chrome
npm run build:firefox

# Watch mode for active development
npm run watch:chrome
npm run watch:firefox

# Testing
npm test                # Run all tests with coverage
npm run test:watch      # Watch mode for tests

# Packaging
npm run package         # Create distribution packages
npm run package:chrome
npm run package:firefox

# Utilities
npm run clean          # Clean dist directory
npm run sync-version   # Sync version across manifest files
```

## Architecture Overview

This is a cross-browser extension (Chrome/Firefox) built with **React 18** and **TypeScript**, following **Manifest V3** specifications. The architecture is service-worker based with React components for the UI.

### Core Components Structure
- **Background Service Worker**: `background.js` - handles time tracking, alarms, and browser API interactions
- **React Popup UI**: `src/components/App.tsx` - main application with tab-based navigation
- **Browser API Abstraction**: `services/BrowserApiService.js` - unified API for Chrome/Firefox differences
- **Custom Hooks**: `src/hooks/` - `useBrowserStorage` and `useBrowserMessaging` for React-browser integration

### Key Services
- **AuthService.js**: Handles user authentication and social login
- **SocialAuthService.js**: Google/Microsoft OAuth integration
- **ApiService.js**: Backend API communication
- **FreeService.js**: Free tier functionality management

### Build System
- **Rollup** with separate configurations for Chrome/Firefox
- **Babel** for JSX/TypeScript transpilation
- **PostCSS** with TailwindCSS for styling
- **Environment variables** via `.env` file for API URLs and OAuth client IDs

## Development Workflow

### Loading Extension for Testing
**Chrome**: Load `dist/chrome/` as unpacked extension
**Firefox**: Load `dist/firefox/manifest.json` as temporary add-on

### Key Development Patterns
- Follow **Manifest V3** requirements strictly
- Use service worker for background processing (avoid state in popup)
- **All API requests must be made through the background service worker** to avoid CORS issues - components should send messages to the background worker which handles HTTP requests and returns responses
- Implement cross-browser compatibility (Chrome/Firefox/Opera)
- Follow TDD practices with Jest testing
- Use functional programming patterns, avoid classes
- Implement proper error handling and logging

### React Architecture
- **Tab-based navigation** with centralized state management
- **Custom hooks** for browser API integration
- **Props drilling** from App.tsx to child components
- **Browser storage** integration via `useBrowserStorage` hook

## Testing
- **Jest** with jsdom environment
- **React Testing Library** for component testing
- **Coverage collection** from src/, background.js, and specific JS files
- **Setup file**: `tests/setup.js` for test configuration

## Environment Configuration
Create `.env` file in root with:
```
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
MICROSOFT_CLIENT_ID=your_microsoft_client_id
API_URL=your_api_url
```

## Code Conventions
- **TypeScript** with strict mode enabled
- **Functional components** with hooks
- **Descriptive naming** (isLoading, hasPermission)
- **JSDoc comments** for documentation
- **Error boundaries** for React component errors
- **Secure handling** of OAuth tokens and user data