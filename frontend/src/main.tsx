import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/roboto-flex/full.css';
import 'material-symbols';
import './tokens.css';
import './index.css';
import App from './App.tsx';
import { pingSupabase } from './lib/keepAlive'

// Ping silencioso ao Supabase para evitar pausa por inatividade (plano gratuito)
pingSupabase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
