'use client';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

type AiStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'requires_review' | 'unavailable';

type Props = {
  status: AiStatus;
  className?: string;
};

export function AiStatusBadge({ status, className = '' }: Props) {
  const { t } = useOperatorPreferences();

  const statusMap: Record<AiStatus, string> = {
    pending: t('web.ai.pending'),
    processing: t('web.ai.processing'),
    completed: '',
    failed: t('web.ai.failed'),
    requires_review: t('web.ai.requiresReview'),
    unavailable: t('web.ai.unavailable'),
  };

  const statusText = statusMap[status];
  if (!statusText) return null;

  return (
    <span
      className={`ai-status-badge ai-status-badge--${status} ${className}`}
      data-status={status}
      data-testid="ai-status-badge"
    >
      {statusText}
    </span>
  );
}
