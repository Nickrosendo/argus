import replace from '@rollup/plugin-replace';
import { createConfig, buildReplacements } from './rollup.common.js';

const config = createConfig('chrome');

// Same build-time values as development, with NODE_ENV set to production
config.plugins = config.plugins.map(plugin =>
  plugin.name === 'replace' ? replace(buildReplacements('production')) : plugin
);

export default config; 
