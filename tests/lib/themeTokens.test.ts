// Node's fs and path, without needing Node's type definitions in this project
declare const require: (name: string) => any;
declare const __dirname: string;
const { readFileSync } = require('fs');
const { join } = require('path');

// Every colour lives in the token blocks at the top of each stylesheet;
// the rules below only refer to the tokens
const stripTokenBlocks = (css: string): string =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root[^{]*\{[^}]*\}\s*\}/g, '')
    .replace(/:root[^{,]*\{[^}]*\}/g, '');

const colourLiterals = (css: string): string[] => {
  const declarations: string[] = css.match(/[a-z-]+\s*:[^;{}]*/gi) || [];
  return declarations.reduce<string[]>((found, declaration) => {
    const value = declaration.slice(declaration.indexOf(':') + 1);
    const hex = value.match(/#[0-9a-f]{3,8}\b/gi) || [];
    const rgb = (value.match(/rgba?\([^)]*\)/gi) || []).filter(
      (literal) => !/^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/i.test(literal)
    );
    return found.concat([...hex, ...rgb].map((literal) => `${declaration.trim()} (${literal})`));
  }, []);
};

describe.each(['css/popup.css', 'css/blocked.css'])('%s', (file) => {
  const css: string = readFileSync(join(__dirname, '../..', file), 'utf8');

  it('defines the Paper and Dusk tokens', () => {
    expect(css).toMatch(/:root\s*\{[^}]*--accent:\s*#c4552d/);
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*--accent:\s*#a99bf5/);
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{[^}]*--accent:\s*#a99bf5/);
  });

  it('has no colour literals outside the token blocks', () => {
    expect(colourLiterals(stripTokenBlocks(css))).toEqual([]);
  });
});
