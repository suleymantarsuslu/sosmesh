import { describe, expect, it } from 'vitest';

import { displayTaskTitle } from './task-title';

const t = (key: string) => (key === 'web.tasks.confirmedTaskTitle' ? 'Assignment: {team}' : key);

describe('displayTaskTitle', () => {
  it('localizes titles of tasks created by a confirmed recommendation', () => {
    expect(displayTaskTitle('Koordinatör onaylı görev: Alpha', 'AI', t)).toBe('Assignment: Alpha');
  });

  it('keeps user-written titles untouched', () => {
    expect(displayTaskTitle('Koordinatör onaylı görev: Alpha', 'MANUAL', t)).toBe(
      'Koordinatör onaylı görev: Alpha'
    );
    expect(displayTaskTitle('Clear road', 'AI', t)).toBe('Clear road');
  });
});
