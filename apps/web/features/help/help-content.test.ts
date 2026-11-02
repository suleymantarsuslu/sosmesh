import { describe, expect, it } from 'vitest';

import { translate } from '../../lib/i18n/operator-messages';

import { HELP_REQUIRED_KEYS } from './help-sections';

describe('operator help i18n', () => {
  it('defines TR and EN strings for required help keys', () => {
    for (const key of HELP_REQUIRED_KEYS) {
      const tr = translate('tr', key);
      const en = translate('en', key);
      expect(tr).not.toBe(key);
      expect(en).not.toBe(key);
    }
  });

  it('includes 112 warning in help not112 copy', () => {
    expect(translate('tr', 'web.help.not112')).toContain('112');
    expect(translate('en', 'web.help.not112')).toMatch(/112/i);
  });

  it('states peer ACK is not operator read in relay body', () => {
    const trRelay = translate('tr', 'web.help.relayBody');
    expect(trRelay.toLowerCase()).toContain('peer');
  });
});
