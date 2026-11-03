'use client';

import { useState } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

export function DemoSosForm() {
  const { t } = useOperatorPreferences();
  const [text, setText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;

    setBusy(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('text', text);
      if (audioFile) formData.append('audio', audioFile);
      if (photoFile) formData.append('photo', photoFile);

      const res = await fetch('/api/operator/demo/sos', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setResult('success');
        setText('');
        setAudioFile(null);
        setPhotoFile(null);
      } else {
        setResult('error');
      }
    } catch {
      setResult('error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="ai-card ai-demo-form"
      aria-labelledby="ai-demo-title"
      data-testid="ai-demo-form"
    >
      <header className="ai-card__header">
        <h2 id="ai-demo-title">{t('web.ai.demoSosTitle')}</h2>
        <span className="ai-badge ai-badge--warning" data-testid="ai-demo-warning">
          {t('web.ai.demoSosWarning')}
        </span>
      </header>

      <div className="ai-card__body">
        <form onSubmit={handleSubmit} data-testid="ai-demo-form-element">
          <div className="form-field">
            <label htmlFor="demo-text">{t('web.ai.demoSosText')}</label>
            <textarea
              id="demo-text"
              className="form-textarea"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              required
              data-testid="ai-demo-text"
            />
          </div>

          <div className="form-field">
            <label htmlFor="demo-audio">{t('web.ai.demoSosAudio')}</label>
            <input
              id="demo-audio"
              type="file"
              accept="audio/*"
              className="form-file"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              disabled={busy}
              data-testid="ai-demo-audio"
            />
          </div>

          <div className="form-field">
            <label htmlFor="demo-photo">{t('web.ai.demoSosPhoto')}</label>
            <input
              id="demo-photo"
              type="file"
              accept="image/*"
              className="form-file"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              disabled={busy}
              data-testid="ai-demo-photo"
            />
          </div>

          <button
            type="submit"
            className="ui-button"
            disabled={!text.trim() || busy}
            data-testid="ai-demo-submit"
          >
            {t('web.ai.demoSosSubmit')}
          </button>

          {result === 'success' && (
            <div className="form-result form-result--success" role="status">
              {t('web.ai.demoSosSuccess')}
            </div>
          )}

          {result === 'error' && (
            <div className="form-result form-result--error" role="alert">
              {t('web.ai.demoSosError')}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
