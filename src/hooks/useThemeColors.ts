import { useEffect, useState } from 'react';

export interface ThemeColors {
  accent: string;
  text: string;
  muted: string;
  line: string;
  surface: string;
}

// Paper values, used where the stylesheet is not loaded (tests)
const FALLBACK: ThemeColors = {
  accent: '#c4552d',
  text: '#22201c',
  muted: '#6f6a61',
  line: '#e6e0d5',
  surface: '#ffffff',
};

const readColors = (): ThemeColors => {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    accent: read('--accent', FALLBACK.accent),
    text: read('--text', FALLBACK.text),
    muted: read('--muted', FALLBACK.muted),
    line: read('--line', FALLBACK.line),
    surface: read('--surface', FALLBACK.surface),
  };
};

/**
 * The theme's colours for places CSS cannot reach, such as chart strokes.
 * Recomputed when the Settings choice changes (the data-theme attribute on
 * <html>) or the computer switches between light and dark.
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(readColors);

  useEffect(() => {
    const update = (): void => {
      const next = readColors();
      setColors((prev) =>
        (Object.keys(next) as (keyof ThemeColors)[]).every((key) => prev[key] === next[key]) ? prev : next
      );
    };
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const query = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
    query?.addEventListener?.('change', update);

    return () => {
      observer.disconnect();
      query?.removeEventListener?.('change', update);
    };
  }, []);

  return colors;
}
