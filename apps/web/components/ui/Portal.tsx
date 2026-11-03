'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
}

export function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = useState(false);
  const portalRoot = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalRoot.current = document.body;
    setMounted(true);
    return () => {
      portalRoot.current = null;
    };
  }, []);

  if (!mounted || !portalRoot.current) {
    return null;
  }

  return createPortal(children, portalRoot.current);
}
