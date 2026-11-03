'use client';

import { useState, useRef } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { TranscriptView } from './types';

type Props = {
  transcript: TranscriptView;
};

export function TranscriptCard({ transcript }: Props) {
  const { t } = useOperatorPreferences();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime * 1000);
    }
  };

  const seekToTurn = (startMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startMs / 1000;
    }
  };

  return (
    <section
      className="ai-card ai-transcript-card"
      aria-labelledby="ai-transcript-title"
      data-testid="ai-transcript-card"
    >
      <header className="ai-card__header">
        <h3 id="ai-transcript-title">{t('web.ai.transcriptTitle')}</h3>
      </header>

      <div className="ai-card__body">
        <audio
          ref={audioRef}
          controls
          className="ai-audio-player"
          onTimeUpdate={handleTimeUpdate}
          data-testid="ai-audio-player"
          src={`/api/operator/attachments/${transcript.attachmentId}/audio`}
        >
          Your browser does not support audio playback.
        </audio>

        <dl className="ai-meta-grid">
          {transcript.language && (
            <>
              <dt>{t('web.ai.transcriptLanguage')}</dt>
              <dd data-testid="ai-transcript-language">{transcript.language}</dd>
            </>
          )}
          {transcript.audioDurationMs && (
            <>
              <dt>{t('web.ai.transcriptDuration')}</dt>
              <dd data-testid="ai-transcript-duration">
                {formatTime(transcript.audioDurationMs)}
              </dd>
            </>
          )}
        </dl>

        <div className="ai-transcript">
          <div className="ai-transcript__full" data-testid="ai-transcript-text">
            <strong>{t('web.cases.originalText')}</strong>
            <p className="ai-text">{transcript.transcript}</p>
          </div>

          {transcript.turns.length > 0 && (
            <div className="ai-transcript__turns">
              <strong>{t('web.ai.transcriptTitle')}</strong>
              <ol className="ai-transcript-turns" data-testid="ai-transcript-turns">
                {transcript.turns.map((turn) => (
                  <li
                    key={turn.turnId}
                    className={`ai-transcript-turn ${
                      currentTime >= turn.startMs && currentTime <= turn.endMs
                        ? 'ai-transcript-turn--active'
                        : ''
                    }`}
                    data-testid="ai-transcript-turn"
                  >
                    <button
                      type="button"
                      className="ai-transcript-turn__time"
                      onClick={() => seekToTurn(turn.startMs)}
                      aria-label={`Seek to ${formatTime(turn.startMs)}`}
                    >
                      {formatTime(turn.startMs)}
                    </button>
                    <div className="ai-transcript-turn__content">
                      {turn.speaker && (
                        <strong className="ai-transcript-turn__speaker">
                          {t('web.ai.transcriptSpeaker')} {turn.speaker}:
                        </strong>
                      )}
                      <span>{turn.transcript}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="ai-meta" data-testid="ai-transcript-meta">
          <small>
            {t('web.ai.modelVersion')}: {transcript.model}
          </small>
        </div>
      </div>
    </section>
  );
}
