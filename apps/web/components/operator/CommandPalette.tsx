'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '../ui/Button';

type Item = { href: string; label: string };

export function CommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: Item[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="ui-palette-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ui-palette"
        role="dialog"
        aria-label="Komut paleti"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          className="ui-palette__input"
          placeholder="Sayfa ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul>
          {filtered.map((item) => (
            <li key={item.href}>
              <Button
                variant="ghost"
                onClick={() => {
                  router.push(item.href);
                  onClose();
                }}
              >
                {item.label}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
