
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Wallet, CalendarDays, CreditCard, Bot, ArrowUpRight, ChevronLeft, ChevronRight, Calendar, FileText, LogOut, PiggyBank } from 'lucide-react';
import { MonthSelector } from '../ui/MonthSelector';
import { ThemeToggle } from '../ui/ThemeToggle';
import { GapCheckerModal } from '../ui/GapCheckerModal';
import { useMonth } from '../../contexts/MonthContext';
import { supabase } from '../../lib/supabase';
import './Layout.css';

export function Layout() {
  const { selectedDay, nextDay, prevDay, goToToday } = useMonth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { to: '/', label: 'Visão Geral', icon: <LayoutDashboard size={20} /> },
    { to: '/entradas', label: 'Entradas', icon: <ArrowUpRight size={20} /> },
    { to: '/fixos', label: 'Gastos Fixos', icon: <Wallet size={20} /> },
    { to: '/diarios', label: 'Gastos Diários', icon: <CalendarDays size={20} /> },
    { to: '/cartao-credito', label: 'Cartão de Crédito', icon: <CreditCard size={20} /> },
    { to: '/extrato', label: 'Extrato', icon: <FileText size={20} /> },
    { to: '/reserva', label: 'Reserva', icon: <PiggyBank size={20} /> },
    { to: '/assistente', label: 'Assistente', icon: <Bot size={20} /> },
  ];

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Dashboard</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>Casa & Finanças</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <ThemeToggle />

          {/* Botão Hoje */}
          <button 
            onClick={goToToday}
            style={{
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#10b981',
              color: '#fff',
              border: '2px solid #141816',
              borderRadius: '50px',
              padding: '0.45rem 1.1rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              fontSize: '0.875rem',
              height: '40px',
              transition: 'all 0.2s',
              display: 'inline-flex'
            }}
          >
            <Calendar size={16} />
            <span>Hoje</span>
          </button>

          {/* Seletor de Dia Global */}
          <div 
            className="global-day-selector"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              backgroundColor: 'var(--color-main)', 
              padding: '0.35rem 0.85rem', 
              borderRadius: '50px', 
              border: '2px solid #141816', 
              boxShadow: 'var(--shadow-sm)',
              color: '#141816',
              height: '40px'
            }}
          >
            <button onClick={prevDay} style={{ padding: '0.2rem', color: '#141816', display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}><ChevronLeft size={18} /></button>
            <span style={{ fontWeight: 700, minWidth: '55px', textAlign: 'center', color: '#141816', fontSize: '0.9rem' }}>Dia {String(selectedDay).padStart(2, '0')}</span>
            <button onClick={nextDay} style={{ padding: '0.2rem', color: '#141816', display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}><ChevronRight size={18} /></button>
          </div>

          <MonthSelector />

          {/* Botão Logout */}
          <button
            onClick={handleLogout}
            title="Sair"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: 'transparent',
              color: 'var(--color-text-muted)',
              border: '2px solid var(--color-border)',
              borderRadius: '50px',
              padding: '0.45rem 1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.8rem',
              height: '40px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#ef4444';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
            }}
          >
            <LogOut size={15} />
            <span>Sair</span>
          </button>
        </header>
        <Outlet />
      </main>
      <GapCheckerModal />
    </div>
  );
}
