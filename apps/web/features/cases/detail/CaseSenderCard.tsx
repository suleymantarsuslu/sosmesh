'use client';

import { useOperatorPreferences } from '../../../components/operator/OperatorPreferencesProvider';
import type { CaseSenderView, SenderProfile } from '../types';

import { CaseSection } from './CaseSection';
import { interpolate } from './format';

function formatAddress(address: SenderProfile['address']): string | null {
  if (!address) return null;
  const parts = [address.line, address.district, address.city, address.postalCode, address.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

/** Mesh v2: assumption + profile + merged-message thread. Renders nothing for v1 incidents. */
export function CaseSenderCard({ sender }: { sender: CaseSenderView | null | undefined }) {
  const { t, locale } = useOperatorPreferences();
  if (!sender) return null;
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const profile = sender.profile;
  const unknown = t('web.cases.sender.assumptionUnknown');
  const rows: { key: string; label: string; value: string | null }[] = profile
    ? [
        { key: 'fullName', label: t('web.cases.sender.fullName'), value: profile.fullName ?? null },
        { key: 'age', label: t('web.cases.sender.age'), value: profile.age?.toString() ?? null },
        { key: 'phone', label: t('web.cases.sender.phone'), value: profile.phone ?? null },
        { key: 'email', label: t('web.cases.sender.email'), value: profile.email ?? null },
        { key: 'address', label: t('web.cases.sender.address'), value: formatAddress(profile.address) },
        { key: 'floor', label: t('web.cases.sender.floor'), value: profile.floor?.toString() ?? null },
        { key: 'householdSize', label: t('web.cases.sender.householdSize'), value: profile.householdSize?.toString() ?? null },
      ].filter((r) => r.value !== null)
    : [];

  return (
    <>
      {sender.assumption && (
        <CaseSection title={t('web.cases.sender.assumptionTitle')} icon="alert" testId="case-sender-assumption">
          <p className="cd2-prose">
            <span className="cd2-pill cd2-pill--warn">{t('web.cases.sender.assumptionTitle')}</span>{' '}
            {interpolate(t('web.cases.sender.assumptionText'), {
              floor: sender.assumption.floor ?? unknown,
              people: sender.assumption.personCount ?? unknown,
            })}
          </p>
          <p className="cd2-muted">
            {interpolate(t('web.cases.sender.assumptionHint'), { meters: sender.assumption.distanceMeters })}
          </p>
        </CaseSection>
      )}

      <CaseSection title={t('web.cases.sender.profileTitle')} icon="user" testId="case-sender-profile">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div className="cd2-field-row" key={row.key} data-testid={`case-sender-${row.key}`}>
              <span className="cd2-label">{row.label}</span>
              <span className="cd2-value">{row.value}</span>
            </div>
          ))
        ) : (
          <p className="cd2-empty">{t('web.cases.sender.profileEmpty')}</p>
        )}
        <p className="cd2-muted">{t('web.cases.sender.profileHint')}</p>
      </CaseSection>

      <CaseSection title={t('web.cases.sender.mergedTitle')} icon="list" testId="case-sender-merged">
        <p className="cd2-value" data-testid="case-sender-merged-count">
          {interpolate(t('web.cases.sender.mergedCount'), { count: sender.mergedMessageCount })}
        </p>
        <ul className="cd2-list">
          {sender.mergedMessages.map((m) => {
            const flags = [
              m.hasNote ? t('web.cases.sender.mergedHasNote') : null,
              m.hasLocation ? t('web.cases.sender.mergedHasLocation') : null,
            ].filter(Boolean);
            return (
              <li key={m.messageId} className="cd2-muted">
                {new Date(m.receivedAt).toLocaleString(dateLocale)} ·{' '}
                {flags.length > 0 ? flags.join(', ') : t('web.cases.sender.mergedEmpty')}
              </li>
            );
          })}
        </ul>
      </CaseSection>
    </>
  );
}
