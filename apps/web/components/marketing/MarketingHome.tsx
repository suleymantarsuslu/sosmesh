'use client';

import Link from 'next/link';
import { useState } from 'react';

import { SosMeshLogo } from '../brand/SosMeshLogo';
import { LocaleSwitcher } from '../i18n/LocaleSwitcher';
import { useOperatorPreferences } from '../operator/OperatorPreferencesProvider';

const NAV_SECTIONS = [
  { href: '#how-it-works', key: 'web.marketing.navHowItWorks' },
  { href: '#features', key: 'web.marketing.navFeatures' },
  { href: '#platforms', key: 'web.marketing.navPlatforms' },
  { href: '#security', key: 'web.marketing.navSecurity' },
  { href: '#limitations', key: 'web.marketing.navLimitations' },
  { href: '#faq', key: 'web.marketing.navFaq' },
] as const;

const FEATURES = [
  { titleKey: 'web.marketing.featureOfflineTitle', bodyKey: 'web.marketing.featureOfflineBody' },
  { titleKey: 'web.marketing.featureCryptoTitle', bodyKey: 'web.marketing.featureCryptoBody' },
  { titleKey: 'web.marketing.featureStatesTitle', bodyKey: 'web.marketing.featureStatesBody' },
  { titleKey: 'web.marketing.featureWatchTitle', bodyKey: 'web.marketing.featureWatchBody' },
  { titleKey: 'web.marketing.featurePanelTitle', bodyKey: 'web.marketing.featurePanelBody' },
] as const;

const FAQ = [
  { q: 'web.marketing.faq1Q', a: 'web.marketing.faq1A' },
  { q: 'web.marketing.faq2Q', a: 'web.marketing.faq2A' },
  { q: 'web.marketing.faq3Q', a: 'web.marketing.faq3A' },
  { q: 'web.marketing.faq4Q', a: 'web.marketing.faq4A' },
  { q: 'web.marketing.faq5Q', a: 'web.marketing.faq5A' },
] as const;

export function MarketingHome() {
  const { t } = useOperatorPreferences();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="marketing-page" data-testid="marketing-home">
      <header className="marketing-nav" data-testid="marketing-nav">
        <div className="marketing-nav__brand">
          <SosMeshLogo size={40} priority />
          <strong>{t('web.shell.brand')}</strong>
        </div>
        <button
          type="button"
          className="ui-button ui-button--ghost marketing-nav__toggle"
          aria-expanded={menuOpen}
          aria-controls="marketing-nav-links"
          onClick={() => setMenuOpen((open) => !open)}
          data-testid="marketing-nav-toggle"
        >
          {menuOpen ? t('web.marketing.menuClose') : t('web.marketing.menuOpen')}
        </button>
        <nav
          id="marketing-nav-links"
          className={
            menuOpen
              ? 'marketing-nav__links marketing-nav__links--open'
              : 'marketing-nav__links'
          }
          aria-label={t('web.marketing.navFeatures')}
        >
          {NAV_SECTIONS.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {t(item.key)}
            </a>
          ))}
        </nav>
        <div className="marketing-nav__actions">
          <LocaleSwitcher className="marketing-home__locale" />
          <Link
            className="ui-button ui-button--primary marketing-home__nav-login"
            href="/operator/login"
            data-testid="marketing-nav-operator-login"
          >
            {t('web.marketing.operatorLoginCta')}
          </Link>
        </div>
      </header>

      <section className="marketing-section marketing-hero" id="hero" data-testid="marketing-hero">
        <div className="marketing-hero__grid">
          <SosMeshLogo size={96} priority />
          <div>
            <h1 className="marketing-hero__title">{t('web.marketing.heroTitle')}</h1>
            <p className="marketing-hero__lead">{t('web.marketing.heroLead')}</p>
            <div
              className="warning-banner marketing-home__not112"
              role="note"
              data-testid="marketing-not112-banner"
            >
              <p>
                <strong>{t('web.marketing.not112Important')}</strong>{' '}
                {t('web.marketing.not112Body')}
              </p>
            </div>
            <div className="marketing-home__actions">
              <Link
                className="ui-button ui-button--primary"
                href="/operator/login"
                data-testid="marketing-operator-login"
              >
                {t('web.marketing.operatorLoginCta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        className="marketing-section"
        id="how-it-works"
        data-testid="marketing-how-it-works"
      >
        <h2 className="marketing-section__title">{t('web.marketing.howTitle')}</h2>
        <p>{t('web.marketing.howIntro')}</p>
        <ol className="marketing-steps">
          {[1, 2, 3, 4].map((step) => (
            <li key={step} className="marketing-step">
              <h3>{t(`web.marketing.howStep${step}Title` as 'web.marketing.howStep1Title')}</h3>
              <p>{t(`web.marketing.howStep${step}Body` as 'web.marketing.howStep1Body')}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="marketing-section" id="features" data-testid="marketing-features">
        <h2 className="marketing-section__title">{t('web.marketing.featuresTitle')}</h2>
        <div className="marketing-cards">
          {FEATURES.map((feature) => (
            <article key={feature.titleKey} className="marketing-card">
              <h3>{t(feature.titleKey)}</h3>
              <p>{t(feature.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section" id="platforms" data-testid="marketing-platforms">
        <h2 className="marketing-section__title">{t('web.marketing.platformsTitle')}</h2>
        <ul className="marketing-platforms">
          <li>{t('web.marketing.platformAndroid')}</li>
          <li>{t('web.marketing.platformWear')}</li>
          <li>{t('web.marketing.platformIos')}</li>
          <li>{t('web.marketing.platformWatchOs')}</li>
          <li>{t('web.marketing.platformWeb')}</li>
        </ul>
      </section>

      <section className="marketing-section" id="security" data-testid="marketing-security">
        <h2 className="marketing-section__title">{t('web.marketing.securityTitle')}</h2>
        <p>{t('web.marketing.securityBody1')}</p>
        <p>{t('web.marketing.securityBody2')}</p>
        <p>{t('web.marketing.securityBody3')}</p>
      </section>

      <section className="marketing-section" id="limitations" data-testid="marketing-limitations">
        <h2 className="marketing-section__title">{t('web.marketing.limitsTitle')}</h2>
        <ul className="marketing-limits">
          <li>{t('web.marketing.limit112')}</li>
          <li>{t('web.marketing.limitApple')}</li>
          <li>{t('web.marketing.limitWatch')}</li>
          <li>{t('web.marketing.limitBle')}</li>
          <li>{t('web.marketing.limitAi')}</li>
          <li>{t('web.marketing.limitPrototype')}</li>
        </ul>
      </section>

      <section className="marketing-section marketing-faq" id="faq" data-testid="marketing-faq">
        <h2 className="marketing-section__title">{t('web.marketing.faqTitle')}</h2>
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>{t(item.q)}</summary>
            <p>{t(item.a)}</p>
          </details>
        ))}
      </section>

      <footer className="marketing-footer" data-testid="marketing-footer">
        <p>
          <strong>{t('web.marketing.not112Important')}</strong> {t('web.marketing.footerNot112')}
        </p>
        <p>{t('web.marketing.footerNote')}</p>
      </footer>
    </div>
  );
}
