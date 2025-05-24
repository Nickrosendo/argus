# Argus Extension Webpack Build System

This document explains how the Webpack build system works for the Argus browser extension.

## Overview

The build system uses Webpack to bundle JavaScript modules, compile modern JavaScript syntax, and package the extension for both Chrome and Firefox browsers.

## Configuration Files

- `webpack.common.js`: Common webpack configuration shared between development and production builds
- `webpack.dev.js`: Development-specific configuration (includes source maps)
- `webpack.prod.js`: Production-specific configuration (with optimizations)
- `.babelrc`: Babel configuration for transpiling JavaScript

## Build Commands

- `npm run build`: Create a production build
- `npm run build:dev`: Create a development build with source maps
- `npm run build:chrome`: Create a Chrome-specific production build
- `npm run build:firefox`: Create a Firefox-specific production build
- `npm run watch`: Watch for changes and rebuild automatically
- `npm run dev`: Build in development mode and run the dev server

## Module Import Syntax

The build system supports ES modules, so you can use:

```javascript
import myModule from './path/to/module';
```

Instead of CommonJS require:

```javascript
const myModule = require('./path/to/module');
```

## External Libraries

The build system bundles external libraries like Chart.js. To add a new library:

1. Install it with NPM: `npm install --save library-name`
2. Import it in your code: `import Library from 'library-name'`

## Firefox Compatibility

The Firefox build generates a special `background.html` file and uses a Manifest V2 configuration for compatibility with Firefox. 