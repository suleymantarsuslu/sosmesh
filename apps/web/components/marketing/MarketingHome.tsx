'use client';

import Link from 'next/link';

import { SosMeshLogo } from '../brand/SosMeshLogo';
import { LocaleSwitcher } from '../i18n/LocaleSwitcher';
import { useOperatorPreferences } from '../operator/OperatorPreferencesProvider';

export function MarketingHome() {
  const { t } = useOperatorPreferences();

  return (
    <main className="container marketing-home" data-testid="marketing-home">
      <header className="marketing-home__nav" data-testid="marketing-nav">
        <SosMeshLogo size={40} priority />
        <div className="marketing-home__nav-actions">
          <LocaleSwitcher className="marketing-home__locale" />
          <Link
            className="ui-button ui-button--primary marketing-home__nav-login"
            href="/operator/login"
            data-testid="marketing-nav-operator-login"
          >
            {t('web.marketing.operatorNavLogin')}
          </Link>
        </div>
      </header>
      <section className="marketing-home__hero">
        <header className="marketing-home__header">
          <SosMeshLogo size={72} priority />
          <div className="marketing-home__titles">
            <h1>{t('web.shell.brand')}</h1>
            <p className="marketing-home__tagline">{t('web.marketing.tagline')}</p>
          </div>
        </header>
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
          <Link className="ui-button ui-button--ghost" href="/operator/login?next=%2Foperator%2Fhelp">
            {t('web.marketing.help')}
          </Link>
        </div>
      </section>
    </main>
  );
}
