import { useMemo, useState, useRef, useEffect } from 'react';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { Button } from './Button';
import { getAuthHeaders as buildAuthHeaders } from '../../utils/authStorage';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface ChatResponse {
  reply?: string;
  suggestions?: string[];
}

function getAuthHeaders(): HeadersInit {
  return buildAuthHeaders(true);
}

export function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi, I am your Fikisha AI assistant. Ask me about order tracking, delivery ETA, promos, or what to order.'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickPrompts = useMemo(
    () => ['Track my order', 'Best stores near me', 'How is ETA calculated?'],
    []
  );

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text
    };

    setMessages((previous) => [...previous, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: text,
          context: messages.slice(-6)
        })
      });

      if (!response.ok) {
        throw new Error('AI chat unavailable');
      }

      const data = (await response.json()) as ChatResponse;
      const assistantReply: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text: String(data.reply || 'I could not process that request right now.')
      };

      setMessages((previous) => [...previous, assistantReply]);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 4).map(String) : []);
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-assistant-fallback`,
          role: 'assistant',
          text: 'I am having trouble right now. Please try again shortly.'
        }
      ]);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="ai-assistant-toggle"
        aria-label="Open AI assistant"
        onClick={() => setIsOpen((previous) => !previous)}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          width: 58,
          height: 58,
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
          color: '#fff',
          boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
          zIndex: 1300,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {isOpen ? (
        <div
          className="ai-assistant-panel"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 88,
            width: 'min(360px, calc(100vw - 32px))',
            maxHeight: '70vh',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.22)',
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
            overflow: 'hidden',
            zIndex: 1300
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-hover)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={18} color="var(--primary)" />
              <strong>Fikisha AI Assistant</strong>
            </div>
            <button type="button" className="btn-icon" onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: '12px', overflowY: 'auto', display: 'grid', gap: '10px' }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  justifySelf: message.role === 'user' ? 'end' : 'start',
                  maxWidth: '85%',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: message.role === 'user' ? 'var(--primary)' : 'var(--surface-hover)',
                  color: message.role === 'user' ? '#fff' : 'var(--text-main)',
                  fontSize: '0.92rem',
                  lineHeight: 1.4
                }}
              >
                {message.text}
              </div>
            ))}
            {loading ? <div className="text-sm text-muted">Thinking…</div> : null}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', padding: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  style={{
                    fontSize: '0.75rem',
                    borderRadius: '999px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface-hover)',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    minHeight: '36px'
                  }}
                >
                  {prompt}
                </button>
              ))}
              {suggestions.map((prompt) => (
                <button
                  key={`suggestion-${prompt}`}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  style={{
                    fontSize: '0.75rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(37, 99, 235, 0.35)',
                    background: 'rgba(37, 99, 235, 0.08)',
                    color: '#1d4ed8',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    minHeight: '36px'
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void sendMessage(query);
                  }
                }}
                placeholder="Ask anything about your delivery"
                aria-label="Type your message"
                className="input-field"
                style={{ flex: 1 }}
              />
              <Button
                aria-label="Send message"
                onClick={() => {
                  void sendMessage(query);
                }}
                disabled={loading || !query.trim()}
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
