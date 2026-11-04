'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { useOperatorPreferences } from '../../../components/operator/OperatorPreferencesProvider';
import type { OperatorAttachmentSummary, OperatorTranscript } from '../types';
import { CaseSection } from './CaseSection';
import { formatClock } from './format';
import { Icon } from './icons';

const RATES = [1, 1.5, 2] as const;

function AudioPlayer({
  attachment,
  audioRef,
  onTime,
}: {
  attachment: OperatorAttachmentSummary;
  audioRef: RefObject<HTMLAudioElement>;
  onTime: (seconds: number) => void;
}) {
  const { t } = useOperatorPreferences();
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState((attachment.durationMs ?? 0) / 1000);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);
  const [failed, setFailed] = useState(false);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => setFailed(true));
    } else {
      audio.pause();
    }
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className={`cd2-player ${failed ? 'is-failed' : ''}`} data-testid="case-audio-player">
      <audio
        ref={audioRef}
        src={`/api/operator/attachments/${attachment.id}/audio`}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setDuration(value);
        }}
        onTimeUpdate={(event) => {
          setCurrent(event.currentTarget.currentTime);
          onTime(event.currentTarget.currentTime);
        }}
      />
      <button
        type="button"
        className="cd2-player__play"
        onClick={toggle}
        aria-label={playing ? t('web.cases.audioPause') : t('web.cases.audioPlay')}
        data-testid="case-audio-toggle"
      >
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </button>
      <div className="cd2-player__track">
        <input
          type="range"
          className="cd2-player__range"
          min={0}
          max={duration > 0 ? duration : 1}
          step={0.1}
          value={Math.min(current, duration > 0 ? duration : 1)}
          style={{ ['--cd2-progress' as string]: `${progress}%` }}
          aria-label={t('web.cases.audioSeek')}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (audioRef.current) audioRef.current.currentTime = value;
            setCurrent(value);
          }}
        />
        <div className="cd2-player__time">
          <span>{formatClock(current)}</span>
          <span data-testid="case-audio-duration">{formatClock(duration)}</span>
        </div>
      </div>
      <button
        type="button"
        className="cd2-player__rate"
        onClick={cycleRate}
        aria-label={`${rate}x`}
      >
        {rate}x
      </button>
    </div>
  );
}

function TranscriptBlock({
  attachment,
  transcript,
  audioRef,
  currentSeconds,
}: {
  attachment: OperatorAttachmentSummary;
  transcript: OperatorTranscript | undefined;
  audioRef: RefObject<HTMLAudioElement>;
  currentSeconds: number;
}) {
  const { t } = useOperatorPreferences();

  if (attachment.transcriptStatus === 'failed') {
    return (
      <div className="cd2-state cd2-state--error" role="alert" data-testid="transcript-failed">
        <Icon name="alert" size={16} />
        <span>{t('web.cases.transcriptFailed')}</span>
      </div>
    );
  }
  if (!transcript) {
    if (attachment.transcriptStatus === 'pending' || attachment.transcriptStatus === 'processing') {
      return (
        <div className="cd2-state" data-testid="transcript-pending">
          <span className="cd2-spinner" aria-hidden="true" />
          <span>{t('web.cases.transcriptPending')}</span>
        </div>
      );
    }
    return (
      <p className="cd2-empty" data-testid="transcript-empty">
        {t('web.cases.transcriptEmpty')}
      </p>
    );
  }

  const translation = transcript.translatedTranscript ?? transcript.translatedText ?? null;
  const currentMs = currentSeconds * 1000;

  return (
    <div className="cd2-transcript" data-testid="case-transcript">
      <div className="cd2-transcript__block">
        <div className="cd2-transcript__label">
          <span>{t('web.cases.transcriptOriginal')}</span>
          {transcript.language ? (
            <span className="cd2-pill" data-testid="ai-transcript-language">
              {transcript.language}
            </span>
          ) : null}
        </div>
        <p className="cd2-prose" data-testid="ai-transcript-text">
          {transcript.transcript}
        </p>
      </div>

      {translation ? (
        <div className="cd2-transcript__block cd2-transcript__block--translation">
          <div className="cd2-transcript__label">
            <span>{t('web.cases.transcriptTranslation')}</span>
            {transcript.translationLanguage ? (
              <span className="cd2-pill">{transcript.translationLanguage}</span>
            ) : null}
            <span className="cd2-pill cd2-pill--ai">{t('web.translation.machineTranslation')}</span>
          </div>
          <p className="cd2-prose" data-testid="case-transcript-translation">
            {translation}
          </p>
        </div>
      ) : null}

      {transcript.turns.length > 1 ? (
        <ol className="cd2-turns" data-testid="ai-transcript-turns">
          {transcript.turns.map((turn) => {
            const active = currentMs >= turn.startMs && currentMs <= turn.endMs;
            return (
              <li key={turn.turnId} className={active ? 'is-active' : ''}>
                <button
                  type="button"
                  className="cd2-turns__time"
                  onClick={() => {
                    if (audioRef.current) audioRef.current.currentTime = turn.startMs / 1000;
                  }}
                >
                  {formatClock(turn.startMs / 1000)}
                </button>
                <span>
                  {turn.speaker ? <strong>{turn.speaker}: </strong> : null}
                  {turn.transcript}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function AudioItem({
  attachment,
  transcript,
}: {
  attachment: OperatorAttachmentSummary;
  transcript: OperatorTranscript | undefined;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [seconds, setSeconds] = useState(0);
  const onTime = useCallback((value: number) => setSeconds(value), []);

  useEffect(() => {
    setSeconds(0);
  }, [attachment.id]);

  return (
    <div className="cd2-audio-item">
      <AudioPlayer attachment={attachment} audioRef={audioRef} onTime={onTime} />
      <TranscriptBlock
        attachment={attachment}
        transcript={transcript}
        audioRef={audioRef}
        currentSeconds={seconds}
      />
    </div>
  );
}

export function CaseAudioCard({
  attachments,
  transcripts,
}: {
  attachments: OperatorAttachmentSummary[];
  transcripts: OperatorTranscript[];
}) {
  const { t } = useOperatorPreferences();
  return (
    <CaseSection title={t('web.cases.audioTranscript')} icon="mic" testId="case-audio-card">
      {attachments.map((attachment) => (
        <AudioItem
          key={attachment.id}
          attachment={attachment}
          transcript={transcripts.find((item) => item.attachmentId === attachment.id)}
        />
      ))}
    </CaseSection>
  );
}
