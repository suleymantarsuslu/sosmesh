/**
 * Conservative language detection for short SOS texts and transcripts.
 *
 * Unlike the permissive heuristic in MessageTranslationService (which only decides how to
 * override a model verdict), this returns a language ONLY when it is very likely correct, so the
 * caller can skip a paid model call. Anything ambiguous returns 'unknown'.
 */

export type ConfidentLanguage = 'tr' | 'en' | 'unknown';

// Letters that occur in Turkish and not in English; ı, ğ, ş are Turkish-specific (ç/ö/ü are shared).
const TURKISH_SPECIFIC_CHARS = /[ığşİĞŞ]/;
const ANY_NON_ASCII_LETTER = /[^\u0000-\u007f]/;
const SCRIPT_OTHER_THAN_LATIN = /[\u0370-\u03ff\u0400-\u04ff\u0590-\u06ff\u0900-\u0dff\u3040-\u9fff\uac00-\ud7af]/;

// Whole-word Turkish markers, including ASCII-folded spellings people type on phones.
const TURKISH_WORDS = new Set([
  'yardim', 'yardım', 'edin', 'lutfen', 'lütfen', 'enkaz', 'deprem', 'yangin', 'yangın', 'mahsur',
  'kaldik', 'kaldık', 'kisi', 'kişi', 'yarali', 'yaralı', 'acil', 'bina', 'katta', 'icin', 'için',
  'var', 'yok', 'bir', 'bu', 'su', 'şu', 've', 'ama', 'cok', 'çok', 'biz', 'bizi', 'beni', 'gelin',
  'hemen', 'nerede', 'burada', 'iki', 'uc', 'üç', 'kurtarin', 'kurtarın', 'sikisti', 'sıkıştı',
]);

const ENGLISH_WORDS = new Set([
  'the', 'is', 'are', 'we', 'i', 'and', 'to', 'in', 'on', 'at', 'of', 'a', 'an', 'help', 'please',
  'need', 'trapped', 'people', 'building', 'emergency', 'here', 'there', 'injured', 'fire', 'water',
  'send', 'come', 'quickly', 'urgent', 'stuck', 'under', 'inside', 'my', 'our', 'with', 'no', 'not',
]);
// Words that are only meaningful as English evidence when several appear together.
const ENGLISH_STRONG = new Set(['help', 'please', 'need', 'trapped', 'people', 'building', 'emergency', 'injured', 'urgent', 'stuck']);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zA-Z\u00c0-\u024f\u0131\u015f\u011f]+/u)
    .filter((t) => t.length > 0);
}

export function detectConfidentLanguage(text: string): ConfidentLanguage {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return 'unknown';
  if (SCRIPT_OTHER_THAN_LATIN.test(trimmed)) return 'unknown';

  const words = tokens(trimmed);
  const turkishHits = words.filter((w) => TURKISH_WORDS.has(w)).length;

  if (TURKISH_SPECIFIC_CHARS.test(trimmed)) {
    return 'tr';
  }
  if (turkishHits >= 2) {
    return 'tr';
  }

  // English: plain ASCII only, no Turkish evidence at all, and clear English vocabulary.
  if (!ANY_NON_ASCII_LETTER.test(trimmed) && turkishHits === 0) {
    const englishHits = words.filter((w) => ENGLISH_WORDS.has(w)).length;
    const strongHits = words.filter((w) => ENGLISH_STRONG.has(w)).length;
    if (englishHits >= 2 && strongHits >= 1) {
      return 'en';
    }
  }

  return 'unknown';
}
