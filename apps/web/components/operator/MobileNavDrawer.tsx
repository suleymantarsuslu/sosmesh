'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId } from 'react';

import { SosMeshLogo } from '../brand/SosMeshLogo';
import { Button } from '../ui/Button';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

type NavItem = { href: string; label: string };

export function MobileNavDrawer({
  id,
  open,
  onClose,
  items,
}: {
  id?: string;
  open: boolean;
  onClose: () => void;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const { t } = useOperatorPreferences();
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const closeButton = document.querySelector<HTMLButtonElement>(
      '[data-testid="mobile-nav-close"]'
    );
    closeButton?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="operator-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        id={id}
        className="operator-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="operator-drawer__header">
          <div className="operator-drawer__brand">
            <SosMeshLogo size={36} />
            <strong id={titleId}>{t('web.shell.brand')}</strong>
          </div>
          <Button
            variant="ghost"
            data-testid="mobile-nav-close"
            onClick={onClose}
          >
            {t('a11y.closeMenu')}
          </Button>
        </div>
        <nav>
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  onClick={onClose}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
