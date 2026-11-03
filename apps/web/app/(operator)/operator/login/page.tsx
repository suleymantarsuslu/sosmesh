'use client';

import { Suspense } from 'react';

import { SosMeshLogo } from '../../../../components/brand/SosMeshLogo';
import { useOperatorPreferences } from '../../../../components/operator/OperatorPreferencesProvider';

import { LoginForm } from './LoginForm';

function LoginPageContent() {
  const { t } = useOperatorPreferences();

  return (
    <main className="login-shell" data-testid="operator-login-page">
      <aside className="login-shell__visual" aria-hidden="false">
        <SosMeshLogo size={88} priority />
        <h1>{t('web.shell.brand')}</h1>
        <p className="login-shell__tagline">{t('web.marketing.tagline')}</p>
        <div className="warning-banner login-shell__not112" role="note">
          <p>{t('web.login.not112')}</p>
        </div>
      </aside>
      <section className="login-shell__panel">
        <h2>{t('web.login.title')}</h2>
        <Suspense fallback={<p>{t('states.loading')}</p>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}

export default function OperatorLoginPage() {
  return <LoginPageContent />;
}
