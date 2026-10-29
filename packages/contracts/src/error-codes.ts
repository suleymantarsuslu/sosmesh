export interface ErrorTranslation {
  code: string;
  tr: string;
  en: string;
}

export const ERROR_TRANSLATIONS: ErrorTranslation[] = [
  {
    code: 'NETWORK_UNAVAILABLE',
    tr: 'Ağ bağlantısı yok',
    en: 'Network unavailable'
  },
  {
    code: 'TIMEOUT',
    tr: 'Zaman aşımı',
    en: 'Connection timeout'
  },
  {
    code: 'INVALID_PAYLOAD',
    tr: 'Geçersiz mesaj formatı',
    en: 'Invalid message format'
  },
  {
    code: 'ENCRYPTION_FAILED',
    tr: 'Şifreleme hatası',
    en: 'Encryption failed'
  },
  {
    code: 'RELAY_REFUSED',
    tr: 'Röle iletimi reddedildi',
    en: 'Relay refused forwarding'
  },
  {
    code: 'SERVER_ERROR',
    tr: 'Sunucu hatası',
    en: 'Server error'
  },
  {
    code: 'UNAUTHORIZED',
    tr: 'Yetkilendirme hatası',
    en: 'Unauthorized access'
  }
];

export function getErrorMessage(code: string, locale: 'tr' | 'en' = 'tr'): string {
  const translation = ERROR_TRANSLATIONS.find(t => t.code === code);
  if (!translation) {
    return locale === 'tr' ? 'Bilinmeyen hata' : 'Unknown error';
  }
  return translation[locale];
}
