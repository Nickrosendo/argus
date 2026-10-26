// Checks the built extensions (dist/chrome, dist/firefox) for anything that
// would break the "free, open source, no account, nothing leaves the browser"
// promise. Run after a fresh build: rm -rf dist && npm run build
const fs = require('fs');
const path = require('path');

const FORBIDDEN = [
  'Premium',
  'Upgrade to',
  'Sign in',
  'Stripe',
  'sevalla',
  'argustime.com/payment',
  'accounts.google.com',
  'login.microsoftonline.com',
  'cdnjs.cloudflare.com',
];
const REQUIRED_IN_POPUP = ['ko-fi.com/', 'github.com/Nickrosendo/argus'];
const TARGETS = ['chrome', 'firefox'];
const CHECKED_EXTENSIONS = new Set(['.js', '.html', '.json', '.css']);
// A stylesheet that loads anything from the web (fonts, images, imports)
const CSS_REMOTE_URL = /(?:url\(\s*|@import\s+(?:url\(\s*)?)['"]?\s*https?:\/\//i;

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function checkManifest(manifestPath, label, problems) {
  if (!fs.existsSync(manifestPath)) {
    problems.push(`${label}: manifest.json is missing`);
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.oauth2) problems.push(`${label}: manifest.json has an oauth2 block`);
  if (manifest.content_scripts) problems.push(`${label}: manifest.json has content_scripts`);
  const permissions = [...(manifest.permissions || []), ...(manifest.optional_permissions || [])];
  if (permissions.includes('identity')) problems.push(`${label}: manifest.json asks for the identity permission`);

  const csp = manifest.content_security_policy;
  const pages = typeof csp === 'string' ? csp : (csp && csp.extension_pages) || '';
  const connect = pages
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('connect-src'));
  if (!connect) {
    problems.push(`${label}: manifest.json has no content security policy with connect-src 'self'`);
  } else if (connect !== "connect-src 'self'") {
    problems.push(`${label}: connect-src is "${connect}", expected 'self' only`);
  }
}

function runChecks(root) {
  const problems = [];
  for (const target of TARGETS) {
    const dir = path.join(root, 'dist', target);
    if (!fs.existsSync(dir)) {
      problems.push(`${target}: ${dir} does not exist (build first)`);
      continue;
    }
    for (const file of listFiles(dir)) {
      if (!CHECKED_EXTENSIONS.has(path.extname(file))) continue;
      const text = fs.readFileSync(file, 'utf8');
      const rel = `${target}/${path.relative(dir, file)}`;
      for (const word of FORBIDDEN) {
        // "Stripe" is matched as a whole word: bundled charts have "HorizontalStripes"
        let found;
        if (word === 'Stripe') found = /\bStripe\b/.test(text);
        else if (word === 'Sign in') found = text.toLowerCase().includes('sign in');
        else found = text.includes(word);
        if (found) problems.push(`${rel}: contains "${word}"`);
      }
      if (path.extname(file) === '.css' && CSS_REMOTE_URL.test(text)) {
        problems.push(`${rel}: loads a web address from the stylesheet`);
      }
    }
    checkManifest(path.join(dir, 'manifest.json'), target, problems);

    const popup = path.join(dir, 'popup.js');
    const popupText = fs.existsSync(popup) ? fs.readFileSync(popup, 'utf8') : '';
    for (const link of REQUIRED_IN_POPUP) {
      if (!popupText.includes(link)) problems.push(`${target}/popup.js: does not contain "${link}"`);
    }
  }
  return problems;
}

if (require.main === module) {
  const problems = runChecks(path.resolve(__dirname, '..'));
  if (problems.length > 0) {
    console.error('release-check: FAILED');
    problems.forEach((problem) => console.error(`  - ${problem}`));
    process.exit(1);
  }
  console.log('release-check: OK');
}

module.exports = { runChecks };
