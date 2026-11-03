import { describe, expect, it } from 'vitest';

type EventWithId = { id: string };

function updateCursor(currentCursor: string, events: EventWithId[]): string {
  if (events.length === 0) {
    return currentCursor;
  }
  const lastId = events[events.length - 1].id;
  if (/^\d+$/.test(lastId)) {
    return lastId;
  }
  return currentCursor;
}

describe('updateCursor', () => {
  it('returns current cursor when events array is empty', () => {
    expect(updateCursor('42', [])).toBe('42');
  });

  it('updates cursor with valid numeric id', () => {
    const events = [{ id: '100' }, { id: '101' }, { id: '102' }];
    expect(updateCursor('0', events)).toBe('102');
  });

  it('keeps previous cursor when last event id is non-numeric', () => {
    const events = [{ id: '100' }, { id: 'invalid' }];
    expect(updateCursor('99', events)).toBe('99');
  });

  it('keeps previous cursor when last event id is empty', () => {
    const events = [{ id: '100' }, { id: '' }];
    expect(updateCursor('99', events)).toBe('99');
  });

  it('keeps previous cursor when last event id contains non-digits', () => {
    const events = [{ id: '100' }, { id: '101abc' }];
    expect(updateCursor('99', events)).toBe('99');
  });

  it('keeps previous cursor when last event id has leading zeros (edge case)', () => {
    const events = [{ id: '00123' }];
    expect(updateCursor('99', events)).toBe('00123');
  });

  it('updates cursor with zero', () => {
    const events = [{ id: '0' }];
    expect(updateCursor('99', events)).toBe('0');
  });

  it('updates cursor with large BigInt-compatible id', () => {
    const events = [{ id: '9223372036854775807' }];
    expect(updateCursor('0', events)).toBe('9223372036854775807');
  });
});
