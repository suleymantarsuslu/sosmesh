'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';

import { Button } from '../ui/Button';

import { CommandPalette } from './CommandPalette';
import { DemoModeBanner } from './DemoModeBanner';
import { IncidentSwitcher } from './IncidentSwitcher';
import { MobileNavDrawer } from './MobileNavDrawer';
import { useOperatorPreferences } from './OperatorPreferencesProvider';
import { OrgHeader } from './OrgHeader';
import { SavedViewsMenu } from './SavedViewsMenu';
import { ThemeLocaleControls } from './ThemeLocaleControls';
import { useOrganizationContext } from './useOrganizationContext';

type NavConfig = { href: string; labelKey: string; roles?: string[] };

const NAV: NavConfig[] = [
  { href: '/operator/dashboard', labelKey: 'web.shell.nav.dashboard' },
  { href: '/operator/cases', labelKey: 'web.shell.nav.cases' },
  { href: '/operator/tasks', labelKey: 'web.shell.nav.tasks' },
  { href: '/operator/teams', labelKey: 'web.shell.nav.teams' },
  { href: '/operator/activity', labelKey: 'web.shell.nav.activity' },
  { href: '/operator/health', labelKey: 'web.shell.nav.health', roles: ['ADMIN', 'COORDINATOR'] },
  { href: '/operator/audit', labelKey: 'web.shell.nav.audit', roles: ['ADMIN'] },
  { href: '/operator/admin', labelKey: 'web.shell.nav.admin', roles: ['ADMIN'] },
];

function navItemsForRole(role: string, t: (key: string) => string) {
  return NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => ({
    href: item.href,
    label: t(item.labelKey),
  }));
}

export function OperatorShell({
  children,
  user,
  demoMode = false,
}: {
  children: ReactNode;
  user: { displayName: string; role: string; email?: string };
  demoMode?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useOperatorPreferences();
  const { context } = useOrganizationContext();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = useMemo(
    () => navItemsForRole(user.role, t),
    [user.role, t]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/operator/login');
    router.refresh();
  }

  return (
    <div className="operator-layout">
      <a href="#operator-main" className="skip-link">
        {t('a11y.skipToMain')}
      </a>
      <aside className="operator-sidebar" aria-label={t('a11y.menu')}>
        <div className="operator-brand">{t('web.shell.brand')}</div>
        <OrgHeader
          organizationName={context?.organization?.name ?? null}
          teamName={context?.team?.name ?? null}
          role={user.role}
        />
        <nav>
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <ThemeLocaleControls />
        <div className="operator-user">
          <p>{user.displayName || user.email || 'Operatör'}</p>
          <Button variant="ghost" onClick={logout}>
            {t('web.shell.logout')}
          </Button>
        </div>
      </aside>
      <div className="operator-main-wrap">
        <DemoModeBanner visible={demoMode} />
        <header className="operator-topbar">
          <Button
            variant="ghost"
            className="operator-mobile-menu"
            onClick={() => setDrawerOpen(true)}
          >
            {t('web.shell.mobileMenu')}
          </Button>
          <IncidentSwitcher incidents={context?.incidents ?? []} />
          <Suspense fallback={null}>
            <SavedViewsMenu />
          </Suspense>
          <Button variant="ghost" onClick={() => setPaletteOpen(true)}>
            {t('web.shell.commandShortcut')}
          </Button>
        </header>
        <main id="operator-main" className="operator-main">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={items} />
      <MobileNavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} items={items} />
    </div>
  );
}
