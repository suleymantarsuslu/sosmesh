'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { Button } from '../ui/Button';

import { CommandPalette } from './CommandPalette';

type NavItem = { href: string; label: string; roles?: string[] };

const NAV: NavItem[] = [
  { href: '/operator/dashboard', label: 'Panel' },
  { href: '/operator/cases', label: 'Harita / Vakalar' },
  { href: '/operator/admin', label: 'Yönetim', roles: ['ADMIN'] },
];

export function OperatorShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { displayName: string; role: string; email?: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const items = useMemo(
    () =>
      NAV.filter((item) => !item.roles || item.roles.includes(user.role)),
    [user.role]
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
        Ana içeriğe geç
      </a>
      <aside className="operator-sidebar" aria-label="Operatör menüsü">
        <div className="operator-brand">SOSMesh</div>
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
        <div className="operator-user">
          <p>{user.displayName || user.email || 'Operatör'}</p>
          <p className="operator-user__role">{user.role}</p>
          <Button variant="ghost" onClick={logout}>
            Çıkış
          </Button>
        </div>
      </aside>
      <div className="operator-main-wrap">
        <header className="operator-topbar">
          <Button variant="ghost" onClick={() => setPaletteOpen(true)}>
            Komut ara (Ctrl+K)
          </Button>
        </header>
        <main id="operator-main" className="operator-main">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={items} />
    </div>
  );
}
