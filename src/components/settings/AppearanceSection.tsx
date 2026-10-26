import React, { useEffect, useState } from 'react';
import { ThemeSetting } from '../../lib/theme';

interface AppearanceSectionProps {
  value: ThemeSetting;
  onChange: (value: ThemeSetting) => void;
}

const OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const DARK_QUERY = '(prefers-color-scheme: dark)';

const systemIsDark = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;

const AppearanceSection: React.FC<AppearanceSectionProps> = ({ value, onChange }) => {
  const [systemDark, setSystemDark] = useState<boolean>(systemIsDark);

  // Keep the System hint right when the computer switches while Settings is open
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    const onChangeScheme = (): void => setSystemDark(query.matches);
    query.addEventListener?.('change', onChangeScheme);
    return () => query.removeEventListener?.('change', onChangeScheme);
  }, []);

  const hint = value === 'system'
    ? `Following your computer: ${systemDark ? 'dark' : 'light'} right now`
    : `Always ${value}`;

  return (
    <div className="setting-section appearance-section">
      <h3>Appearance</h3>
      <div className="segmented" role="group" aria-label="Appearance">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`segmented-btn ${value === option.value ? 'active' : ''}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="setting-hint">{hint}</p>
    </div>
  );
};

export default AppearanceSection;
