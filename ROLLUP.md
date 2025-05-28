# Argus Extension Rollup Build System

This document explains how the Rollup build system works for the Argus browser extension.

## Overview

The build system uses Rollup to bundle JavaScript modules, compile modern JavaScript syntax, and package the extension for both Chrome and Firefox browsers. Rollup provides better tree-shaking, smaller bundle sizes, and cleaner ES module handling compared to webpack.

## Configuration Files

- `rollup.common.js`: Common rollup configuration shared between all builds
- `rollup.chrome.js`: Chrome-specific production configuration
- `rollup.firefox.js`: Firefox-specific production configuration
- `rollup.chrome.dev.js`: Chrome-specific development configuration
- `rollup.firefox.dev.js`: Firefox-specific development configuration
- `.babelrc`: Babel configuration for transpiling JavaScript

## Directory Structure

The build process creates the following directory structure:

```
dist/
├── chrome/           # Chrome-specific build files
│   ├── background.js
│   ├── background.js.map
│   ├── popup.js
│   ├── popup.js.map
│   ├── popup.html
│   ├── manifest.json
│   ├── chunks/       # Code-split chunks
│   ├── services/     # Service modules
│   ├── js/           # JavaScript files
│   ├── css/          # Stylesheets
│   └── icons/        # Extension icons
├── firefox/          # Firefox-specific build files
│   ├── background.js
│   ├── background.js.map
│   ├── background.html
│   ├── popup.js
│   ├── popup.js.map
│   ├── popup.html
│   ├── manifest.json
│   ├── chunks/       # Code-split chunks
│   ├── services/     # Service modules
│   ├── js/           # JavaScript files
│   ├── css/          # Stylesheets
│   └── icons/        # Extension icons
├── argus-chrome.zip  # Packaged Chrome extension
└── argus-firefox.zip # Packaged Firefox extension
```

## Build Commands

- `npm run build`: Create production builds for both Chrome and Firefox
- `npm run build:chrome`: Create a Chrome-specific production build
- `npm run build:firefox`: Create a Firefox-specific production build
- `npm run build:dev`: Create development builds for both Chrome and Firefox
- `npm run build:chrome:dev`: Create a Chrome-specific development build
- `npm run build:firefox:dev`: Create a Firefox-specific development build
- `npm run watch:chrome`: Watch for changes and rebuild Chrome extension
- `npm run watch:firefox`: Watch for changes and rebuild Firefox extension
- `npm run dev`: Build in development mode and run the dev server
- `npm run package`: Create ZIP packages for both Chrome and Firefox
- `npm run release`: Clean, build, and package for release

## Module Import Syntax

The build system supports ES modules natively:

```javascript
import myModule from './path/to/module.js';
import { namedExport } from './path/to/module.js';
```

## External Libraries

The build system bundles external libraries like Chart.js. To add a new library:

1. Install it with NPM: `npm install --save library-name`
2. Import it in your code: `import Library from 'library-name'`

## Rollup Advantages over Webpack

1. **Better Tree Shaking**: Rollup eliminates unused code more effectively
2. **Smaller Bundles**: Produces smaller output files
3. **ES Module Native**: Built specifically for ES modules
4. **Cleaner Output**: Generated code is more readable
5. **Faster Builds**: Generally faster build times for smaller projects
6. **Better Code Splitting**: More efficient chunk generation

## Firefox Compatibility

The Firefox build generates a special `background.html` file and uses a Manifest V2 configuration for compatibility with Firefox. The rollup configuration automatically handles these differences.

## Development Features

- **Source Maps**: Generated in development mode for easier debugging
- **Watch Mode**: Automatic rebuilding when files change
- **Hot Reloading**: Fast incremental builds during development

## Production Optimizations

- **Code Minification**: Removes comments and unnecessary whitespace
- **Dead Code Elimination**: Removes unused imports and functions
- **Environment Variables**: Replaces process.env.NODE_ENV for optimization
- **Bundle Splitting**: Separates vendor code from application code 