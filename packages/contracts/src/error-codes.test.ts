import { describe, it, expect } from 'vitest';
import { getErrorMessage, ERROR_TRANSLATIONS } from './error-codes';

describe('Error Code Translations (UX/a11y)', () => {
  it('should have Turkish and English translations for all error codes', () => {
    ERROR_TRANSLATIONS.forEach(translation => {
      expect(translation.code).toBeTruthy();
      expect(translation.tr).toBeTruthy();
      expect(translation.en).toBeTruthy();
      expect(translation.tr.length).toBeGreaterThan(0);
      expect(translation.en.length).toBeGreaterThan(0);
    });
  });

  it('should return correct Turkish message', () => {
    const message = getErrorMessage('NETWORK_UNAVAILABLE', 'tr');
    expect(message).toBe('Ağ bağlantısı yok');
  });

  it('should return correct English message', () => {
    const message = getErrorMessage('NETWORK_UNAVAILABLE', 'en');
    expect(message).toBe('Network unavailable');
  });

  it('should handle unknown error codes gracefully', () => {
    const messageTr = getErrorMessage('UNKNOWN_CODE', 'tr');
    const messageEn = getErrorMessage('UNKNOWN_CODE', 'en');
    
    expect(messageTr).toBe('Bilinmeyen hata');
    expect(messageEn).toBe('Unknown error');
  });

  it('should default to Turkish locale', () => {
    const message = getErrorMessage('TIMEOUT');
    expect(message).toBe('Zaman aşımı');
  });

  it('should have all transport error codes covered', () => {
    const transportErrors = [
      'NETWORK_UNAVAILABLE',
      'TIMEOUT',
      'INVALID_PAYLOAD',
      'ENCRYPTION_FAILED',
      'RELAY_REFUSED',
      'SERVER_ERROR',
      'UNAUTHORIZED'
    ];

    transportErrors.forEach(code => {
      const translation = ERROR_TRANSLATIONS.find(t => t.code === code);
      expect(translation).toBeDefined();
      expect(translation?.tr).toBeTruthy();
      expect(translation?.en).toBeTruthy();
    });
  });
});
