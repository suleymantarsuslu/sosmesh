'use client';

import { useEffect, useState } from 'react';


export type IncidentOption = { id: string; state: string };

export type OrganizationContext = {
  organization: { id: string; name: string; slug: string } | null;
  team: { id: string; name: string; zoneCode: string | null } | null;
  role: string;
  incidents: IncidentOption[];
};

export function useOrganizationContext() {
  const [context, setContext] = useState<OrganizationContext | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch('/api/operator/organization', { cache: 'no-store' });
      if (!res.ok) {
        if (!cancelled) {
          setError(true);
        }
        return;
      }
      const body = (await res.json()) as OrganizationContext;
      if (!cancelled) {
        setContext(body);
        setError(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { context, error };
}
