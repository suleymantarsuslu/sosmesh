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
        'web.translation.notTranslated': 'Not translated',
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
        uiLanguage="en"
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
        uiLanguage="en"
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
        uiLanguage="en"
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

  it('shows the not-translated badge only when the message language differs from the UI language', () => {
    const { rerender } = render(
      <TranslatedMessageDisplay
        originalText="Depremde mahsur kaldım"
        translatedText={null}
        detectedLanguage="tr"
        uiLanguage="en"
      />
    );

    expect(screen.getByText('Not translated')).toBeInTheDocument();

    rerender(
      <TranslatedMessageDisplay
        originalText="Depremde mahsur kaldım"
        translatedText={null}
        detectedLanguage="tr"
        uiLanguage="tr"
      />
    );

    expect(screen.queryByText('Not translated')).not.toBeInTheDocument();
  });
});
