import { createConfig } from './rollup.common.js';
import replace from '@rollup/plugin-replace';
import fs from 'fs';
import path from 'path';

const config = createConfig('firefox');

// Add production-specific plugins
config.plugins.unshift(
  replace({
    'process.env.NODE_ENV': JSON.stringify('production'),
    preventAssignment: true
  })
);

// Add a custom plugin to create background.html for Firefox
config.plugins.push({
  name: 'create-background-html',
  generateBundle() {
    // Create background.html for Firefox
    const backgroundHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script type="module" src="background.js"></script>
</head>
<body></body>
</html>`;

    // Ensure the directory exists
    const firefoxDir = path.resolve('dist/firefox');
    if (!fs.existsSync(firefoxDir)) {
      fs.mkdirSync(firefoxDir, { recursive: true });
    }

    // Write the background.html file
    fs.writeFileSync(path.join(firefoxDir, 'background.html'), backgroundHtml);
    console.log('Created background.html for Firefox');
  }
});

export default config; 