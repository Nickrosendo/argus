import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';
import cleanup from 'rollup-plugin-cleanup';

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
      // Replace environment variables
      replace({
        'process.env.NODE_ENV': JSON.stringify('development'),
        preventAssignment: true
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
          { src: 'popup.html', dest: outputDir },
          { src: 'blocked.html', dest: outputDir },
          { src: 'css/**/*', dest: `${outputDir}/css` },
          { src: 'icons/**/*', dest: `${outputDir}/icons` },
          { src: 'js/auth.js', dest: `${outputDir}/js` },
          { src: 'js/error-handler.js', dest: `${outputDir}/js` },
          { src: 'services/**/*', dest: `${outputDir}/services` },
          { 
            src: isFirefox ? 'manifest-firefox.json' : 'manifest.json', 
            dest: outputDir,
            rename: 'manifest.json'
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