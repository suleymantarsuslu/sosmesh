'use client';

import { Suspense, useEffect, useRef, useState } from 'react';

import { Button } from '../ui/Button';

import { IncidentSwitcher, type IncidentOption } from './IncidentSwitcher';
import { useOperatorPreferences } from './OperatorPreferencesProvider';
import { SavedViewsMenu } from './SavedViewsMenu';

export function OperatorTopbarOverflow({ incidents }: { incidents: IncidentOption[] }) {
  const { t } = useOperatorPreferences();
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
    <div className="operator-topbar-overflow" ref={rootRef}>
      <Button
        variant="ghost"
        className="operator-topbar-overflow__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        data-testid="operator-topbar-overflow"
        onClick={() => setOpen((value) => !value)}
      >
        {t('web.shell.overflowMenu')}
      </Button>
      {open ? (
        <div className="operator-topbar-overflow__panel" role="menu">
          <IncidentSwitcher incidents={incidents} />
          <Suspense fallback={null}>
            <SavedViewsMenu />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
