import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { AI_DRAFT_LABEL } from './types';

describe('AiSuggestionPanel', () => {
  it('always uses unverified draft label constant', () => {
    expect(AI_DRAFT_LABEL).toBe('öneri/taslak, doğrulanmadı');
  });

  it('shows draft badge in component markup', () => {
    const src = readFileSync(`${__dirname}/AiSuggestionPanel.tsx`, 'utf8');
    expect(src).toContain('data-testid="case-ai-draft-badge"');
    expect(src).toContain('AI_DRAFT_LABEL');
  });

  it('does not treat AI as authority in copy', () => {
    const src = readFileSync(`${__dirname}/AiSuggestionPanel.tsx`, 'utf8');
    expect(src).toContain('AI operatör adına karar vermez');
  });
});
