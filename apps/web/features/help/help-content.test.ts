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

  it('states delivery stages do not guarantee help or operator response', () => {
    const trAck = translate('tr', 'web.help.ackBody');
    const enAck = translate('en', 'web.help.ackBody');
    expect(trAck.toLowerCase()).toContain('peer');
    expect(trAck.toLowerCase()).toMatch(/garanti|yardım/);
    expect(enAck.toLowerCase()).toContain('peer');
    expect(enAck.toLowerCase()).toMatch(/guarantee|help/);
  });

  it('states relay carries ciphertext only and peer ACK is not operator read', () => {
    const trRelay = translate('tr', 'web.help.relayBody');
    const enRelay = translate('en', 'web.help.relayBody');
    expect(trRelay.toLowerCase()).toContain('şifre');
    expect(trRelay.toLowerCase()).toContain('düz metn');
    expect(trRelay.toLowerCase()).toContain('peer ack');
    expect(trRelay.toLowerCase()).toContain('operatör');
    expect(trRelay.toLowerCase()).toContain('sunucu');
    expect(enRelay.toLowerCase()).toContain('encrypt');
    expect(enRelay.toLowerCase()).toContain('plaintext');
    expect(enRelay.toLowerCase()).toContain('peer ack');
    expect(enRelay.toLowerCase()).toContain('operator');
    expect(enRelay.toLowerCase()).toContain('server');
  });

  it('offline help states BLE works without AI', () => {
    expect(translate('tr', 'web.help.offlineBody').toLowerCase()).toMatch(/ai/);
    expect(translate('en', 'web.help.offlineBody').toLowerCase()).toMatch(
      /without ai|no ai/
    );
  });

  it('uses DESTEK placeholders for support contact copy', () => {
    expect(translate('tr', 'web.help.contactEmailPlaceholder')).toBe(
      'DESTEK_EPOSTA_TBD'
    );
    expect(translate('en', 'web.help.contactEmailPlaceholder')).toBe(
      'DESTEK_EPOSTA_TBD'
    );
    expect(translate('tr', 'web.help.supportNote')).toContain(
      'DESTEK_ILETISIM_TBD'
    );
    expect(translate('en', 'web.help.supportNote')).toContain(
      'DESTEK_ILETISIM_TBD'
    );
  });

  it('ack help names five delivery stages', () => {
    const trAck = translate('tr', 'web.help.ackBody');
    const enAck = translate('en', 'web.help.ackBody');
    expect(trAck).toContain('cihaz');
    expect(trAck).toContain('peer');
    expect(trAck).toContain('sunucu');
    expect(trAck).toContain('operatör');
    expect(enAck.toLowerCase()).toContain('device');
    expect(enAck.toLowerCase()).toContain('peer');
    expect(enAck.toLowerCase()).toContain('server');
    expect(enAck.toLowerCase()).toContain('operator');
  });
});
