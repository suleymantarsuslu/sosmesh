import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  translate,
  type OperatorLocale,
} from './operator-messages';

describe('app locale (EN default, TR selectable)', () => {
  it('defaults to English', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('returns English login labels by default locale', () => {
    expect(translate('en', 'web.login.email')).toBe('Email');
    expect(translate('en', 'web.login.submit')).toBe('Sign in');
    expect(translate('en', 'web.marketing.operatorLoginCta')).toBe(
      'Sign in to operator panel'
    );
  });

  it('returns Turkish labels when locale is tr', () => {
    expect(translate('tr', 'web.login.email')).toBe('E-posta');
    expect(translate('tr', 'web.login.submit')).toBe('Giriş yap');
    expect(translate('tr', 'web.marketing.operatorLoginCta')).toBe(
      'Operatör paneline giriş'
    );
  });

  it('keeps 112 disclaimer meaning in both locales', () => {
    for (const locale of ['en', 'tr'] as OperatorLocale[]) {
      const text = translate(locale, 'web.marketing.not112Body');
      expect(text).toMatch(/112/);
      expect(text.toLowerCase()).toMatch(/experimental|deneysel/);
    }
  });
});
