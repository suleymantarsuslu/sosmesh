import { describe, expect, it } from 'vitest';

import { translate } from './i18n/operator-messages';

describe('marketing landing copy', () => {
  it('includes core section keys in English and Turkish', () => {
    expect(translate('en', 'web.marketing.heroTitle')).toMatch(/mesh/i);
    expect(translate('tr', 'web.marketing.heroTitle')).toMatch(/mesh/i);
    expect(translate('en', 'web.marketing.faq1Q')).toContain('112');
    expect(translate('tr', 'web.marketing.faq1Q')).toContain('112');
  });
});
