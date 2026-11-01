'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '../ui/Button';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

type NavItem = { href: string; label: string };

export function MobileNavDrawer({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const { t } = useOperatorPreferences();

  if (!open) {
    return null;
  }

  return (
    <div className="operator-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="operator-drawer"
        aria-label={t('a11y.menu')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="operator-drawer__header">
          <strong>{t('web.shell.brand')}</strong>
          <Button variant="ghost" onClick={onClose}>
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
