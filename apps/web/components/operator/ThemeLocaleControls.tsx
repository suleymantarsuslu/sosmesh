'use client';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

export function ThemeLocaleControls() {
  const { locale, setLocale, theme, setTheme, t } = useOperatorPreferences();

  return (
    <div className="operator-theme-locale" data-testid="theme-locale-controls">
      <label>
        {t('web.shell.language')}
        <select
          aria-label={t('web.shell.language')}
          value={locale}
          onChange={(event) => setLocale(event.target.value as 'tr' | 'en')}
        >
          <option value="tr">TR</option>
          <option value="en">EN</option>
        </select>
      </label>
      <button
        type="button"
        className="ui-button ui-button--ghost"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      >
        {theme === 'light' ? t('web.shell.themeDark') : t('web.shell.themeLight')}
      </button>
    </div>
  );
}
