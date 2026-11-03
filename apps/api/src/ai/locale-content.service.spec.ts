/**
 * LocaleContentService tests
 * Ensures locale-aware content extraction works correctly
 */

import { LocaleContentService } from './locale-content.service';

describe('LocaleContentService', () => {
  let service: LocaleContentService;

  beforeEach(() => {
    service = new LocaleContentService();
  });

  describe('extractText', () => {
    it('returns fallback when content is null or undefined', () => {
      expect(service.extractText(null, 'en', 'fallback')).toBe('fallback');
      expect(service.extractText(undefined, 'en', 'fallback')).toBe('fallback');
    });

    it('extracts locale-specific text from object', () => {
      const content = { tr: 'Merhaba', en: 'Hello' };
      expect(service.extractText(content, 'tr')).toBe('Merhaba');
      expect(service.extractText(content, 'en')).toBe('Hello');
    });

    it('falls back to en when requested locale missing', () => {
      const content = { en: 'Hello' };
      expect(service.extractText(content, 'tr')).toBe('Hello');
    });

    it('falls back to tr when en missing', () => {
      const content = { tr: 'Merhaba' };
      expect(service.extractText(content, 'en')).toBe('Merhaba');
    });

    it('parses JSON string content', () => {
      const content = '{"tr": "Merhaba", "en": "Hello"}';
      expect(service.extractText(content, 'tr')).toBe('Merhaba');
      expect(service.extractText(content, 'en')).toBe('Hello');
    });

    it('returns plain string as-is', () => {
      expect(service.extractText('Plain text', 'en')).toBe('Plain text');
    });

    it('handles malformed JSON', () => {
      const content = 'not valid JSON {';
      expect(service.extractText(content, 'en')).toBe(content);
    });
  });

  describe('parseAcceptLanguage', () => {
    it('returns tr as default', () => {
      expect(service.parseAcceptLanguage(undefined)).toBe('tr');
    });

    it('detects en from header', () => {
      expect(service.parseAcceptLanguage('en-US,en;q=0.9')).toBe('en');
      expect(service.parseAcceptLanguage('en')).toBe('en');
    });

    it('detects tr from header', () => {
      expect(service.parseAcceptLanguage('tr-TR,tr;q=0.9')).toBe('tr');
      expect(service.parseAcceptLanguage('tr')).toBe('tr');
    });

    it('prioritizes first match', () => {
      expect(service.parseAcceptLanguage('en-US,tr;q=0.8')).toBe('en');
    });
  });

  describe('parseLocaleParam', () => {
    it('returns en when param is en', () => {
      expect(service.parseLocaleParam('en')).toBe('en');
    });

    it('defaults to tr for other values', () => {
      expect(service.parseLocaleParam('tr')).toBe('tr');
      expect(service.parseLocaleParam('fr')).toBe('tr');
      expect(service.parseLocaleParam(undefined)).toBe('tr');
    });
  });

  describe('resolveLocale', () => {
    it('prioritizes query param over header', () => {
      expect(service.resolveLocale('en', 'tr-TR')).toBe('en');
      expect(service.resolveLocale('tr', 'en-US')).toBe('tr');
    });

    it('falls back to header when no query param', () => {
      expect(service.resolveLocale(undefined, 'en-US')).toBe('en');
      expect(service.resolveLocale(undefined, 'tr-TR')).toBe('tr');
    });

    it('defaults to tr when neither provided', () => {
      expect(service.resolveLocale(undefined, undefined)).toBe('tr');
    });
  });
});
