import { createConfig } from './rollup.common.js';
import replace from '@rollup/plugin-replace';

const config = createConfig('chrome');

// Add production-specific plugins
config.plugins.unshift(
  replace({
    'process.env.NODE_ENV': JSON.stringify('production'),
    preventAssignment: true
  })
);

export default config; 