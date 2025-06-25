import replace from '@rollup/plugin-replace';
import { createConfig } from './rollup.common.js';
import dotenv from 'dotenv';

// Load environment variables from the extension folder .env file
dotenv.config({ path: '.env' });

const config = createConfig('chrome');

// Override the replace plugin for production
config.plugins = config.plugins.map(plugin => {
  if (plugin.name === 'replace') {
    return replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(process.env.GOOGLE_CLIENT_ID || 'your_google_client_id.apps.googleusercontent.com'),
      'process.env.MICROSOFT_CLIENT_ID': JSON.stringify(process.env.MICROSOFT_CLIENT_ID || 'your_microsoft_client_id_here'),
      'process.env.API_URL': JSON.stringify(process.env.API_URL || 'http://localhost:3000'),
      '__VERSION__': JSON.stringify(JSON.parse(require('fs').readFileSync('./package.json', 'utf8')).version),
      '__GOOGLE_CLIENT_ID__': JSON.stringify(process.env.GOOGLE_CLIENT_ID || 'your_google_client_id.apps.googleusercontent.com'),
      '__MICROSOFT_CLIENT_ID__': JSON.stringify(process.env.MICROSOFT_CLIENT_ID || 'your_microsoft_client_id_here'),
      '__API_URL__': JSON.stringify(process.env.API_URL || 'http://localhost:3000'),
      preventAssignment: true
    });
  }
  return plugin;
});

export default config; 
