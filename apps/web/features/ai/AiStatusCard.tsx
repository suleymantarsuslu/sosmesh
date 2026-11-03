'use client';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { AiStatusView, CircuitState } from './types';

type Props = {
  status: AiStatusView;
};

export function AiStatusCard({ status }: Props) {
  const { t, locale } = useOperatorPreferences();

  const circuitStateMap: Record<CircuitState, string> = {
    closed: t('web.ai.circuitClosed'),
    open: t('web.ai.circuitOpen'),
    'half-open': t('web.ai.circuitHalfOpen'),
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <section
      className="ai-card ai-status-card"
      aria-labelledby="ai-status-title"
      data-testid="ai-status-card"
    >
      <header className="ai-card__header">
        <h2 id="ai-status-title">{t('web.ai.statusCard')}</h2>
        <span
          className={`ai-status-indicator ${status.enabled ? 'ai-status-indicator--enabled' : 'ai-status-indicator--disabled'}`}
          data-testid="ai-status-indicator"
        >
          {status.enabled ? t('web.ai.statusEnabled') : t('web.ai.statusDisabled')}
        </span>
      </header>

      <div className="ai-card__body">
        <dl className="ai-status-grid">
          <div>
            <dt>{t('web.ai.circuitState')}</dt>
            <dd
              className={`circuit-state circuit-state--${status.circuitState}`}
              data-testid="ai-circuit-state"
            >
              {circuitStateMap[status.circuitState]}
            </dd>
          </div>

          <div>
            <dt>{t('web.ai.budgetUsedToday')}</dt>
            <dd data-testid="ai-budget-used">
              {formatCurrency(status.budgetUsedToday)} / {formatCurrency(status.budgetDailyLimit)}
            </dd>
          </div>

          <div>
            <dt>{t('web.ai.budgetTotal')}</dt>
            <dd data-testid="ai-budget-total">
              {formatCurrency(status.budgetUsedToday)} / {formatCurrency(status.budgetTotalLimit)}
            </dd>
          </div>

          <div>
            <dt>{t('web.ai.queueDepth')}</dt>
            <dd data-testid="ai-queue-depth">{status.queueDepth}</dd>
          </div>

          {status.lastAnalysisAt && (
            <div>
              <dt>{t('web.ai.lastAnalysis')}</dt>
              <dd data-testid="ai-last-analysis">
                {new Date(status.lastAnalysisAt).toLocaleString(
                  locale === 'tr' ? 'tr-TR' : 'en-GB'
                )}
              </dd>
            </div>
          )}
        </dl>

        <div className="ai-models">
          <strong>{t('web.ai.modelsAvailable')}</strong>
          <ul className="ai-models-list" data-testid="ai-models-list">
            <li
              className={status.modelsAvailable.spark ? 'ai-model-available' : 'ai-model-unavailable'}
            >
              {t('web.ai.modelSpark')} {status.modelsAvailable.spark ? '✓' : '✗'}
            </li>
            <li
              className={status.modelsAvailable.asr ? 'ai-model-available' : 'ai-model-unavailable'}
            >
              {t('web.ai.modelAsr')} {status.modelsAvailable.asr ? '✓' : '✗'}
            </li>
            <li
              className={status.modelsAvailable.sam ? 'ai-model-available' : 'ai-model-unavailable'}
            >
              {t('web.ai.modelSam')} {status.modelsAvailable.sam ? '✓' : '✗'}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
