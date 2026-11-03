'use client';

import { LocaleSwitcher } from '../i18n/LocaleSwitcher';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

export function ThemeLocaleControls() {
  const { theme, setTheme, t } = useOperatorPreferences();

  return (
    <div className="operator-theme-locale" data-testid="theme-locale-controls">
      <LocaleSwitcher />
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
