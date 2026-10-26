import { applyTheme, normalizeTheme, THEME_CACHE_KEY } from '../../src/lib/theme';

describe('normalizeTheme', () => {
  it('keeps a known setting', () => {
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('system')).toBe('system');
  });

  it('turns anything else into system', () => {
    expect(normalizeTheme('blue')).toBe('system');
    expect(normalizeTheme(undefined)).toBe('system');
    expect(normalizeTheme(42)).toBe('system');
  });
});

describe('applyTheme', () => {
  beforeEach(() => localStorage.clear());

  it('sets data-theme for a manual choice and remembers it', () => {
    const el = document.createElement('div');
    applyTheme('dark', el);
    expect(el.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe('dark');
    expect(THEME_CACHE_KEY).toBe('argusTheme');
  });

  it('removes data-theme for system', () => {
    const el = document.createElement('div');
    el.dataset.theme = 'light';
    applyTheme('system', el);
    expect(el.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe('system');
  });

  it('does not throw when localStorage cannot be written', () => {
    const el = document.createElement('div');
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(() => applyTheme('light', el)).not.toThrow();
      expect(el.dataset.theme).toBe('light');
    } finally {
      localStorage.setItem = originalSetItem;
    }
  });
});
