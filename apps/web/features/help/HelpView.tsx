'use client';

import { useState } from 'react';

import { Button } from '../../components/ui/Button';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

import {
  HELP_DOC_LINKS,
  HELP_I18N_KEYS,
  HELP_SECTION_IDS,
  type HelpSectionId,
} from './help-sections';

type SupportPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const SECTION_ICONS: Record<HelpSectionId, string> = {
  offline: '📡',
  permissions: '🔐',
  relay: '🔄',
  watch: '⌚',
  ack: '✓',
  failed: '⚠️',
  limits: '⚡',
  matrix: '📱',
};

export function HelpView() {
  const { t } = useOperatorPreferences();
  const [form, setForm] = useState<SupportPayload>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<HelpSectionId>>(new Set());

  const filteredSections = HELP_SECTION_IDS.filter((id) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const title = t(HELP_I18N_KEYS[id].title).toLowerCase();
    const body = t(HELP_I18N_KEYS[id].body).toLowerCase();
    return title.includes(query) || body.includes(query);
  });

  function toggleSection(id: HelpSectionId) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { message?: string };
      setFeedback(data.message ?? t('web.help.supportBlocked'));
    } catch {
      setFeedback(t('web.help.supportBlocked'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="help-view" data-testid="operator-help">
      <div className="help-view__sticky-banner" role="alert" data-testid="help-not112-banner">
        <div className="help-view__banner-content">
          <span className="help-view__banner-icon" aria-hidden>
            🚨
          </span>
          <strong>{t('web.help.not112')}</strong>
        </div>
      </div>

      <div className="help-view__hero">
        <h1 className="help-view__title">{t('web.help.title')}</h1>
        <p className="help-view__intro">{t('web.help.intro')}</p>
        <div className="help-view__search-wrap">
          <input
            type="search"
            className="help-view__search"
            placeholder={t('web.help.searchPlaceholder')}
            aria-label={t('web.help.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="help-view__content">
        <section className="help-view__topics" aria-labelledby="help-topics-heading">
          <h2 id="help-topics-heading" className="help-view__section-title">
            {t('web.help.topicsTitle')}
          </h2>
          <div className="help-view__topic-grid">
            {filteredSections.map((id) => (
              <button
                key={id}
                type="button"
                className="help-topic-card"
                onClick={() => toggleSection(id)}
                aria-expanded={expandedSections.has(id)}
                aria-controls={`help-accordion-${id}`}
                data-testid={`help-section-${id}`}
              >
                <div className="help-topic-card__icon" aria-hidden>
                  {SECTION_ICONS[id]}
                </div>
                <h3 className="help-topic-card__title">{t(HELP_I18N_KEYS[id].title)}</h3>
                <div className="help-topic-card__chevron" aria-hidden>
                  {expandedSections.has(id) ? '▼' : '▶'}
                </div>
              </button>
            ))}
          </div>

          {filteredSections.map((id) =>
            expandedSections.has(id) ? (
              <div
                key={`accordion-${id}`}
                id={`help-accordion-${id}`}
                className="help-accordion"
                role="region"
                aria-labelledby={`help-${id}-title`}
              >
                <div className="help-accordion__content">
                  <h3 id={`help-${id}-title`} className="help-accordion__title">
                    <span className="help-accordion__icon" aria-hidden>
                      {SECTION_ICONS[id]}
                    </span>
                    {t(HELP_I18N_KEYS[id].title)}
                  </h3>
                  <p className="help-accordion__body">{t(HELP_I18N_KEYS[id].body)}</p>
                </div>
              </div>
            ) : null
          )}
        </section>

        <section className="help-view__docs" aria-labelledby="help-docs-heading">
          <div className="help-card">
            <h2 id="help-docs-heading" className="help-card__title">
              {t('web.help.docLinksTitle')}
            </h2>
            <ul className="help-docs-list">
              <li>
                <a
                  href={HELP_DOC_LINKS.privacy}
                  rel="noopener noreferrer"
                  className="help-docs-link"
                >
                  <span className="help-docs-link__icon" aria-hidden>
                    📄
                  </span>
                  {t('web.help.linkPrivacy')}
                </a>
              </li>
              <li>
                <a
                  href={HELP_DOC_LINKS.terms}
                  rel="noopener noreferrer"
                  className="help-docs-link"
                >
                  <span className="help-docs-link__icon" aria-hidden>
                    📋
                  </span>
                  {t('web.help.linkTerms')}
                </a>
              </li>
              <li>
                <a
                  href={HELP_DOC_LINKS.security}
                  rel="noopener noreferrer"
                  className="help-docs-link"
                >
                  <span className="help-docs-link__icon" aria-hidden>
                    🔒
                  </span>
                  {t('web.help.linkSecurity')}
                </a>
              </li>
              <li>
                <a
                  href={HELP_DOC_LINKS.guideTr}
                  rel="noopener noreferrer"
                  className="help-docs-link"
                >
                  <span className="help-docs-link__icon" aria-hidden>
                    📖
                  </span>
                  {t('web.help.linkGuideTr')}
                </a>
              </li>
              <li>
                <a
                  href={HELP_DOC_LINKS.guideEn}
                  rel="noopener noreferrer"
                  className="help-docs-link"
                >
                  <span className="help-docs-link__icon" aria-hidden>
                    📖
                  </span>
                  {t('web.help.linkGuideEn')}
                </a>
              </li>
            </ul>
            <p className="help-card__contact-placeholder">
              {t('web.help.contactEmailPlaceholder')} ·{' '}
              {t('web.help.contactPhonePlaceholder')}
            </p>
          </div>
        </section>

        <section className="help-view__support" aria-labelledby="help-support-heading">
          <div className="help-card help-card--support">
            <h2 id="help-support-heading" className="help-card__title">
              <span className="help-card__title-icon" aria-hidden>
                💬
              </span>
              {t('web.help.supportTitle')}
            </h2>
            <p className="help-card__note">{t('web.help.supportNote')}</p>
            <form className="help-support-form" onSubmit={onSubmit}>
              <div className="help-support-form__row">
                <label className="help-support-form__label">
                  <span className="help-support-form__label-text">
                    {t('web.help.supportName')}
                  </span>
                  <input
                    name="name"
                    autoComplete="name"
                    className="help-support-form__input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>
              </div>
              <div className="help-support-form__row">
                <label className="help-support-form__label">
                  <span className="help-support-form__label-text">
                    {t('web.help.supportEmail')}
                  </span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="help-support-form__input"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </label>
              </div>
              <div className="help-support-form__row">
                <label className="help-support-form__label">
                  <span className="help-support-form__label-text">
                    {t('web.help.supportSubject')}
                  </span>
                  <input
                    name="subject"
                    className="help-support-form__input"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  />
                </label>
              </div>
              <div className="help-support-form__row">
                <label className="help-support-form__label">
                  <span className="help-support-form__label-text">
                    {t('web.help.supportMessage')}
                  </span>
                  <textarea
                    name="message"
                    rows={4}
                    className="help-support-form__textarea"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                  />
                </label>
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="help-support-form__submit"
              >
                {t('web.help.supportSubmit')}
              </Button>
            </form>
            {feedback ? (
              <p
                className="help-support-form__feedback"
                role="status"
                data-testid="help-support-feedback"
              >
                {feedback}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
