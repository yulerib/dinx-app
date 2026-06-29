import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AIPromptArea() {
  const [input, setInput] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg) return;
    navigate(`/assistente?msg=${encodeURIComponent(msg)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.875rem 1.25rem',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        marginBottom: '2rem',
        cursor: 'text',
        transition: 'border-color 0.2s',
      }}
      onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
    >
      <Sparkles size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Faça uma pergunta ou dê um comando para o Assistente..."
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-main)',
          fontSize: '0.95rem',
          outline: 'none',
        }}
      />
    </form>
  );
}
