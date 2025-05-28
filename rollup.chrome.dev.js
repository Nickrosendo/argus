import { createConfig } from './rollup.common.js';

const config = createConfig('chrome');

// Development-specific settings
config.output.sourcemap = true;

export default config; 