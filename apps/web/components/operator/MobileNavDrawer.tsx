'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId } from 'react';

import { SosMeshLogo } from '../brand/SosMeshLogo';
import { Button } from '../ui/Button';

import { useOperatorPreferences } from './OperatorPreferencesProvider';
import { OrgHeader } from './OrgHeader';

type NavItem = { href: string; label: string; icon?: string };

export function MobileNavDrawer({
  id,
  open,
  onClose,
  items,
  organizationName,
  teamName,
  role,
}: {
  id?: string;
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  organizationName?: string | null;
  teamName?: string | null;
  role?: string;
}) {
  const pathname = usePathname();
  const { t } = useOperatorPreferences();
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    document.body.classList.add('operator-drawer-open');
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
    return () => {
      document.body.classList.remove('operator-drawer-open');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="operator-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        id={id}
        className="operator-drawer operator-drawer--nav"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="operator-mobile-nav-drawer"
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
        <OrgHeader organizationName={organizationName ?? null} teamName={teamName ?? null} role={role ?? ''} />
        <nav className="operator-drawer__nav">
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  onClick={onClose}
                >
                  {item.icon ? (
                    <span className="operator-nav-icon" aria-hidden>
                      {item.icon}
                    </span>
                  ) : null}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
