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

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const version = packageJson.version;

// Values written into the code at build time. Development and production
// builds share them; only NODE_ENV differs.
export function buildReplacements(nodeEnv) {
  return {
    'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    '__VERSION__': JSON.stringify(version),
    preventAssignment: true,
  };
}

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
      replace(buildReplacements('development')),
      
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
            src: isFirefox ? 'manifest-firefox.json' : 'manifest.json', 
            dest: outputDir,
            rename: 'manifest.json',
            transform: (contents) => {
              // Replace version placeholder with actual version from package.json
              const manifest = contents.toString().replace('"version": "1.0.1"', `"version": "${version}"`);
              
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
