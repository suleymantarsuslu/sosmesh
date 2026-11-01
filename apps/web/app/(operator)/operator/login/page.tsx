import { Suspense } from 'react';

import { LoginForm } from './LoginForm';

export default function OperatorLoginPage() {
  return (
    <main className="login-page">
      <h1>Operatör girişi</h1>
      <p className="login-page__hint">
        SOSMesh, 112 resmî acil çağrı hizmetinin yerine geçmez.
      </p>
      <Suspense fallback={<p>Yükleniyor…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
