'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { useOperatorPreferences } from '../../../../components/operator/OperatorPreferencesProvider';
import { Button } from '../../../../components/ui/Button';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useOperatorPreferences();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(t('web.login.errorInvalid'));
      return;
    }
    const next = searchParams.get('next') ?? '/operator/dashboard';
    router.push(next);
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={onSubmit} data-testid="login-form">
      <label htmlFor="email">{t('web.login.email')}</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        data-testid="login-email"
      />
      <label htmlFor="password">{t('web.login.password')}</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        data-testid="login-password"
      />
      {error ? (
        <p className="login-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} data-testid="login-submit">
        {loading ? t('web.login.submitting') : t('web.login.submit')}
      </Button>
    </form>
  );
}
