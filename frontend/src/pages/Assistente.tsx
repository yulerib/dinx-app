import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, User, Sparkles, AlertCircle, Key, Settings } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  SYSTEM_PROMPT,
  getCurrentContextSnapshot,
  sendMessageWithFallback,
  getGeminiApiKey,
  saveGeminiApiKey,
} from '../services/ai';
import type { ChatMessage } from '../services/ai';

interface DisplayMessage {
  id: string;
  role: 'user' | 'model' | 'error';
  text: string;
}

export function Assistente() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Oi! 👋 Sou seu assistente financeiro. Pode me pedir pra lançar gastos, tirar dúvidas sobre seu histórico ou me perguntar qualquer coisa sobre as suas finanças. Como posso te ajudar hoje?',
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialMsgProcessed = useRef(false);

  // Estados para chave de API do Gemini
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [keyInputValue, setKeyInputValue] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Checar chave no carregamento
  useEffect(() => {
    async function checkKey() {
      try {
        const key = await getGeminiApiKey();
        setHasKey(!!key);
        if (key) {
          setKeyInputValue(key);
        }
      } catch (err) {
        console.warn("Erro ao checar chave do Gemini:", err);
      } finally {
        setIsCheckingKey(false);
      }
    }
    checkKey();
  }, []);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = keyInputValue.trim();
    if (!cleanKey) return;

    setIsSavingKey(true);
    try {
      await saveGeminiApiKey(cleanKey);
      setHasKey(true);
      setShowSettings(false);
    } catch (err) {
      alert("Erro ao salvar a chave. Tente novamente.");
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRemoveKey = async () => {
    if (window.confirm("Deseja realmente remover a chave do Gemini? O assistente deixará de funcionar.")) {
      setIsSavingKey(true);
      try {
        localStorage.removeItem('VITE_GEMINI_API_KEY');
        await saveGeminiApiKey(' ');
        setHasKey(false);
        setKeyInputValue('');
        setShowSettings(false);
      } catch (err) {
        alert("Erro ao remover a chave.");
      } finally {
        setIsSavingKey(false);
      }
    }
  };

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMsg: DisplayMessage = {
      id: Date.now().toString(),
      role: 'user',
      text
    };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // 1. Monta o contexto atual (leve)
      const hoje = new Date();
      const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const dataIso = hoje.toISOString().split('T')[0];
      const snapshot = await getCurrentContextSnapshot(mesAno, dataIso);

      const promptComContexto = `[DADOS DO SEU APP AGORA]\n${snapshot}\n\n[MENSAGEM DO USUÁRIO]\n${text}`;

      // 2. Envia com fallback automático de modelo
      const responseText = await sendMessageWithFallback(history, promptComContexto, SYSTEM_PROMPT);
      const toolResults: any[] = (sendMessageWithFallback as any)._lastToolResults || [];

      // 3. Atualiza histórico para a IA "lembrar" da conversa
      setHistory(prev => [
        ...prev,
        { role: 'user', parts: [{ text: promptComContexto }] },
        { role: 'model', parts: [{ text: responseText }] },
      ]);

      // 4. Exibe resposta
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_model',
        role: 'model',
        text: responseText
      }]);

      // 5. Se houve alguma alteração no banco, exibe badge de confirmação
      if (toolResults.length > 0) {
        console.log('Dados alterados pela IA:', toolResults);
      }

    } catch (err: any) {
      const friendlyMsg = err.message?.includes('quota') || err.message?.includes('429')
        ? 'Opa, muitas requisições agora! 😅 Aguarda alguns segundos e tenta de novo.'
        : `Algo deu errado: ${err.message}`;

      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        role: 'error',
        text: friendlyMsg
      }]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  }, [history, isProcessing]);

  // Processar ?msg= da URL ao montar (vindo do Dashboard)
  useEffect(() => {
    if (initialMsgProcessed.current) return;
    const msg = searchParams.get('msg');
    if (msg) {
      initialMsgProcessed.current = true;
      // Limpa o parâmetro da URL sem redirecionar
      setSearchParams({}, { replace: true });
      // Dispara a mensagem
      sendMessage(decodeURIComponent(msg));
    }
  }, [searchParams, sendMessage, setSearchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg) return;
    setInput('');
    sendMessage(msg);
  };

  if (isCheckingKey) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'calc(100vh - 120px)',
      }}>
        <div style={{
          width: '40px', height: '40px',
          borderRadius: '50%',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Verificando configurações da IA...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'calc(100vh - 120px)',
        padding: '1.5rem',
      }}>
        <div style={{
          maxWidth: '450px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-2xl)',
          padding: '2.25rem 2rem',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: '60px', height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
            border: '1px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: 'var(--primary)',
          }}>
            <Key size={26} />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.75rem' }}>
            Assistente Financeiro IA
          </h2>
          
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 1.75rem' }}>
            Para conversar com o seu assistente, peça relatórios ou lance despesas, configure a sua chave do Gemini. 
            Ela será salva de forma segura e sincronizada com todos os seus dispositivos.
          </p>

          <form onSubmit={handleSaveKey} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Chave de API do Gemini
              </label>
              <input
                type="password"
                required
                value={keyInputValue}
                onChange={e => setKeyInputValue(e.target.value)}
                placeholder="Cole sua API Key (começa com AIzaSy...)"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border-color)')}
              />
            </div>

            <button
              type="submit"
              disabled={isSavingKey || !keyInputValue.trim()}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '0.5rem',
                opacity: isSavingKey ? 0.7 : 1,
              }}
            >
              {isSavingKey ? 'Salvando...' : 'Ativar Assistente'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Não tem uma chave? Crie uma grátis em{' '}
            <a 
              href="https://aistudio.google.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
            >
              Google AI Studio
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 120px)',
      maxHeight: '100%',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px', height: '40px',
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, var(--primary-dark), var(--primary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Sparkles size={20} color="white" />
          </div>
          <div>
            <h1 className="text-h1" style={{ margin: 0, fontSize: '1.5rem' }}>Assistente Financeiro</h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Converse, peça análises ou dê comandos diretos ao app
            </p>
          </div>
        </div>

        {/* Botão de Configuração de Chave */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            width: '40px', height: '40px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Painel de Configurações da Chave */}
      {showSettings && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          animation: 'slideDown 0.2s ease-out',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={16} color="var(--primary)" /> Configurar Chave Gemini
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', backgroundColor: 'rgba(34,197,94,0.07)', padding: '2px 8px', borderRadius: '10px' }}>
              Sincronizado via Supabase
            </span>
          </div>

          <form onSubmit={handleSaveKey} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <input
                type="password"
                required
                value={keyInputValue}
                onChange={e => setKeyInputValue(e.target.value)}
                placeholder="Cole sua nova API Key..."
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isSavingKey || !keyInputValue.trim()}
              style={{
                padding: '0.65rem 1.25rem',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: isSavingKey ? 0.7 : 1,
              }}
            >
              {isSavingKey ? 'Gravando...' : 'Salvar'}
            </button>

            <button
              type="button"
              onClick={handleRemoveKey}
              disabled={isSavingKey}
              style={{
                padding: '0.65rem 1rem',
                backgroundColor: 'rgba(239,68,68,0.1)',
                color: 'var(--danger)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Remover
            </button>
          </form>
          
          <style>{`
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Área de Mensagens */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        paddingRight: '0.25rem',
        paddingBottom: '1rem',
      }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: '0.875rem',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: '36px', height: '36px',
              borderRadius: 'var(--radius-full)',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              ...(msg.role === 'user'
                ? { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }
                : msg.role === 'error'
                  ? { background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)' }
                  : { background: 'linear-gradient(135deg, var(--primary-dark), var(--primary))', color: 'white' }
              )
            }}>
              {msg.role === 'user'
                ? <User size={16} />
                : msg.role === 'error'
                  ? <AlertCircle size={16} />
                  : <Sparkles size={16} />}
            </div>

            {/* Balão de mensagem */}
            <div style={{
              maxWidth: '72%',
              padding: '0.875rem 1.125rem',
              borderRadius: msg.role === 'user'
                ? 'var(--radius-xl) var(--radius-sm) var(--radius-xl) var(--radius-xl)'
                : 'var(--radius-sm) var(--radius-xl) var(--radius-xl) var(--radius-xl)',
              ...(msg.role === 'user'
                ? {
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                }
                : msg.role === 'error'
                  ? {
                    backgroundColor: 'rgba(239,68,68,0.07)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    color: 'var(--danger)',
                  }
                  : {
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                  }
              ),
              fontSize: '0.95rem',
              lineHeight: 1.6,
            }}>
              {msg.role === 'user' || msg.role === 'error'
                ? msg.text
                : (
                  <div style={{ margin: 0 }}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                )
              }
            </div>
          </div>
        ))}

        {/* Indicador de digitação */}
        {isProcessing && (
          <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
            <div style={{
              width: '36px', height: '36px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--primary-dark), var(--primary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={16} color="white" />
            </div>
            <div style={{
              padding: '0.875rem 1.125rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm) var(--radius-xl) var(--radius-xl) var(--radius-xl)',
              display: 'flex', gap: '6px', alignItems: 'center'
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: '8px', height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  display: 'block',
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Input — fixada no rodapé */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.875rem 1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          marginTop: '1rem',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-color)')}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isProcessing}
          placeholder={isProcessing ? 'Processando...' : 'Manda um comando ou pergunta...'}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            fontSize: '0.95rem',
            outline: 'none',
            opacity: isProcessing ? 0.6 : 1,
          }}
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          style={{
            background: (isProcessing || !input.trim()) ? 'var(--bg-main)' : 'var(--primary)',
            color: (isProcessing || !input.trim()) ? 'var(--text-muted)' : 'white',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (isProcessing || !input.trim()) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          <Send size={15} />
        </button>
      </form>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
