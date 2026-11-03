'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { SosMeshLogo } from '../brand/SosMeshLogo';
import { LocaleSwitcher } from '../i18n/LocaleSwitcher';
import { Button } from '../ui/Button';
import { FixedPanel } from '../ui/FixedPanel';

import { CommandPalette } from './CommandPalette';
import { DemoModeBanner } from './DemoModeBanner';
import { IncidentSwitcher } from './IncidentSwitcher';
import { MobileNavDrawer } from './MobileNavDrawer';
import { OperatorLiveStatus } from './OperatorLiveStatus';
import { useOperatorPreferences } from './OperatorPreferencesProvider';
import { OperatorTopbarOverflow } from './OperatorTopbarOverflow';
import { useOrganizationContext } from './useOrganizationContext';

type NavConfig = { href: string; labelKey: string; roles?: string[] };

const NAV: NavConfig[] = [
  { href: '/operator/dashboard', labelKey: 'web.shell.nav.dashboard' },
  { href: '/operator/cases', labelKey: 'web.shell.nav.cases' },
  { href: '/operator/ai', labelKey: 'web.shell.nav.ai' },
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
  '/operator/ai': '◈',
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
  const userMenuRef = useRef<HTMLButtonElement>(null);

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
        <button
          type="button"
          className="operator-sidebar__chevron-toggle"
          onClick={toggleSidebar}
          aria-expanded={!sidebarCollapsed}
          aria-label={
            sidebarCollapsed ? t('web.shell.sidebarExpandAria') : t('web.shell.sidebarCollapseAria')
          }
          title={
            sidebarCollapsed ? t('web.shell.sidebarExpandAria') : t('web.shell.sidebarCollapseAria')
          }
          data-testid="operator-sidebar-toggle"
        >
          <span aria-hidden>{sidebarCollapsed ? '›' : '‹'}</span>
        </button>
        <div className="operator-brand" data-testid="operator-brand">
          <SosMeshLogo size={44} />
          <span className="operator-brand__text">{t('web.shell.brand')}</span>
        </div>
        <nav className="operator-sidebar__nav">
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
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
        <header className="operator-topbar" data-testid="operator-topbar">
          <button
            type="button"
            className="ui-button ui-button--ghost operator-hamburger"
            aria-expanded={drawerOpen}
            aria-controls="operator-mobile-nav"
            aria-label={t('web.shell.mobileMenu')}
            data-testid="operator-hamburger"
            data-topbar-item="menu"
            onClick={() => setDrawerOpen(true)}
          >
            <span className="operator-hamburger__icon" aria-hidden>
              ☰
            </span>
          </button>
          <div className="operator-topbar__brand-mobile" data-topbar-item="logo">
            <SosMeshLogo size={32} />
          </div>
          <OperatorLiveStatus />
          <div className="operator-topbar__cluster operator-topbar__cluster--desktop">
            <IncidentSwitcher incidents={context?.incidents ?? []} />
          </div>
          <OperatorTopbarOverflow incidents={context?.incidents ?? []} />
          <div className="operator-topbar__controls">
            <LocaleSwitcher
              className="operator-topbar__locale operator-topbar__locale--desktop"
              testId="operator-topbar-locale"
            />
            <button
              type="button"
              className="ui-button ui-button--ghost operator-topbar__theme operator-topbar__theme--desktop operator-topbar__theme--icon"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={theme === 'light' ? t('web.shell.themeDark') : t('web.shell.themeLight')}
              title={theme === 'light' ? t('web.shell.themeDark') : t('web.shell.themeLight')}
              data-testid="operator-topbar-theme"
            >
              {theme === 'light' ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </button>
            <div className="operator-user-menu" data-testid="operator-topbar-user">
              <button
                ref={userMenuRef}
                type="button"
                className="ui-button ui-button--ghost operator-user-menu__trigger"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={user.displayName || user.email || t('web.shell.defaultUser')}
                data-topbar-item="user"
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
                <FixedPanel
                  triggerRef={userMenuRef}
                  className="operator-user-menu__panel"
                  role="menu"
                  align="right"
                  onClose={() => setUserMenuOpen(false)}
                >
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
                </FixedPanel>
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
