'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { Portal } from './Portal';

interface FixedPanelProps {
  children: ReactNode;
  triggerRef: React.RefObject<HTMLElement>;
  align?: 'left' | 'right';
  className?: string;
  role?: string;
  zIndex?: number;
  onClose?: () => void;
}

export function FixedPanel({
  children,
  triggerRef,
  align = 'right',
  className = '',
  role,
  zIndex = 1000,
  onClose,
}: FixedPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, right: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const top = triggerRect.bottom + 4;

    if (align === 'right') {
      const right = window.innerWidth - triggerRect.right;
      setPosition({ top, left: 0, right });
    } else {
      const left = triggerRect.left;
      setPosition({ top, left, right: 0 });
    }
  }, [triggerRef, align]);

  useEffect(() => {
    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    if (!onClose) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, triggerRef]);

  return (
    <Portal>
      <div
        ref={panelRef}
        className={className}
        role={role}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: align === 'left' ? `${position.left}px` : 'auto',
          right: align === 'right' ? `${position.right}px` : 'auto',
          zIndex,
        }}
      >
        {children}
      </div>
    </Portal>
  );
}
