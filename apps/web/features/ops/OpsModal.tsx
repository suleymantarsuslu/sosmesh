'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { Icon, type IconName } from '../cases/detail/icons';

type Props = {
  title: string;
  icon: IconName;
  onClose: () => void;
  children: ReactNode;
};

/** Dialog shell shared by the team/resource forms (overlay, header, Escape + focus handling). */
export function OpsModal({ title, icon, onClose, children }: Props) {
  const { t } = useOperatorPreferences();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="modal-overlay ops-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="modal-content ops-modal cd2"
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ops-modal__header">
          <span className="cd2-card__icon">
            <Icon name={icon} size={16} />
          </span>
          <h2 className="ops-modal__title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="cd2-btn cd2-btn--ghost ops-modal__close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <Icon name="close" size={16} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
