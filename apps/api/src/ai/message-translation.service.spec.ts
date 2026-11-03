/**
 * MessageTranslationService tests
 * Focuses on Turkish language detection heuristic to prevent mislabeling Turkish as English
 */

import { MessageTranslationService } from './message-translation.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetaModelClient } from './meta-model-client';
import { BudgetGuardService } from './budget-guard.service';

describe('MessageTranslationService', () => {
  let service: MessageTranslationService;

  beforeEach(() => {
    const mockPrisma = {} as any as PrismaService;
    const mockMetaClient = {} as any as MetaModelClient;
    const mockBudgetGuard = {} as any as BudgetGuardService;
    service = new MessageTranslationService(mockPrisma, mockMetaClient, mockBudgetGuard);
  });

  describe('detectLanguageHeuristic', () => {
    it('should detect Turkish based on special characters (user report case)', () => {
      const detector = (service as any).detectLanguageHeuristic.bind(service);
      
      expect(detector('Çöken bina, 2. katta mahsur kalan iki kişi var')).toBe('tr');
      expect(detector('Çöken bina')).toBe('tr');
      expect(detector('İyi günler')).toBe('tr');
      expect(detector('Şehir merkezi')).toBe('tr');
      expect(detector('Lütfen yardım')).toBe('tr');
    });

    it('should detect Turkish based on common words', () => {
      const detector = (service as any).detectLanguageHeuristic.bind(service);
      
      expect(detector('deprem enkaz yardim var kisi')).toBe('tr');
      expect(detector('mahsur kaldik lutfen bina var')).toBe('tr');
      expect(detector('bina katta mahsur kalan iki kisi')).toBe('tr');
    });

    it('should detect English based on common words', () => {
      const detector = (service as any).detectLanguageHeuristic.bind(service);
      
      expect(detector('emergency help please building')).toBe('en');
      expect(detector('people trapped need help')).toBe('en');
    });

    it('should return unknown for ambiguous text', () => {
      const detector = (service as any).detectLanguageHeuristic.bind(service);
      
      expect(detector('hello')).toBe('unknown');
      expect(detector('123456')).toBe('unknown');
      expect(detector('ok')).toBe('unknown');
    });

    it('should prioritize Turkish characters over word count', () => {
      const detector = (service as any).detectLanguageHeuristic.bind(service);
      
      expect(detector('help çok')).toBe('tr');
      expect(detector('ğ')).toBe('tr');
    });
  });
});
