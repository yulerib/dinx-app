import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { GastosFixos } from './pages/GastosFixos';
import { GastosDiarios } from './pages/GastosDiarios';
import { CartaoCredito } from './pages/CartaoCredito';
import { Entradas } from './pages/Entradas';
import { Extrato } from './pages/Extrato';
import { Assistente } from './pages/Assistente';
import { Reserva } from './pages/Reserva';
import { MonthProvider } from './contexts/MonthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Login } from './pages/Login';
import { supabase } from './lib/supabase';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verifica sessão existente ao carregar o app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setIsLoading(false);
    });

    // Escuta mudanças de sessão (login, logout, expiração)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return null; // Aguarda verificação da sessão antes de renderizar
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <ThemeProvider>
      <MonthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="entradas" element={<Entradas />} />
              <Route path="fixos" element={<GastosFixos />} />
              <Route path="diarios" element={<GastosDiarios />} />
              <Route path="cartao-credito" element={<CartaoCredito />} />
              <Route path="extrato" element={<Extrato />} />
              <Route path="reserva" element={<Reserva />} />
              <Route path="assistente" element={<Assistente />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MonthProvider>
    </ThemeProvider>
  );
}

export default App;
