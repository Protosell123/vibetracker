import React, { useState, useEffect, useRef } from 'react';
import { LOCAL_API_BASE } from '../utils/api.js';

// Markdown-lite renderer
function renderMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="local-ai-h4">
          {line.slice(4)}
        </h4>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="local-ai-h3">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={i} className="local-ai-bullet">
          <span className="bullet-dot">•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="local-ai-p">
          {formatInline(line)}
        </p>
      );
    }
    i++;
  }

  return elements;
}

function formatInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="local-ai-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const SUGGESTIONS = [
  'Boards of Canada – warm lo-fi ambient textures',
  'Daft Punk – Discovery era synth leads',
  'Massive Attack – Teardrop trip-hop atmosphere',
  'Pink Floyd – Comfortably Numb guitar solo tone',
  'Nine Inch Nails – industrial distorted bass',
];

export default function LocalAssistant({ isBackendOnline, onGoToSettings }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [keyOk, setKeyOk] = useState(null); // null=loading, true, false
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Check if API key is configured
  useEffect(() => {
    if (!isBackendOnline) return;
    fetch(`${LOCAL_API_BASE}/api/ai/key-status`)
      .then(r => r.json())
      .then(d => setKeyOk(d.configured))
      .catch(() => setKeyOk(false));
  }, [isBackendOnline]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const send = async (text) => {
    const userText = (text ?? input).trim();
    if (!userText || streaming) return;

    setInput('');
    setError(null);

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setStreaming(true);

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch(`${LOCAL_API_BASE}/api/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.text) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + payload.text,
                };
                return updated;
              });
            }
            if (payload.error) throw new Error(payload.error);
            if (payload.done) break;
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }
    } catch (e) {
      setError(e.message);
      // Remove the empty assistant message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  if (keyOk === false) {
    return (
      <div className="flex-col align-center justify-center text-center" style={{ height: '80%', padding: '40px' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>✨</div>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>AI Assistant Needs API Key</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '360px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
          Configure your Anthropic API key in Settings to get intelligent plugin recommendations from your local library powered by Claude.
        </p>
        <button className="settings-trigger-btn" onClick={onGoToSettings} style={{ width: 'auto', padding: '10px 24px', margin: '0 auto' }}>
          Configure Pluggen Settings
        </button>
      </div>
    );
  }

  return (
    <div className="flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="flex-row justify-between align-center" style={{ marginBottom: '16px', shrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>Local AI Assistant</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Ask Claude to find matching plugins in your local scanned library for any style or sound
          </span>
        </div>
        {messages.length > 0 && (
          <button 
            className="dev-tag-pill" 
            onClick={clearChat}
            style={{ borderRadius: '6px', fontSize: '11px', padding: '6px 12px' }}
          >
            ✕ Clear Chat
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-grow" style={{ 
        overflowY: 'auto', 
        padding: '16px 20px', 
        backgroundColor: 'var(--bg-input)', 
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        marginBottom: '16px'
      }}>
        {messages.length === 0 ? (
          <div className="flex-col align-center justify-center text-center" style={{ padding: '60px 20px' }}>
            <span style={{ fontSize: '36px', marginBottom: '16px' }}>✨</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
              Describe the sound, style, or vibe you want to make
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', maxWidth: '400px', margin: '0 auto 24px auto', lineHeight: '1.5' }}>
              Claude will analyze your local scanned plugins library and suggest the best instruments, synths, or audio effects to load in your DAW.
            </p>
            
            <div className="flex-row" style={{ gap: '8px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '500px', margin: '0 auto' }}>
              {SUGGESTIONS.map(s => (
                <button 
                  key={s} 
                  className="dev-tag-pill" 
                  onClick={() => send(s)}
                  style={{ fontSize: '11px', padding: '6px 12px', borderRadius: '20px' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <div key={i} className="message-bubble-wrapper" style={{
                  display: 'flex',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  gap: '12px',
                  flexDirection: isUser ? 'row-reverse' : 'row'
                }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: isUser ? '#2d2e35' : 'var(--accent-orange-alpha)',
                    color: isUser ? '#fff' : 'var(--accent-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '10px',
                    shrink: 0
                  }}>
                    {isUser ? 'YOU' : 'AI'}
                  </div>

                  <div style={{
                    backgroundColor: isUser ? '#1f2025' : 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    lineHeight: '1.6',
                    fontSize: '13px',
                    color: '#fff'
                  }}>
                    {isUser ? (
                      <p>{m.content}</p>
                    ) : (
                      <div className="ai-md-content">
                        {renderMarkdown(m.content)}
                        {streaming && i === messages.length - 1 && m.content === '' && (
                          <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', display: 'inline-block', margin: '0 0 0 6px' }}></span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="error-banner" style={{
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: 'var(--accent-red)',
            fontSize: '12px',
            marginTop: '16px'
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Input container */}
      <div className="flex-row align-end" style={{ gap: '12px', shrink: 0, padding: '4px 0' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. I want to build a warm tape-saturated lo-fi delay loop..."
          rows="2"
          disabled={streaming}
          className="sidebar-search-input"
          style={{ 
            flexGrow: 1, 
            margin: 0, 
            height: '60px', 
            resize: 'none', 
            borderRadius: '8px',
            fontFamily: 'inherit',
            fontSize: '13px',
            padding: '10px 14px'
          }}
        />
        
        <button 
          className="sync-btn"
          onClick={() => send()}
          disabled={!input.trim() || streaming}
          style={{ 
            height: '60px', 
            width: '60px', 
            borderRadius: '8px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '16px'
          }}
        >
          {streaming ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', margin: 0 }}></span> : '➔'}
        </button>
      </div>
    </div>
  );
}
