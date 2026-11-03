'use client';

import { useState } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

type Props = {
  originalText: string;
  translatedText: string | null;
  detectedLanguage: string | null;
  aiAvailable: boolean;
};

export function TranslatedMessageDisplay({
  originalText,
  translatedText,
  detectedLanguage,
  aiAvailable,
}: Props) {
  const { t } = useOperatorPreferences();
  const [showOriginal, setShowOriginal] = useState(false);

  if (!translatedText) {
    return (
      <div className="translated-message" data-testid="original-message-only">
        <p className="translated-message__text">{originalText}</p>
        {!aiAvailable && (
          <p className="translated-message__note" role="note">
            <span className="translated-message__badge">{t('web.translation.notTranslated')}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="translated-message" data-testid="translated-message">
      <div className="translated-message__content">
        <p className="translated-message__text">
          {showOriginal ? originalText : translatedText}
        </p>
      </div>

      <div className="translated-message__meta">
        <span className="translated-message__badge" role="note">
          {t('web.translation.machineTranslation')}
        </span>
        {detectedLanguage && (
          <span className="translated-message__language">
            {t('web.translation.original')}: {detectedLanguage}
          </span>
        )}
        <button
          type="button"
          className="translated-message__toggle"
          onClick={() => setShowOriginal(!showOriginal)}
          aria-expanded={showOriginal}
          aria-label={showOriginal ? t('web.translation.hideOriginal') : t('web.translation.toggle')}
          data-testid="toggle-original-text"
        >
          {showOriginal ? t('web.translation.hideOriginal') : t('web.translation.toggle')}
        </button>
      </div>

      {showOriginal && (
        <div className="translated-message__original-label" aria-live="polite">
          <small>{t('web.translation.original')}</small>
        </div>
      )}
    </div>
  );
}
