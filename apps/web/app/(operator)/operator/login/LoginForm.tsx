'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { Button } from '../../../../components/ui/Button';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      setError('Geçersiz e-posta veya şifre');
      return;
    }
    const next = searchParams.get('next') ?? '/operator/dashboard';
    router.push(next);
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={onSubmit} data-testid="login-form">
      <label htmlFor="email">E-posta</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label htmlFor="password">Şifre</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error ? (
        <p className="login-form__error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading}>
        {loading ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </Button>
    </form>
  );
}
