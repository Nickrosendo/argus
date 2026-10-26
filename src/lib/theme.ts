// Light (Paper) or dark (Dusk) look. "system" follows the computer's setting
// through the prefers-color-scheme media query in the stylesheets; "light"
// and "dark" are forced with a data-theme attribute on <html>.
export type ThemeSetting = 'system' | 'light' | 'dark';

// Copy kept in localStorage so js/theme-init.js can apply a manual choice
// before the page is drawn, without waiting for extension storage
export const THEME_CACHE_KEY = 'argusTheme';

export function normalizeTheme(value: unknown): ThemeSetting {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function applyTheme(setting: ThemeSetting, root: HTMLElement = document.documentElement): void {
  if (setting === 'light' || setting === 'dark') {
    root.dataset.theme = setting;
  } else {
    delete root.dataset.theme;
  }
  try {
    localStorage.setItem(THEME_CACHE_KEY, setting);
  } catch (error) {
    // Storage can be unavailable; the theme still applies for this page
  }
}
