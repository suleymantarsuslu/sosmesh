/**
 * Locale Content Service
 * Extracts locale-specific content from bilingual AI-generated data
 */

import { Injectable } from '@nestjs/common';

export type BilingualText = {
  tr: string;
  en: string;
} | string;

export type OperatorLocale = 'tr' | 'en';

@Injectable()
export class LocaleContentService {
  /**
   * Extract text for the given locale from bilingual content
   */
  extractText(content: BilingualText | null | undefined, locale: OperatorLocale, fallback = ''): string {
    if (!content) return fallback;
    
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null && (parsed.tr || parsed.en)) {
          return parsed[locale] || parsed.en || parsed.tr || fallback;
        }
        return content;
      } catch {
        return content;
      }
    }
    
    if (typeof content === 'object' && content !== null) {
      return content[locale] || content.en || content.tr || fallback;
    }
    
    return fallback;
  }

  /**
   * Parse locale from Accept-Language header
   */
  parseAcceptLanguage(header: string | undefined): OperatorLocale {
    if (!header) return 'tr';
    
    const normalized = header.toLowerCase();
    if (normalized.includes('en')) return 'en';
    if (normalized.includes('tr')) return 'tr';
    
    return 'tr';
  }

  /**
   * Parse locale from query parameter
   */
  parseLocaleParam(param: string | undefined): OperatorLocale {
    if (param === 'en') return 'en';
    return 'tr';
  }

  /**
   * Determine effective locale from request
   */
  resolveLocale(queryParam: string | undefined, acceptLanguage: string | undefined): OperatorLocale {
    if (queryParam) {
      return this.parseLocaleParam(queryParam);
    }
    return this.parseAcceptLanguage(acceptLanguage);
  }
}
