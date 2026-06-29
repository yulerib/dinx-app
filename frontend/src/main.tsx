import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { pingSupabase } from './lib/keepAlive'

// Ping silencioso ao Supabase para evitar pausa por inatividade (plano gratuito)
pingSupabase();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
