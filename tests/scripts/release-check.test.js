const fs = require('fs');
const os = require('os');
const path = require('path');
const { runChecks } = require('../../scripts/release-check');

const goodManifest = () => ({
  manifest_version: 3,
  permissions: ['storage'],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self'" },
});

describe('release check', () => {
  let root;

  const write = (target, file, content) => {
    const full = path.join(root, 'dist', target, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content));
  };
  const manifestWith = (change) => {
    const manifest = goodManifest();
    change(manifest);
    write('chrome', 'manifest.json', manifest);
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
    ['chrome', 'firefox'].forEach((target) => {
      write(target, 'manifest.json', goodManifest());
      write(target, 'popup.js', 'links: https://ko-fi.com/x https://github.com/Nickrosendo/argus');
      write(target, 'css/popup.css', 'body { color: red; background: url(../icons/a.png); }');
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('passes a clean build', () => {
    expect(runChecks(root)).toEqual([]);
  });

  it('fails when a build folder is missing', () => {
    fs.rmSync(path.join(root, 'dist', 'firefox'), { recursive: true });
    expect(runChecks(root).join('\n')).toMatch(/firefox: .*does not exist/);
  });

  it.each(['Premium', 'Upgrade to', 'Sign in', 'sign in', 'SIGN IN', 'Stripe', 'sevalla', 'accounts.google.com', 'cdnjs.cloudflare.com'])(
    'fails when a script contains "%s"',
    (word) => {
      write('chrome', 'chunks/a.js', `var x = "${word}";`);
      expect(runChecks(root).join('\n')).toMatch(/chrome\/chunks\/a\.js: contains/);
    }
  );

  it('does not flag a word that only contains Stripe', () => {
    write('chrome', 'chunks/a.js', 'var HorizontalStripes = 1;');
    expect(runChecks(root)).toEqual([]);
  });

  it('fails when a stylesheet contains a forbidden string', () => {
    write('firefox', 'css/popup.css', '/* Premium */ body {}');
    expect(runChecks(root).join('\n')).toMatch(/firefox\/css\/popup\.css: contains "Premium"/);
  });

  it.each([
    '@import "https://fonts.example.com/a.css";',
    "@import url('http://fonts.example.com/a.css');",
    'body { background: url(https://example.com/a.png); }',
    'body { background: url( "http://example.com/a.png" ); }',
  ])('fails when a stylesheet loads a web address: %s', (css) => {
    write('chrome', 'css/popup.css', css);
    expect(runChecks(root).join('\n')).toMatch(/chrome\/css\/popup\.css: loads a web address/);
  });

  it('fails on an oauth2 block', () => {
    manifestWith((m) => { m.oauth2 = { client_id: 'x' }; });
    expect(runChecks(root).join('\n')).toMatch(/oauth2/);
  });

  it('fails on content_scripts', () => {
    manifestWith((m) => { m.content_scripts = [{ matches: ['<all_urls>'], js: ['a.js'] }]; });
    expect(runChecks(root).join('\n')).toMatch(/content_scripts/);
  });

  it('fails on the identity permission', () => {
    manifestWith((m) => { m.permissions.push('identity'); });
    expect(runChecks(root).join('\n')).toMatch(/identity permission/);
  });

  it('fails without a content security policy', () => {
    manifestWith((m) => { delete m.content_security_policy; });
    expect(runChecks(root).join('\n')).toMatch(/no content security policy/);
  });

  it("fails when connect-src is not 'self'", () => {
    manifestWith((m) => {
      m.content_security_policy.extension_pages = "script-src 'self'; connect-src 'self' https://example.com";
    });
    expect(runChecks(root).join('\n')).toMatch(/connect-src is .* expected 'self' only/);
  });

  it.each(['ko-fi.com/', 'github.com/Nickrosendo/argus'])('fails when the popup lacks the link %s', (link) => {
    write('chrome', 'popup.js', 'links: https://ko-fi.com/x https://github.com/Nickrosendo/argus'.replace(link, 'removed'));
    expect(runChecks(root).join('\n')).toMatch(new RegExp(`chrome/popup\\.js: does not contain "${link}"`));
  });
});
