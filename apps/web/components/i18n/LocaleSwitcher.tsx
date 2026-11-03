'use client';

import { useOperatorPreferences } from '../operator/OperatorPreferencesProvider';

type LocaleSwitcherProps = {
  className?: string;
  testId?: string;
};

export function LocaleSwitcher({ className, testId = 'locale-switcher' }: LocaleSwitcherProps) {
  const { locale, setLocale, t } = useOperatorPreferences();

  return (
    <label className={className} data-testid={testId}>
      <span className="locale-switcher__label">{t('web.shell.language')}</span>
      <select
        className="locale-switcher__select"
        aria-label={t('web.shell.language')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as 'tr' | 'en')}
        data-testid="locale-switcher-select"
      >
        <option value="en">EN</option>
        <option value="tr">TR</option>
      </select>
    </label>
  );
}
