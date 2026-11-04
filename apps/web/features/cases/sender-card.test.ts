import { describe, expect, it } from 'vitest';

import { translate } from '../../lib/i18n/operator-messages';

import { interpolate } from './detail/format';

const KEYS = [
  'profileTitle', 'profileHint', 'profileEmpty', 'fullName', 'age', 'phone', 'email', 'address', 'floor',
  'householdSize', 'assumptionTitle', 'assumptionText', 'assumptionUnknown', 'assumptionHint', 'mergedTitle',
  'mergedCount', 'mergedEmpty', 'mergedHasNote', 'mergedHasLocation',
];

describe('mesh v2 sender card i18n', () => {
  it.each(['tr', 'en'] as const)('has every sender key in %s', (locale) => {
    for (const key of KEYS) {
      expect(translate(locale, `web.cases.sender.${key}`)).not.toBe(`web.cases.sender.${key}`);
    }
  });

  it('labels the address inference as an assumption in both languages', () => {
    expect(translate('tr', 'web.cases.sender.assumptionTitle')).toBe('Varsayım');
    expect(translate('en', 'web.cases.sender.assumptionTitle')).toBe('Assumption');
    expect(interpolate(translate('en', 'web.cases.sender.assumptionText'), { floor: 3, people: 4 })).toBe(
      'Possibly at home address, floor 3, 4 people'
    );
    expect(interpolate(translate('tr', 'web.cases.sender.assumptionText'), { floor: 3, people: 4 })).toBe(
      'Muhtemelen ev adresinde, 3. kat, 4 kişi'
    );
  });
});
