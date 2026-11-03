import { describe, expect, it } from 'vitest';

function isValidCursor(cursor: string): boolean {
  return /^\d+$/.test(cursor);
}

function safeUpdateCursor(currentCursor: string, newCursor: string): string {
  return isValidCursor(newCursor) ? newCursor : currentCursor;
}

describe('cursor validation', () => {
  describe('isValidCursor', () => {
    it('should accept valid numeric strings', () => {
      expect(isValidCursor('0')).toBe(true);
      expect(isValidCursor('1')).toBe(true);
      expect(isValidCursor('123')).toBe(true);
      expect(isValidCursor('999999')).toBe(true);
    });

    it('should reject non-numeric strings', () => {
      expect(isValidCursor('')).toBe(false);
      expect(isValidCursor('abc')).toBe(false);
      expect(isValidCursor('12abc')).toBe(false);
      expect(isValidCursor('abc12')).toBe(false);
      expect(isValidCursor('12.34')).toBe(false);
      expect(isValidCursor('-1')).toBe(false);
      expect(isValidCursor('+1')).toBe(false);
      expect(isValidCursor('1e5')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(isValidCursor('undefined')).toBe(false);
      expect(isValidCursor('null')).toBe(false);
      expect(isValidCursor('NaN')).toBe(false);
      expect(isValidCursor(' 123 ')).toBe(false);
      expect(isValidCursor('123\n')).toBe(false);
    });
  });

  describe('safeUpdateCursor', () => {
    it('should update cursor when new value is valid', () => {
      expect(safeUpdateCursor('0', '123')).toBe('123');
      expect(safeUpdateCursor('100', '200')).toBe('200');
      expect(safeUpdateCursor('999', '1000')).toBe('1000');
    });

    it('should keep current cursor when new value is invalid', () => {
      expect(safeUpdateCursor('123', 'abc')).toBe('123');
      expect(safeUpdateCursor('456', '')).toBe('456');
      expect(safeUpdateCursor('789', 'undefined')).toBe('789');
      expect(safeUpdateCursor('100', '12.34')).toBe('100');
      expect(safeUpdateCursor('200', '-1')).toBe('200');
    });

    it('should handle edge cases', () => {
      expect(safeUpdateCursor('0', '0')).toBe('0');
      expect(safeUpdateCursor('0', 'invalid')).toBe('0');
      expect(safeUpdateCursor('999', '999')).toBe('999');
    });
  });

  describe('API response cursor extraction', () => {
    it('should extract and validate cursor from event list', () => {
      const events = [
        { id: '1', messageId: 'msg1', incidentId: 'inc1' },
        { id: '2', messageId: 'msg2', incidentId: 'inc2' },
        { id: '3', messageId: 'msg3', incidentId: 'inc3' },
      ];

      const lastEvent = events[events.length - 1];
      const cursor = safeUpdateCursor('0', lastEvent.id);
      expect(cursor).toBe('3');
    });

    it('should handle empty event list', () => {
      const events: Array<{ id: string }> = [];
      const currentCursor = '100';
      
      const cursor = events.length > 0
        ? safeUpdateCursor(currentCursor, events[events.length - 1].id)
        : currentCursor;
      
      expect(cursor).toBe('100');
    });

    it('should handle malformed event IDs', () => {
      const events = [
        { id: 'invalid', messageId: 'msg1', incidentId: 'inc1' },
      ];

      const currentCursor = '50';
      const lastEvent = events[events.length - 1];
      const cursor = safeUpdateCursor(currentCursor, lastEvent.id);
      expect(cursor).toBe('50');
    });
  });
});
