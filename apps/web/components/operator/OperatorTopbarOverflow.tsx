'use client';

import { useRef, useState } from 'react';

import { LocaleSwitcher } from '../i18n/LocaleSwitcher';
import { Button } from '../ui/Button';
import { FixedPanel } from '../ui/FixedPanel';

import { IncidentSwitcher, type IncidentOption } from './IncidentSwitcher';
import { useOperatorPreferences } from './OperatorPreferencesProvider';

export function OperatorTopbarOverflow({ incidents }: { incidents: IncidentOption[] }) {
  const { t, theme, setTheme } = useOperatorPreferences();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="operator-topbar-overflow" data-topbar-item="overflow">
      <Button
        ref={triggerRef}
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
        <FixedPanel
          triggerRef={triggerRef}
          className="operator-topbar-overflow__panel"
          role="menu"
          align="right"
          zIndex={1000}
          onClose={() => setOpen(false)}
        >
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
        </FixedPanel>
      ) : null}
    </div>
  );
}
