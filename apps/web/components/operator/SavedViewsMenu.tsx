'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { Button } from '../ui/Button';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

export function SavedViewsMenu() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, savedViews, saveCurrentView, removeSavedView } = useOperatorPreferences();

  const href = searchParams.toString()
    ? `${pathname}?${searchParams.toString()}`
    : pathname;

  return (
    <div className="operator-saved-views" data-testid="saved-views-menu">
      <span className="operator-saved-views__label">{t('web.shell.savedViews')}</span>
      <Button
        variant="ghost"
        onClick={() => saveCurrentView(`${pathname.split('/').pop()}`, href)}
      >
        {t('web.shell.saveView')}
      </Button>
      <ul>
        {savedViews.map((view) => (
          <li key={view.id}>
            <a href={view.href}>{view.name}</a>
            <button type="button" onClick={() => removeSavedView(view.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
