import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AiSuggestionPanel } from './AiSuggestionPanel';
import { AI_DRAFT_LABEL } from './types';

describe('AiSuggestionPanel', () => {
  it('always shows unverified draft label', () => {
    render(<AiSuggestionPanel ai={null} />);
    expect(screen.getByTestId('case-ai-draft-badge')).toHaveTextContent(AI_DRAFT_LABEL);
  });

  it('renders detail when AI is missing', () => {
    render(<AiSuggestionPanel ai={null} loadError />);
    expect(screen.getByText(/AI önerisi yüklenemedi/)).toBeInTheDocument();
  });

  it('shows suggestion fields when present', () => {
    render(
      <AiSuggestionPanel
        ai={{
          status: 'COMPLETED',
          modelVersion: 'mock',
          verified: false,
          label: AI_DRAFT_LABEL,
          suggestion: {
            uncertainty: true,
            quoted_evidence: ['sentetik'],
            needs: ['değerlendirme'],
            urgency_suggestion: 'high',
          },
        }}
      />
    );
    expect(screen.getByTestId('case-ai-evidence')).toHaveTextContent('sentetik');
  });
});
