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

# Testing (use Node 20; the default shell node may be broken, so put a Node 20 bin first on PATH)
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
- **Background Service Worker**: `background.js` is the entry point (startup, alarms, listener registration); the logic lives in `background/`:
  - `tracking.js` - which tab is being looked at and time accounting
  - `blocking.js` - blocking rules, temporary unblocks, navigation checks. A blocked visit is sent to `blocked.html` with `tabs.update` from `webNavigation.onBeforeNavigate` (with the `tabs.onUpdated` fallback in `tracking.js`); the Chrome declarativeNetRequest rules only `block`, never `redirect`, so the extension needs no host permissions (`release-check.js` fails if a manifest asks for any). Chrome keeps the blocked address in the history before `blocked.html`, so going Back from the blocked page steps back once more (`tabs.goBack`) instead of blocking it again; which address each tab's blocked page replaced is kept in `state.blockedPageTabs` (survives a worker restart)
  - `messages.js` - messages from the popup, blocked page and content scripts
  - `focus.js` - focus sessions: block the whole block list until a stored end time, ended by an alarm
  - `backup.js` - restoreBackup: day rollover and unblock reset first, then merge the backup into storage
  - `writeQueue.js` - the single storage write queue; tracker, restore and focus-stats writes all go through it
  - `constants.js` - HISTORY_DAYS (90), DATA_VERSION (3, bump it to rerun `migrateStoredData`), OBSOLETE_KEYS
  - `state.js` - shared in-memory state, mirrored to `chrome.storage.session` so a worker restart resumes tracking
  - Register every listener synchronously at the top level of `background.js`; handlers wait on the `ready` promise
- **React Popup UI**: `src/components/App.tsx` - main application with tab-based navigation
- **Browser API Abstraction**: `services/BrowserApiService.js` - unified API for Chrome/Firefox differences
- **Metrics**: `src/utils/metrics.ts` and `src/utils/categories.ts` compute everything the screens show from recorded data; do not add estimated figures
- **Custom Hooks**: `src/hooks/` - `useBrowserStorage` and `useThemeColors` for React-browser integration

### Key Services
- `services/BrowserApiService.js`: unified Chrome/Firefox API
- `services/backupUtils.js` + `background/backup.js`: backup file format `{argusBackup:1, exportedAt, data}`, parse/validate, and the merge rule (per day, whichever version recorded more time wins; never added together)
- `services/trackingUtils.js`: pure helpers for time accounting

### Build System
- **Rollup** with separate configurations for Chrome/Firefox
- **Babel** for JSX/TypeScript transpilation
- **PostCSS** with TailwindCSS for styling
- The build reads no `.env` file and needs no secrets
- `npm run release:check` (after `rm -rf dist && npm run build`) fails if the build contains account, payment or third-party strings, or a network-capable manifest

## Development Workflow

### Loading Extension for Testing
**Chrome**: Load `dist/chrome/` as unpacked extension
**Firefox**: Load `dist/firefox/manifest.json` as temporary add-on

### Key Development Patterns
- Follow **Manifest V3** requirements strictly
- Use service worker for background processing (avoid state in popup)
- No network requests: Argus has no server. The only outbound links are the ones the user clicks, all in `src/lib/links.ts`
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
- **Coverage collection** from src/, background.js, background/, services/, and specific JS files
- `tests/background/worker.test.js` runs the real background worker against an in-memory fake browser API with a fake clock; extend it when changing tracking or blocking behaviour
- **Setup file**: `tests/setup.js` for test configuration

## Code Conventions
- **TypeScript** with strict mode enabled
- **Functional components** with hooks
- **Descriptive naming** (isLoading, hasPermission)
- **JSDoc comments** for documentation
- **Error boundaries** for React component errors
- **Theme**: `src/lib/theme.ts` (with `js/theme-init.js` and `src/hooks/useThemeColors.ts`). Every colour is a token at the top of `css/popup.css` and `css/blocked.css` (Paper light / Dusk dark); never add a colour literal (`tests/lib/themeTokens.test.ts` enforces it)
- **Links**: `src/lib/links.ts` holds DONATE_URL, SOURCE_URL and PRIVACY_URL, the only outbound links