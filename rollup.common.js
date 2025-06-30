import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';
import cleanup from 'rollup-plugin-cleanup';
import postcss from 'rollup-plugin-postcss';
import json from '@rollup/plugin-json';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

// Load environment variables from the extension folder .env file
const envConfig = dotenv.config({ path: '.env' });

// Log environment loading result
if (envConfig.error) {
  console.warn('Warning: Could not load .env file from extension folder:', envConfig.error.message);
  console.warn('Make sure .env file exists in the argus-extension folder with GOOGLE_CLIENT_ID, MICROSOFT_CLIENT_ID, and API_URL');
} else {
  console.log('Successfully loaded environment variables from extension .env file');
}

// Get environment variables with fallbacks
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your_google_client_id.apps.googleusercontent.com';
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || 'your_microsoft_client_id_here';
const API_URL = process.env.API_URL || 'http://localhost:3000';

// Validate that environment variables are provided
if (GOOGLE_CLIENT_ID === 'your_google_client_id.apps.googleusercontent.com') {
  console.warn('Warning: GOOGLE_CLIENT_ID is using fallback value. Please set it in the extension .env file.');
}
if (MICROSOFT_CLIENT_ID === 'your_microsoft_client_id_here') {
  console.warn('Warning: MICROSOFT_CLIENT_ID is using fallback value. Please set it in the extension .env file.');
}
if (API_URL === 'http://localhost:3000') {
  console.log('Info: Using default API_URL (localhost:3000). Set API_URL in .env for production.');
}

console.log('Environment variables loaded:');
console.log('- GOOGLE_CLIENT_ID:', GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 30)}...` : 'not set');
console.log('- MICROSOFT_CLIENT_ID:', MICROSOFT_CLIENT_ID ? `${MICROSOFT_CLIENT_ID.substring(0, 30)}...` : 'not set');
console.log('- API_URL:', API_URL);

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const version = packageJson.version;

export function createConfig(platform) {
  const isFirefox = platform === 'firefox';
  const outputDir = `dist/${platform}`;

  return {
    input: {
      background: 'background.js',
      popup: 'src/popup.tsx'
    },
    output: {
      dir: outputDir,
      format: 'es',
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name]-[hash].js'
    },
    plugins: [
      // JSON plugin for importing JSON files
      json(),
      
      // Replace environment variables and version
      replace({
        'process.env.NODE_ENV': JSON.stringify('development'),
        'process.env.GOOGLE_CLIENT_ID': JSON.stringify(GOOGLE_CLIENT_ID),
        'process.env.MICROSOFT_CLIENT_ID': JSON.stringify(MICROSOFT_CLIENT_ID),
        'process.env.API_URL': JSON.stringify(API_URL),
        '__VERSION__': JSON.stringify(version),
        '__GOOGLE_CLIENT_ID__': JSON.stringify(GOOGLE_CLIENT_ID),
        '__MICROSOFT_CLIENT_ID__': JSON.stringify(MICROSOFT_CLIENT_ID),
        '__API_URL__': JSON.stringify(API_URL),
        preventAssignment: true
      }),
      
      // PostCSS plugin for processing CSS including Tailwind
      postcss({
        extract: 'css/tailwind.css',
        minimize: true
      }),
      
      // TypeScript plugin
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true,
        exclude: ['tests/**/*', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx']
      }),
      
      // Resolve node modules
      resolve({
        browser: true,
        preferBuiltins: false,
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }),
      
      // Convert CommonJS modules to ES6
      commonjs({
        include: ['node_modules/**']
      }),
      
      // Babel transpilation
      babel({
        babelHelpers: 'bundled',
        exclude: ['node_modules/**', 'tests/**/*'],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        presets: ['@babel/preset-env', '@babel/preset-react']
      }),
      
      // Clean up comments and whitespace (exclude JSX/TSX files)
      cleanup({
        comments: 'none',
        exclude: ['**/*.jsx', '**/*.tsx']
      }),
      
      // Copy static files
      copy({
        targets: [
          // Copy all HTML files automatically
          { src: '*.html', dest: outputDir },
          // Copy all CSS files automatically  
          { src: 'css/*.css', dest: `${outputDir}/css` },
          // Copy all standalone JS files automatically
          { src: 'js/*.js', dest: `${outputDir}/js` },
          { src: 'icons/**/*', dest: `${outputDir}/icons` },
          { 
            src: 'services/**/*',
            dest: `${outputDir}/services`,
            transform: (contents, filename) => {
              // Only transform JavaScript files
              if (filename.endsWith('.js')) {
                let content = contents.toString();
                
                // Replace client ID and API URL placeholders with actual values
                content = content.replace(/process\.env\.GOOGLE_CLIENT_ID/g, `"${GOOGLE_CLIENT_ID}"`);
                content = content.replace(/process\.env\.MICROSOFT_CLIENT_ID/g, `"${MICROSOFT_CLIENT_ID}"`);
                content = content.replace(/process\.env\.API_URL/g, `"${API_URL}"`);
                content = content.replace(/__GOOGLE_CLIENT_ID__/g, `"${GOOGLE_CLIENT_ID}"`);
                content = content.replace(/__MICROSOFT_CLIENT_ID__/g, `"${MICROSOFT_CLIENT_ID}"`);
                content = content.replace(/__API_URL__/g, `"${API_URL}"`);
                
                return content;
              }
              return contents;
            }
          },
          { 
            src: isFirefox ? 'manifest-firefox.json' : 'manifest.json', 
            dest: outputDir,
            rename: 'manifest.json',
            transform: (contents) => {
              // Replace version placeholder with actual version from package.json
              let manifest = contents.toString().replace('"version": "1.0.1"', `"version": "${version}"`);
              
              // Replace Google client ID placeholder with actual value (only for Chrome manifest)
              if (!isFirefox) {
                manifest = manifest.replace(
                  '"client_id": "__GOOGLE_CLIENT_ID__"',
                  `"client_id": "${GOOGLE_CLIENT_ID}"`
                );
              }
              
              // Replace API_URL placeholder in CSP with actual API URL
              manifest = manifest.replace(
                '__API_URL__',
                API_URL
              );
              
              return manifest;
            }
          }
        ]
      })
    ],
    external: [],
    onwarn: (warning, warn) => {
      // Suppress certain warnings
      if (warning.code === 'THIS_IS_UNDEFINED') return;
      warn(warning);
    }
  };
} 
