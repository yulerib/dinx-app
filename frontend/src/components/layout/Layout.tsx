import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Wallet, CalendarDays, CreditCard, Bot, ArrowUpRight, FileText, LogOut, PiggyBank, StickyNote, MoreHorizontal, X } from 'lucide-react';
import { MonthSelector } from '../ui/MonthSelector';
import { ThemeToggle } from '../ui/ThemeToggle';
import { GapCheckerModal } from '../ui/GapCheckerModal';
import { M3Icon } from '../ui/M3Icon';
import { supabase } from '../../lib/supabase';
import './Layout.css';

export function Layout() {
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { to: '/', label: 'Visão Geral', icon: <M3Icon name="dashboard" lucideIcon={<LayoutDashboard size={20} />} /> },
    { to: '/entradas', label: 'Entradas', icon: <M3Icon name="north_east" lucideIcon={<ArrowUpRight size={20} />} /> },
    { to: '/fixos', label: 'Gastos Fixos', icon: <M3Icon name="account_balance_wallet" lucideIcon={<Wallet size={20} />} /> },
    { to: '/diarios', label: 'Gastos Diários', icon: <M3Icon name="calendar_today" lucideIcon={<CalendarDays size={20} />} /> },
    { to: '/cartao-credito', label: 'Cartão de Crédito', icon: <M3Icon name="credit_card" lucideIcon={<CreditCard size={20} />} /> },
    { to: '/extrato', label: 'Extrato', icon: <M3Icon name="receipt_long" lucideIcon={<FileText size={20} />} /> },
    { to: '/reserva', label: 'Reserva', icon: <M3Icon name="savings" lucideIcon={<PiggyBank size={20} />} /> },
    { to: '/observacoes', label: 'Observações', icon: <M3Icon name="sticky_note" lucideIcon={<StickyNote size={20} />} /> },
    { to: '/assistente', label: 'Assistente', icon: <M3Icon name="smart_toy" lucideIcon={<Bot size={20} />} /> },
  ];

  // Itens principais para a Bottom Nav Bar (Máximo 4)
  const primaryNavItems = navItems.slice(0, 4);
  // Itens adicionais que irão para a Bottom Sheet no celular
  const secondaryNavItems = navItems.slice(4);

  return (
    <div className="app-container">
      {/* Sidebar Desktop (Navigation Drawer M3) */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Dinx App</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>Controle financeiro</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <div className="nav-icon-wrapper">{item.icon}</div>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="nav-link logout-btn"
            title="Sair"
            style={{ border: 'none', background: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}
          >
            <div className="nav-icon-wrapper">
              <LogOut size={20} />
            </div>
            <span className="nav-label">Sair</span>
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        {/* Header Superior */}
        <header className="app-header">
          <div className="header-mobile-brand">
            <h2>Dashboard</h2>
            <p className="text-muted" style={{ fontSize: '0.8rem' }}>Casa & Finanças</p>
          </div>
          
          <div className="header-controls">
            <div className="theme-toggle-container">
              <ThemeToggle />
            </div>
            <div className="month-selector-container">
              <MonthSelector />
            </div>
          </div>
        </header>
        <Outlet />
      </main>

      {/* --- MOBILE NAVIGATION BAR (M3 BOTTOM NAV) --- */}
      <div className="m3-bottom-nav">
        {primaryNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `m3-bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <div className="m3-bottom-nav-icon-container">
              {item.icon}
            </div>
            <span className="m3-bottom-nav-label">{item.label}</span>
          </NavLink>
        ))}
        {/* Botão "Mais" */}
        <button 
          className={`m3-bottom-nav-item ${isBottomSheetOpen ? 'active' : ''}`}
          onClick={() => setIsBottomSheetOpen(true)}
          aria-label="Abrir menu de opções"
        >
          <div className="m3-bottom-nav-icon-container">
            <M3Icon name="more_horiz" lucideIcon={<MoreHorizontal size={20} />} />
          </div>
          <span className="m3-bottom-nav-label">Mais</span>
        </button>
      </div>

      {/* --- MOBILE BOTTOM SHEET DIALOG --- */}
      <div className={`bottom-sheet-wrapper ${isBottomSheetOpen ? 'open' : ''}`}>
        <div 
          className="bottom-sheet-scrim" 
          onClick={() => setIsBottomSheetOpen(false)} 
        />
        <div className="bottom-sheet-content">
          <div className="bottom-sheet-drag-handle" />
          <div className="bottom-sheet-header">
            <h3>Mais Opções</h3>
            <button 
              className="bottom-sheet-close-btn"
              onClick={() => setIsBottomSheetOpen(false)}
            >
              <M3Icon name="close" lucideIcon={<X size={20} />} />
            </button>
          </div>
          <div className="bottom-sheet-menu-list">
            {secondaryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `bottom-sheet-menu-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsBottomSheetOpen(false)}
              >
                <div className="bottom-sheet-icon-wrapper">{item.icon}</div>
                <span>{item.label}</span>
              </NavLink>
            ))}
            {/* Item Logout no celular */}
            <button
              onClick={() => {
                setIsBottomSheetOpen(false);
                handleLogout();
              }}
              className="bottom-sheet-menu-item bottom-sheet-logout"
            >
              <div className="bottom-sheet-icon-wrapper">
                <M3Icon name="logout" lucideIcon={<LogOut size={20} />} />
              </div>
              <span>Sair do Aplicativo</span>
            </button>
          </div>
        </div>
      </div>

      <GapCheckerModal />
    </div>
  );
}
