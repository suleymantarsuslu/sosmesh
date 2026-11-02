'use client';

import { useState } from 'react';

import { Button } from '../../components/ui/Button';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

import {
  HELP_DOC_LINKS,
  HELP_I18N_KEYS,
  HELP_SECTION_IDS,
} from './help-sections';

type SupportPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
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
    <div className="operator-help" data-testid="operator-help">
      <h1>{t('web.help.title')}</h1>
      <p className="operator-help__intro">{t('web.help.intro')}</p>

      <div className="operator-help__banner" role="alert" data-testid="help-not112-banner">
        <strong>{t('web.help.not112')}</strong>
      </div>

      <nav className="operator-help__toc" aria-label={t('web.help.sectionsNav')}>
        <ul>
          {HELP_SECTION_IDS.map((id) => (
            <li key={id}>
              <a href={`#help-${id}`}>{t(HELP_I18N_KEYS[id].title)}</a>
            </li>
          ))}
        </ul>
      </nav>

      {HELP_SECTION_IDS.map((id) => (
        <section
          key={id}
          id={`help-${id}`}
          className="operator-help__section"
          aria-labelledby={`help-${id}-title`}
        >
          <h2 id={`help-${id}-title`}>{t(HELP_I18N_KEYS[id].title)}</h2>
          <p>{t(HELP_I18N_KEYS[id].body)}</p>
        </section>
      ))}

      <section className="operator-help__links" aria-labelledby="help-doc-links">
        <h2 id="help-doc-links">{t('web.help.docLinksTitle')}</h2>
        <ul>
          <li>
            <a href={HELP_DOC_LINKS.privacy} rel="noopener noreferrer">
              {t('web.help.linkPrivacy')}
            </a>
          </li>
          <li>
            <a href={HELP_DOC_LINKS.terms} rel="noopener noreferrer">
              {t('web.help.linkTerms')}
            </a>
          </li>
          <li>
            <a href={HELP_DOC_LINKS.security} rel="noopener noreferrer">
              {t('web.help.linkSecurity')}
            </a>
          </li>
          <li>
            <a href={HELP_DOC_LINKS.guideTr} rel="noopener noreferrer">
              {t('web.help.linkGuideTr')}
            </a>
          </li>
          <li>
            <a href={HELP_DOC_LINKS.guideEn} rel="noopener noreferrer">
              {t('web.help.linkGuideEn')}
            </a>
          </li>
        </ul>
        <p className="operator-help__contact-placeholder">
          {t('web.help.contactEmailPlaceholder')} ·{' '}
          {t('web.help.contactPhonePlaceholder')}
        </p>
      </section>

      <section className="operator-help__support" aria-labelledby="help-support-title">
        <h2 id="help-support-title">{t('web.help.supportTitle')}</h2>
        <p>{t('web.help.supportNote')}</p>
        <form className="operator-help__form" onSubmit={onSubmit}>
          <label>
            {t('web.help.supportName')}
            <input
              name="name"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            {t('web.help.supportEmail')}
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            {t('web.help.supportSubject')}
            <input
              name="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </label>
          <label>
            {t('web.help.supportMessage')}
            <textarea
              name="message"
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </label>
          <Button type="submit" disabled={submitting}>
            {t('web.help.supportSubmit')}
          </Button>
        </form>
        {feedback ? (
          <p
            className="operator-help__feedback"
            role="status"
            data-testid="help-support-feedback"
          >
            {feedback}
          </p>
        ) : null}
      </section>
    </div>
  );
}
