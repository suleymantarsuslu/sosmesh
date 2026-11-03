'use client';

import { useState } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export function MissionCopilotCard() {
  const { t } = useOperatorPreferences();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setBusy(true);

    try {
      const res = await fetch('/api/operator/copilot/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.answer || 'No response' },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Error: Could not get response' },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: Network failure' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="ai-card ai-copilot-card"
      aria-labelledby="ai-copilot-title"
      data-testid="ai-copilot-card"
    >
      <header className="ai-card__header">
        <h2 id="ai-copilot-title">{t('web.ai.missionCopilot')}</h2>
      </header>

      <div className="ai-card__body">
        <div className="ai-copilot-messages" data-testid="ai-copilot-messages">
          {messages.length === 0 && (
            <div className="ai-copilot-empty" role="status">
              {t('web.ai.copilotPlaceholder')}
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`ai-copilot-message ai-copilot-message--${msg.role}`}
              data-testid={`ai-copilot-message-${msg.role}`}
            >
              <div className="ai-copilot-message__content">{msg.content}</div>
            </div>
          ))}
          {busy && (
            <div className="ai-copilot-message ai-copilot-message--assistant">
              <div className="ai-copilot-message__content">{t('web.ai.copilotAnswering')}</div>
            </div>
          )}
        </div>

        <form className="ai-copilot-form" onSubmit={handleSubmit} data-testid="ai-copilot-form">
          <input
            type="text"
            className="ai-copilot-input"
            placeholder={t('web.ai.copilotPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            data-testid="ai-copilot-input"
          />
          <button
            type="submit"
            className="ui-button"
            disabled={!input.trim() || busy}
            data-testid="ai-copilot-send"
          >
            {t('web.ai.copilotSend')}
          </button>
        </form>
      </div>
    </section>
  );
}
