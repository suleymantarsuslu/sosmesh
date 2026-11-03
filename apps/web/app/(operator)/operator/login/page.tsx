'use client';

import { Suspense } from 'react';

import { SosMeshLogo } from '../../../../components/brand/SosMeshLogo';
import { useOperatorPreferences } from '../../../../components/operator/OperatorPreferencesProvider';

import { LoginForm } from './LoginForm';

function LoginPageContent() {
  const { t } = useOperatorPreferences();

  return (
    <main className="login-page">
      <div className="login-page__brand">
        <SosMeshLogo size={72} priority />
      </div>
      <h1>{t('web.login.title')}</h1>
      <p className="login-page__hint">{t('web.login.not112')}</p>
      <Suspense fallback={<p>{t('states.loading')}</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

export default function OperatorLoginPage() {
  return <LoginPageContent />;
}
