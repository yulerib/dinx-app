import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, ArrowRight, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Login.css';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    setIsLoading(false);

    if (authError) {
      setError('E-mail ou senha incorretos. Tente novamente.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    } else {
      onLogin();
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-background">
        <div className="bg-glow bg-glow-1"></div>
        <div className="bg-glow bg-glow-2"></div>
      </div>

      <div className={`login-card ${isShaking ? 'shake' : ''}`}>
        <div className="login-header">
          <div className="lock-icon-container">
            <Lock size={24} className="lock-icon" />
          </div>
          <h1>Casa &amp; Finanças</h1>
          <p className="login-subtitle">Insira suas credenciais para entrar no painel</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-container">
            <Mail size={16} className="input-icon" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              placeholder="Seu e-mail..."
              autoFocus
              autoComplete="email"
              className={error ? 'input-error input-with-icon' : 'input-with-icon'}
            />
          </div>

          <div className="input-container">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="Sua senha..."
              autoComplete="current-password"
              className={error ? 'input-error' : ''}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div className="login-error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="login-submit-btn" disabled={isLoading}>
            <span>{isLoading ? 'Entrando...' : 'Entrar'}</span>
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
