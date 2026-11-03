/**
 * TranslatedMessageDisplay component tests
 * Ensures translation UI shows original and translated text correctly
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { TranslatedMessageDisplay } from './TranslatedMessageDisplay';

jest.mock('../../components/operator/OperatorPreferencesProvider', () => ({
  useOperatorPreferences: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'web.translation.machineTranslation': 'Machine translation (AI)',
        'web.translation.original': 'Original',
        'web.translation.notTranslated': 'Not translated (AI unavailable)',
        'web.translation.toggle': 'Show original',
        'web.translation.hideOriginal': 'Hide original',
      };
      return translations[key] || key;
    },
  }),
}));

describe('TranslatedMessageDisplay', () => {
  it('shows only original when no translation available', () => {
    render(
      <TranslatedMessageDisplay
        originalText="Depremde mahsur kaldım"
        translatedText={null}
        detectedLanguage={null}
        aiAvailable={true}
      />
    );

    expect(screen.getByText('Depremde mahsur kaldım')).toBeInTheDocument();
    expect(screen.queryByText('Machine translation (AI)')).not.toBeInTheDocument();
  });

  it('shows translated text by default when available', () => {
    render(
      <TranslatedMessageDisplay
        originalText="Depremde mahsur kaldım"
        translatedText="I am trapped in the earthquake"
        detectedLanguage="Turkish"
        aiAvailable={true}
      />
    );

    expect(screen.getByText('I am trapped in the earthquake')).toBeInTheDocument();
    expect(screen.getByText('Machine translation (AI)')).toBeInTheDocument();
    expect(screen.getByText(/Original: Turkish/)).toBeInTheDocument();
  });

  it('toggles between translated and original text', () => {
    render(
      <TranslatedMessageDisplay
        originalText="Depremde mahsur kaldım"
        translatedText="I am trapped in the earthquake"
        detectedLanguage="Turkish"
        aiAvailable={true}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /Show original/ });

    expect(screen.getByText('I am trapped in the earthquake')).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByText('Depremde mahsur kaldım')).toBeInTheDocument();
    expect(screen.queryByText('I am trapped in the earthquake')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByText('I am trapped in the earthquake')).toBeInTheDocument();
  });

  it('shows AI unavailable badge when AI disabled', () => {
    render(
      <TranslatedMessageDisplay
        originalText="Depremde mahsur kaldım"
        translatedText={null}
        detectedLanguage={null}
        aiAvailable={false}
      />
    );

    expect(screen.getByText('Not translated (AI unavailable)')).toBeInTheDocument();
  });
});
