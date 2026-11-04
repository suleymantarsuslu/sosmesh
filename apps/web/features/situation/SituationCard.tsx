'use client';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { RegionalCluster } from './types';

type Props = {
  cluster: RegionalCluster;
};

export function SituationCard({ cluster }: Props) {
  const { t, locale } = useOperatorPreferences();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  const severityClass = `situation-card__badge--severity-${cluster.severity.toLowerCase()}`;
  const urgencyClass = `situation-card__badge--urgency-${cluster.urgency.toLowerCase()}`;

  const hazardLabel =
    t(`web.dashboard.regionalSituation.hazardTypes.${cluster.hazardType}`) || cluster.hazardType;

  const severityLabel = t(`web.dashboard.regionalSituation.severity.${cluster.severity}`);
  const urgencyLabel = t(`web.dashboard.regionalSituation.urgency.${cluster.urgency}`);

  const firstReport = new Date(cluster.firstReportAt).toLocaleString(dateLocale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const lastReport = new Date(cluster.lastReportAt).toLocaleString(dateLocale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article className="situation-card" data-testid="situation-card">
      <header className="situation-card__header">
        <h3 className="situation-card__title">
          {cluster.region}: {hazardLabel}
        </h3>
        <div className="situation-card__badges">
          <span className={`situation-card__badge ${severityClass}`} data-testid="severity-badge">
            {t('web.dashboard.regionalSituation.severity.label')}: {severityLabel}
          </span>
          <span className={`situation-card__badge ${urgencyClass}`} data-testid="urgency-badge">
            {t('web.dashboard.regionalSituation.urgency.label')}: {urgencyLabel}
          </span>
        </div>
      </header>

      <div className="situation-card__body">
        <div className="situation-card__stats">
          <div className="situation-card__stat">
            <span className="situation-card__stat-value">{cluster.incidentCount}</span>
            <span className="situation-card__stat-label">
              {t('web.dashboard.regionalSituation.card.sosCount', {
                count: cluster.incidentCount,
              })}
            </span>
          </div>
          <div className="situation-card__stat">
            <span className="situation-card__stat-value">{cluster.estimatedPeopleAffected}</span>
            <span className="situation-card__stat-label">
              {t('web.dashboard.regionalSituation.card.peopleAffected', {
                count: cluster.estimatedPeopleAffected,
              })}
            </span>
          </div>
        </div>

        <div className="situation-card__time">
          <p>
            {t('web.dashboard.regionalSituation.card.timeSpan', {
              first: firstReport,
              last: lastReport,
            })}
          </p>
        </div>

        {(cluster.topNeeds.length > 0 || cluster.topHazards.length > 0) && (
          <div className="situation-card__lists">
            {cluster.topNeeds.length > 0 && (
              <div className="situation-card__list">
                <strong>{t('web.dashboard.regionalSituation.card.topNeeds')}:</strong>
                <ul>
                  {cluster.topNeeds.map((need, idx) => (
                    <li key={idx}>{need}</li>
                  ))}
                </ul>
              </div>
            )}
            {cluster.topHazards.length > 0 && (
              <div className="situation-card__list">
                <strong>{t('web.dashboard.regionalSituation.card.topHazards')}:</strong>
                <ul>
                  {cluster.topHazards.map((hazard, idx) => (
                    <li key={idx}>{hazard}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {cluster.aiSummary && (
          <div className="situation-card__ai-summary" data-testid="ai-summary">
            <div className="situation-card__ai-header">
              <strong>{t('web.dashboard.regionalSituation.card.aiSummary')}</strong>
              <span className="situation-card__ai-disclaimer">
                {t('web.dashboard.regionalSituation.card.aiSummaryDisclaimer')}
              </span>
            </div>
            {cluster.aiSummary.status === 'ready' && cluster.aiSummary.text && (
              <p className="situation-card__ai-text">{cluster.aiSummary.text}</p>
            )}
            {cluster.aiSummary.status === 'computing' && (
              <p className="situation-card__ai-loading">
                {t('web.dashboard.regionalSituation.card.aiSummaryComputing')}
              </p>
            )}
            {cluster.aiSummary.status === 'failed' && (
              <p className="situation-card__ai-error">
                {t('web.dashboard.regionalSituation.card.aiSummaryFailed')}
              </p>
            )}
          </div>
        )}

        <div className="situation-card__incidents">
          <ul className="situation-card__incident-list">
            {cluster.incidents.slice(0, 5).map((incident) => (
              <li key={incident.id}>
                <a
                  href={`/operator/cases/${incident.id}`}
                  className="situation-card__incident-link"
                  data-testid="incident-link"
                >
                  {incident.shortId} — {incident.sosType}
                  {incident.personCount && ` (${incident.personCount})`}
                </a>
              </li>
            ))}
          </ul>
          {cluster.incidents.length > 5 && (
            <p className="situation-card__more">
              +{cluster.incidents.length - 5} {t('common.more')}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
