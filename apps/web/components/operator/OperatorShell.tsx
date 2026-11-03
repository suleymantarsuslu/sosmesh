'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { SosMeshLogo } from '../brand/SosMeshLogo';
import { LocaleSwitcher } from '../i18n/LocaleSwitcher';
import { Button } from '../ui/Button';

import { CommandPalette } from './CommandPalette';
import { DemoModeBanner } from './DemoModeBanner';
import { IncidentSwitcher } from './IncidentSwitcher';
import { MobileNavDrawer } from './MobileNavDrawer';
import { OperatorLiveStatus } from './OperatorLiveStatus';
import { useOperatorPreferences } from './OperatorPreferencesProvider';
import { OperatorTopbarOverflow } from './OperatorTopbarOverflow';
import { OrgHeader } from './OrgHeader';
import { SavedViewsMenu } from './SavedViewsMenu';
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
  { href: '/operator/help', labelKey: 'web.shell.nav.help' },
  { href: '/operator/admin', labelKey: 'web.shell.nav.admin', roles: ['ADMIN'] },
];

function navItemsForRole(role: string, t: (key: string) => string) {
  return NAV.filter((item) => !item.roles || item.roles.includes(role)).map((item) => ({
    href: item.href,
    label: t(item.labelKey),
  }));
}

const NAV_ICONS: Record<string, string> = {
  '/operator/dashboard': '▣',
  '/operator/cases': '◎',
  '/operator/tasks': '☑',
  '/operator/teams': '◉',
  '/operator/activity': '↻',
  '/operator/health': '♥',
  '/operator/audit': '⌁',
  '/operator/help': '?',
  '/operator/admin': '⚙',
};

const SIDEBAR_KEY = 'sosmesh-sidebar-collapsed-v1';

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
  const { t, theme, setTheme } = useOperatorPreferences();
  const { context } = useOrganizationContext();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [userMenuOpen]);

  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch {
      setSidebarCollapsed(false);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  };

  const items = useMemo(
    () =>
      navItemsForRole(user.role, t).map((item) => ({
        ...item,
        icon: NAV_ICONS[item.href] ?? '•',
      })),
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
    <div
      className={
        sidebarCollapsed
          ? 'operator-layout operator-layout--sidebar-collapsed'
          : 'operator-layout'
      }
    >
      <a href="#operator-main" className="skip-link">
        {t('a11y.skipToMain')}
      </a>
      <aside className="operator-sidebar" aria-label={t('a11y.menu')}>
        <div className="operator-brand" data-testid="operator-brand">
          <SosMeshLogo size={44} />
          <span className="operator-brand__text">{t('web.shell.brand')}</span>
        </div>
        <OrgHeader
          organizationName={context?.organization?.name ?? null}
          teamName={context?.team?.name ?? null}
          role={user.role}
        />
        <Button
          variant="ghost"
          className="operator-sidebar__toggle"
          onClick={toggleSidebar}
          aria-expanded={!sidebarCollapsed}
          data-testid="operator-sidebar-toggle"
        >
          {sidebarCollapsed ? t('web.shell.sidebarExpand') : t('web.shell.sidebarCollapse')}
        </Button>
        <nav className="operator-sidebar__nav">
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  title={item.label}
                >
                  <span className="operator-nav-icon" aria-hidden>
                    {NAV_ICONS[item.href] ?? '•'}
                  </span>
                  <span className="operator-nav-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="operator-main-wrap">
        <DemoModeBanner visible={demoMode} />
        <header className="operator-topbar">
          <div className="operator-topbar__brand-mobile">
            <SosMeshLogo size={32} />
          </div>
          <Button
            variant="ghost"
            className="operator-mobile-menu"
            aria-expanded={drawerOpen}
            aria-controls="operator-mobile-nav"
            data-testid="operator-hamburger"
            onClick={() => setDrawerOpen(true)}
          >
            {t('web.shell.mobileMenu')}
          </Button>
          <div className="operator-topbar__search-wrap">
            <input
              type="search"
              className="operator-topbar__search"
              placeholder={t('web.shell.commandPlaceholder')}
              aria-label={t('web.shell.commandPlaceholder')}
              onFocus={() => setPaletteOpen(true)}
              onClick={() => setPaletteOpen(true)}
              readOnly
            />
          </div>
          <OperatorLiveStatus />
          <div className="operator-topbar__cluster operator-topbar__cluster--desktop">
            <IncidentSwitcher incidents={context?.incidents ?? []} />
            <Suspense fallback={null}>
              <SavedViewsMenu />
            </Suspense>
          </div>
          <OperatorTopbarOverflow incidents={context?.incidents ?? []} />
          <div className="operator-topbar__controls">
            <LocaleSwitcher className="operator-topbar__locale" testId="operator-topbar-locale" />
            <button
              type="button"
              className="ui-button ui-button--ghost operator-topbar__theme"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              data-testid="operator-topbar-theme"
            >
              {theme === 'light' ? t('web.shell.themeDark') : t('web.shell.themeLight')}
            </button>
            <div className="operator-user-menu" ref={userMenuRef} data-testid="operator-topbar-user">
              <button
                type="button"
                className="ui-button ui-button--ghost operator-user-menu__trigger"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                onClick={() => setUserMenuOpen((open) => !open)}
              >
                <span className="operator-user-menu__avatar" aria-hidden>
                  {(user.displayName || user.email || t('web.shell.defaultUser')).slice(0, 1).toUpperCase()}
                </span>
                <span className="operator-user-menu__name">
                  {user.displayName || user.email || t('web.shell.defaultUser')}
                </span>
              </button>
              {userMenuOpen ? (
                <div className="operator-user-menu__panel" role="menu">
                  <p className="operator-user-menu__meta">{user.email || user.displayName}</p>
                  <Button
                    variant="ghost"
                    className="operator-user-menu__logout"
                    onClick={() => {
                      setUserMenuOpen(false);
                      void logout();
                    }}
                  >
                    {t('web.shell.logout')}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main id="operator-main" className="operator-main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={items} />
      <MobileNavDrawer
        id="operator-mobile-nav"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={items}
        organizationName={context?.organization?.name ?? null}
        teamName={context?.team?.name ?? null}
        role={user.role}
      />
    </div>
  );
}
