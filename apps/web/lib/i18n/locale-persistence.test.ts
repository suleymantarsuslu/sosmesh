import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME } from './operator-messages';

describe('locale persistence contract', () => {
  it('uses English as the default locale constant', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('stores locale in a shared cookie name for SSR and marketing', () => {
    expect(LOCALE_COOKIE_NAME).toBe('sosmesh_locale');
  });
});
