'use client';

import { useEffect, useRef, useState } from 'react';

import { LocaleSwitcher } from '../i18n/LocaleSwitcher';
import { Button } from '../ui/Button';

import { IncidentSwitcher, type IncidentOption } from './IncidentSwitcher';
import { useOperatorPreferences } from './OperatorPreferencesProvider';

export function OperatorTopbarOverflow({ incidents }: { incidents: IncidentOption[] }) {
  const { t, theme, setTheme } = useOperatorPreferences();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div className="operator-topbar-overflow" ref={rootRef} data-topbar-item="overflow">
      <Button
        variant="ghost"
        className="operator-topbar-overflow__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('web.shell.overflowMenu')}
        data-testid="operator-topbar-overflow"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden>⋯</span>
      </Button>
      {open ? (
        <div className="operator-topbar-overflow__panel" role="menu">
          <LocaleSwitcher className="operator-topbar-overflow__locale" />
          <button
            type="button"
            className="ui-button ui-button--ghost operator-topbar-overflow__theme"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            data-testid="operator-topbar-theme-mobile"
          >
            {theme === 'light' ? t('web.shell.themeDark') : t('web.shell.themeLight')}
          </button>
          <IncidentSwitcher incidents={incidents} />
        </div>
      ) : null}
    </div>
  );
}
