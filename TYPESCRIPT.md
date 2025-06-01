# TypeScript Migration

This document outlines the TypeScript migration for the Argus browser extension, detailing the changes made and how to work with the new TypeScript setup.

## Overview

The Argus browser extension has been migrated from JavaScript (JSX) to TypeScript (TSX) for better type safety, improved developer experience, and enhanced maintainability.

## What Was Changed

### 1. Build System Updates

- **Added TypeScript Support**: Installed `typescript`, `@rollup/plugin-typescript`, and `rollup-plugin-typescript2`
- **Updated Rollup Configuration**: Modified `rollup.common.js` to include TypeScript plugin and support `.ts`/`.tsx` extensions
- **Created TypeScript Configuration**: Added `tsconfig.json` with appropriate settings for a browser extension project

### 2. Type Definitions

- **Browser API Types** (`src/types/browser.d.ts`): Comprehensive type definitions for Chrome and Firefox extension APIs
- **Storage Types** (`src/types/storage.ts`): Type definitions for application data structures

### 3. Component Migration

All React components were migrated from `.jsx` to `.tsx`:

- `src/popup.tsx` - Main popup entry point
- `src/components/App.tsx` - Root application component
- `src/components/Header.tsx` - Navigation header
- `src/components/Footer.tsx` - Application footer
- `src/components/AuthOverlay.tsx` - Authentication overlay
- `src/components/tabs/TodayTab.tsx` - Today's stats tab
- `src/components/tabs/StatsTab.tsx` - Statistics tab with charts
- `src/components/tabs/HistoryTab.tsx` - Historical data tab
- `src/components/tabs/SettingsTab.tsx` - Settings configuration tab
- `src/components/tabs/AccountTab.tsx` - Account management tab

### 4. Utility and Hook Migration

- `src/hooks/useBrowserStorage.ts` - Custom hook for browser storage with full type safety
- `src/utils/timeUtils.ts` - Time formatting utilities with proper typing
- `src/utils/errorHandler.ts` - Global error handling with typed event handlers

## Type Safety Benefits

### Compile-time Error Detection
- Catch type mismatches before runtime
- Prevent undefined property access
- Ensure proper function signatures

### Enhanced IntelliSense
- Better autocompletion in VS Code
- Type hints for browser extension APIs
- Context-aware suggestions

### Refactoring Safety
- Rename symbols across the codebase safely
- Find all usages of interfaces and types
- Prevent breaking changes during refactoring

## Key Type Interfaces

### StorageData
```typescript
interface StorageData {
  sites: SiteData;
  totalTime: number;
  history: HistoryData;
  settings: Settings;
  blockedSites: string[];
  authToken: string | boolean | null;
  userInfo: UserInfo | null;
}
```

### BrowserAPI
```typescript
interface BrowserAPI {
  tabs: TabsAPI;
  storage: StorageAPI;
  runtime: RuntimeAPI;
  declarativeNetRequest?: DeclarativeNetRequestAPI;
}
```

## Development Workflow

### Building
- `npm run build:chrome:dev` - Development build for Chrome
- `npm run build:firefox:dev` - Development build for Firefox
- `npm run build` - Production builds for both browsers

### Type Checking
TypeScript compilation happens automatically during the build process. The TypeScript compiler will report any type errors before the build completes.

### Adding New Components

When creating new React components:

1. Use `.tsx` extension
2. Define proper prop interfaces
3. Use `React.FC<PropsInterface>` for function components
4. Import types from `../types/storage` and `../types/browser` as needed

Example:
```typescript
import React from 'react';
import { StorageData } from '../types/storage';

interface MyComponentProps {
  data: StorageData;
  onUpdate: (updates: Partial<StorageData>) => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ data, onUpdate }) => {
  // Component implementation
};

export default MyComponent;
```

### Browser API Usage

Use the typed browser APIs:
```typescript
// Typed storage access
browserAPI.storage.local.get(['sites', 'settings'], (result) => {
  // result is properly typed
});

// Typed declarative net request (with null check)
if (browserAPI.declarativeNetRequest) {
  browserAPI.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2, 3],
    addRules: []
  });
}
```

## Configuration Files

### tsconfig.json
- Targets ES2018 for good browser compatibility
- Enables strict type checking
- Configured for React JSX transformation
- Includes appropriate DOM and ES6 libraries

### Rollup Configuration
- TypeScript plugin processes `.ts` and `.tsx` files
- Source maps enabled for development builds
- Babel still used for additional transformations

## Migration Notes

- All JavaScript files have been converted to TypeScript
- Type annotations added throughout the codebase
- Browser extension APIs properly typed
- Storage data structures fully typed
- React components use proper prop typing

## Troubleshooting

### Common Issues

1. **Missing Type Definitions**: If you encounter missing types for third-party libraries, install the corresponding `@types/` package
2. **Browser API Types**: The custom browser API types may need updates as new features are added
3. **Storage Type Mismatches**: Ensure storage data structures match the defined interfaces

### Type Errors

- Use type assertions (`as Type`) sparingly and only when necessary
- Prefer proper typing over `any` types
- Add null checks for optional browser APIs

This migration provides a solid foundation for continued development with better type safety and developer experience. 