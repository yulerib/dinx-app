import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { useMonth } from '../contexts/MonthContext';
import { simulacoesService } from '../services/simulacoes';
import type { SimulationBaseData, SimulatedItem, SimulationCategory } from '../services/simulacoes';
import {
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Plus,
  Lock,
  Calendar,
  Sparkles,
  Eye,
  Sliders
} from 'lucide-react';
import './Simulacoes.css';

export function Simulacoes() {
  const { currentMonth } = useMonth();
  const year = currentMonth.getFullYear();
  const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${monthStr}`;

  const [isLoading, setIsLoading] = useState(true);
  const [baseData, setBaseData] = useState<SimulationBaseData | null>(null);

  // Simulation State
  const [simulatedItems, setSimulatedItems] = useState<SimulatedItem[]>([]);
  const [limiteDiarioSimulado, setLimiteDiarioSimulado] = useState<number>(0);
  const [customDailyExpenses, setCustomDailyExpenses] = useState<{ [dia: number]: number }>({});

  // Mobile View Switcher: 'timeline' (Day-by-Day view) vs 'manager' (Settings & Items)
  const [mobileView, setMobileView] = useState<'timeline' | 'manager'>('timeline');

  // Category Filter in Manager Tab
  const [managerTab, setManagerTab] = useState<'todos' | 'entradas' | 'fixos' | 'diarios' | 'custom'>('todos');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Modal State for New Custom Item
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTipo, setNewTipo] = useState<SimulationCategory>('entrada');
  const [newDescricao, setNewDescricao] = useState('');
  const [newValor, setNewValor] = useState<number>(0);
  const [newDia, setNewDia] = useState<number>(15);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch Base Data
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const data = await simulacoesService.loadBaseData(currentMonth);
      setBaseData(data);
      setSimulatedItems(data.items.map(item => ({ ...item })));
      setLimiteDiarioSimulado(data.limiteDiarioPadrao);
      setCustomDailyExpenses({});
    } catch (error) {
      console.error('Erro ao carregar dados para simulação:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mesAno]);

  // Recalculate Simulation Timeline in Real-Time
  const { points: timelinePoints, summary: simSummary } = useMemo(() => {
    if (!baseData) {
      return {
        points: [],
        summary: {
          saldoInicial: 0,
          saldoFinalSimulado: 0,
          saldoFinalOficial: 0,
          diferenca: 0,
          totalEntradasSimuladas: 0,
          totalSaidasFixasSimuladas: 0,
          totalSaidasDiariasSimuladas: 0,
          totalEntradasOficiais: 0,
          totalSaidasFixasOficiais: 0,
          totalSaidasDiariasOficiais: 0
        }
      };
    }

    return simulacoesService.calculateSimulationTimeline(
      baseData,
      simulatedItems,
      limiteDiarioSimulado,
      customDailyExpenses
    );
  }, [baseData, simulatedItems, limiteDiarioSimulado, customDailyExpenses]);

  // Reset to Original Baseline
  const handleReset = () => {
    if (!baseData) return;
    setSimulatedItems(baseData.items.map(item => ({ ...item })));
    setLimiteDiarioSimulado(baseData.limiteDiarioPadrao);
    setCustomDailyExpenses({});
  };

  // Change Value of an Item
  const handleChangeValue = (id: string, value: number) => {
    setSimulatedItems(prev =>
      prev.map(item => (item.id === id ? { ...item, valorSimulado: value } : item))
    );
  };

  // Change Day of an Item
  const handleChangeDay = (id: string, day: number) => {
    const validDay = Math.max(1, Math.min(baseData?.daysInMonth || 31, day));
    setSimulatedItems(prev =>
      prev.map(item => (item.id === id ? { ...item, diaSimulado: validDay } : item))
    );
  };

  // Add Custom Item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescricao.trim() || newValor <= 0) return;

    const newItem: SimulatedItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tipo: newTipo,
      descricao: newDescricao.trim(),
      valorOriginal: newValor,
      valorSimulado: newValor,
      diaPrevistoOriginal: newDia,
      diaSimulado: newDia,
      isOficialEfetuado: false,
      isCustom: true,
      ativo: true,
      detalhes: 'Simulação personalizada'
    };

    setSimulatedItems(prev => [newItem, ...prev]);
    setIsAddModalOpen(false);
    setNewDescricao('');
    setNewValor(0);
    setNewDia(15);
  };

  // Quick Open Modal with preselected day
  const handleOpenAddForDay = (day: number) => {
    setNewDia(day);
    setNewDescricao('');
    setNewValor(0);
    setIsAddModalOpen(true);
  };

  // Format currency helper
  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Filter items for the manager list
  const filteredItems = useMemo(() => {
    if (managerTab === 'todos') return simulatedItems;
    if (managerTab === 'entradas') return simulatedItems.filter(i => i.tipo === 'entrada');
    if (managerTab === 'fixos') return simulatedItems.filter(i => i.tipo === 'fixo' || i.tipo === 'cartao');
    if (managerTab === 'diarios') return simulatedItems.filter(i => i.tipo === 'diario');
    if (managerTab === 'custom') return simulatedItems.filter(i => i.isCustom);
    return simulatedItems;
  }, [simulatedItems, managerTab]);

  return (
    <div className="sim-container">
      {/* ----------------- HEADER & ACTIONS ----------------- */}
      <div className="sim-header-row">
        <div>
          <h1 className="text-h1" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Sparkles size={28} color="var(--primary)" />
            Simulador Financeiro
          </h1>
          <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Simule cenários e teste o impacto de alterações em{' '}
            {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} no saldo diário.
          </p>
        </div>

        <div className="sim-header-actions">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            title="Restaurar todos os valores para o padrão oficial do banco"
          >
            <RotateCcw size={16} />
            Restaurar Padrão
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            disabled={isLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={18} />
            Nova Movimentação
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Carregando dados para simulação...
        </div>
      ) : (
        <>
          {/* ----------------- SUMMARY METRIC CARDS ----------------- */}
          <div className="sim-metrics-grid">
            {/* Saldo Final Simulado */}
            <div className="sim-metric-card">
              <div className="sim-metric-header">
                <span className="sim-metric-title">Saldo Final Simulado</span>
                <Sparkles size={16} color="var(--primary)" />
              </div>
              <div
                className="sim-metric-value"
                style={{
                  color: simSummary.saldoFinalSimulado >= 0 ? 'var(--color-verde-entradas)' : 'var(--color-vermelho-fixos)'
                }}
              >
                {formatBRL(simSummary.saldoFinalSimulado)}
              </div>
              <div
                className={`sim-metric-diff ${
                  simSummary.diferenca > 0
                    ? 'sim-diff-positive'
                    : simSummary.diferenca < 0
                    ? 'sim-diff-negative'
                    : 'sim-diff-neutral'
                }`}
              >
                {simSummary.diferenca > 0 ? (
                  <TrendingUp size={14} />
                ) : simSummary.diferenca < 0 ? (
                  <TrendingDown size={14} />
                ) : null}
                <span>
                  {simSummary.diferenca > 0 ? '+' : ''}
                  {formatBRL(simSummary.diferenca)} vs Oficial
                </span>
              </div>
            </div>

            {/* Entradas Simuladas */}
            <div className="sim-metric-card">
              <div className="sim-metric-header">
                <span className="sim-metric-title">Entradas Simuladas</span>
                <TrendingUp size={16} color="var(--color-verde-entradas)" />
              </div>
              <div className="sim-metric-value" style={{ color: 'var(--color-verde-entradas)' }}>
                {formatBRL(simSummary.totalEntradasSimuladas)}
              </div>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                Oficial: {formatBRL(simSummary.totalEntradasOficiais)}
              </span>
            </div>

            {/* Saídas Fixas Simuladas */}
            <div className="sim-metric-card">
              <div className="sim-metric-header">
                <span className="sim-metric-title">Saídas Fixas</span>
                <TrendingDown size={16} color="var(--color-vermelho-fixos)" />
              </div>
              <div className="sim-metric-value" style={{ color: 'var(--color-vermelho-fixos)' }}>
                {formatBRL(simSummary.totalSaidasFixasSimuladas)}
              </div>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                Oficial: {formatBRL(simSummary.totalSaidasFixasOficiais)}
              </span>
            </div>

            {/* Saídas Diárias Simuladas */}
            <div className="sim-metric-card">
              <div className="sim-metric-header">
                <span className="sim-metric-title">Saídas Diárias</span>
                <Calendar size={16} color="var(--color-laranja-diarios, var(--warning))" />
              </div>
              <div className="sim-metric-value" style={{ color: 'var(--color-laranja-diarios, var(--warning))' }}>
                {formatBRL(simSummary.totalSaidasDiariasSimuladas)}
              </div>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                Oficial: {formatBRL(simSummary.totalSaidasDiariasOficiais)}
              </span>
            </div>
          </div>

          {/* ----------------- MOBILE VIEW SWITCHER TABS ----------------- */}
          <div className="sim-mobile-switcher">
            <button
              className={`sim-mobile-switch-btn ${mobileView === 'timeline' ? 'active' : ''}`}
              onClick={() => setMobileView('timeline')}
            >
              <Eye size={16} />
              Saldo Dia a Dia
            </button>
            <button
              className={`sim-mobile-switch-btn ${mobileView === 'manager' ? 'active' : ''}`}
              onClick={() => setMobileView('manager')}
            >
              <Sliders size={16} />
              Ajustes ({simulatedItems.length})
            </button>
          </div>

          {/* ----------------- MAIN TWO-COLUMN GRID ----------------- */}
          <div className="sim-main-grid">
            {/* COLUMN 1: DAY-BY-DAY BALANCE TIMELINE */}
            <div
              className="sim-table-card"
              style={{ display: isMobile && mobileView !== 'timeline' ? 'none' : 'block' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Eye size={18} color="var(--primary)" />
                  <h3 className="text-h3" style={{ margin: 0, fontSize: '1.1rem' }}>
                    Linha do Tempo (Saldo Dia a Dia)
                  </h3>
                </div>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Clique em um dia para detalhes
                </span>
              </div>

              {/* Timeline Cards List (Desktop & Mobile) */}
              <div className="sim-timeline-list">
                {timelinePoints.map(point => {
                  const saldoInicial = simSummary.saldoInicial;
                  const saldoPct =
                    saldoInicial > 0 ? point.saldoConta / saldoInicial : point.saldoConta >= 0 ? 1 : -1;
                  let saldoColor = 'var(--color-verde-entradas)';
                  if (saldoPct < 0) saldoColor = 'var(--color-vermelho-fixos)';
                  else if (saldoPct < 0.05) saldoColor = 'var(--color-laranja-diarios, var(--warning))';
                  else if (saldoPct < 0.2) saldoColor = 'var(--warning)';

                  const totalSaidasDia = point.totalSaidasFixas + point.totalSaidasDiarias;

                  return (
                    <div
                      key={point.dia}
                      className={`sim-day-card ${point.isToday ? 'is-today' : ''}`}
                      onClick={() => setSelectedDay(point.dia)}
                      title={`Clique para ver extrato e detalhes do Dia ${point.diaFormatado}`}
                    >
                      <div className="sim-day-left">
                        <div className="sim-day-pill">
                          <span className="day-num">{point.diaFormatado}</span>
                          <span className="day-wk">{point.diaSemana}</span>
                        </div>

                        <div className="sim-day-chips">
                          {point.totalEntradas > 0 && (
                            <span className="sim-chip" style={{ color: 'var(--color-verde-entradas)' }}>
                              +{formatBRL(point.totalEntradas)}
                            </span>
                          )}
                          {totalSaidasDia > 0 && (
                            <span className="sim-chip" style={{ color: 'var(--color-vermelho-fixos)' }}>
                              -{formatBRL(totalSaidasDia)}
                            </span>
                          )}
                          {point.totalEntradas === 0 && totalSaidasDia === 0 && (
                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                              Sem movimentações
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="sim-day-right">
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Saldo acumulado</span>
                        <span className="sim-day-balance" style={{ color: saldoColor }}>
                          {formatBRL(point.saldoConta)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 2: SIMULATION CONTROLS & MANAGEMENT */}
            <div
              className="sim-manager-card"
              style={{ display: isMobile && mobileView !== 'manager' ? 'none' : 'block' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sliders size={18} color="var(--primary)" />
                  <h3 className="text-h3" style={{ margin: 0, fontSize: '1.1rem' }}>
                    Ajustes da Simulação
                  </h3>
                </div>
              </div>

              {/* Tabs for Category Filters */}
              <div className="sim-manager-tabs">
                <button
                  className={`sim-tab-btn ${managerTab === 'todos' ? 'active' : ''}`}
                  onClick={() => setManagerTab('todos')}
                >
                  Todos ({simulatedItems.length})
                </button>
                <button
                  className={`sim-tab-btn ${managerTab === 'entradas' ? 'active' : ''}`}
                  onClick={() => setManagerTab('entradas')}
                >
                  Entradas
                </button>
                <button
                  className={`sim-tab-btn ${managerTab === 'fixos' ? 'active' : ''}`}
                  onClick={() => setManagerTab('fixos')}
                >
                  Fixos
                </button>
                <button
                  className={`sim-tab-btn ${managerTab === 'diarios' ? 'active' : ''}`}
                  onClick={() => setManagerTab('diarios')}
                >
                  Diários
                </button>
                <button
                  className={`sim-tab-btn ${managerTab === 'custom' ? 'active' : ''}`}
                  onClick={() => setManagerTab('custom')}
                >
                  Extras
                </button>
              </div>

              {/* Quick Settings: Daily Limit Simulation */}
              <div
                style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: '8px',
                  background: 'var(--bg-muted, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  marginBottom: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Meta Diária Projetada:</span>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.725rem' }}>
                    Aplicada nos dias futuros sem registros.
                  </p>
                </div>
                <div style={{ width: '130px' }}>
                  <CurrencyInput
                    value={limiteDiarioSimulado}
                    onChange={val => setLimiteDiarioSimulado(val)}
                  />
                </div>
              </div>

              {/* List of Simulated Items */}
              <div className="sim-items-list">
                {filteredItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Nenhuma movimentação nesta categoria.
                  </div>
                ) : (
                  filteredItems.map(item => {
                    const isLocked = item.isOficialEfetuado;

                    return (
                      <div key={item.id} className="sim-item-row">
                        <div className="sim-item-info">
                          <div className="sim-item-title-row">
                            <span className="sim-item-title">{item.descricao}</span>

                            {isLocked ? (
                              <span className="sim-badge sim-badge-locked" title="Lançamento oficial efetuado">
                                <Lock size={10} />
                                Oficial
                              </span>
                            ) : item.isCustom ? (
                              <span className="sim-badge sim-badge-custom">
                                <Sparkles size={10} />
                                Extra
                              </span>
                            ) : (
                              <span className="sim-badge sim-badge-simulated">
                                <Sliders size={10} />
                                Simulado
                              </span>
                            )}
                          </div>

                          <div className="sim-item-details">
                            {item.tipo === 'entrada' ? 'Receita' : item.tipo === 'cartao' ? 'Fatura Cartão' : 'Despesa'} • {item.detalhes || ''}
                            {item.valorSimulado !== item.valorOriginal && (
                              <span style={{ marginLeft: '0.35rem', color: 'var(--primary)', fontWeight: 600 }}>
                                (Original: {formatBRL(item.valorOriginal)})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Controls Column */}
                        <div className="sim-item-controls">
                          {isLocked ? (
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: item.tipo === 'entrada' ? 'var(--color-verde-entradas)' : 'var(--color-vermelho-fixos)' }}>
                                {formatBRL(item.valorSimulado)}
                              </span>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Dia {String(item.diaSimulado).padStart(2, '0')}
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Editable Day */}
                              <input
                                type="number"
                                min={1}
                                max={baseData?.daysInMonth || 31}
                                value={item.diaSimulado}
                                onChange={e => handleChangeDay(item.id, Number(e.target.value))}
                                className="sim-input-day"
                                title="Alterar dia previsto na simulação"
                              />

                              {/* Editable Value with full width */}
                              <div className="sim-input-currency-wrapper">
                                <CurrencyInput
                                  value={item.valorSimulado}
                                  onChange={val => handleChangeValue(item.id, val)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ----------------- MOBILE FLOATING ACTION BUTTON (FAB) ----------------- */}
          <button
            className="sim-fab"
            onClick={() => setIsAddModalOpen(true)}
            aria-label="Adicionar movimentação na simulação"
            title="Nova Movimentação"
          >
            <Plus size={24} />
          </button>

          {/* ----------------- MODAL: ADICIONAR NOVA MOVIMENTAÇÃO SIMULADA ----------------- */}
          {isAddModalOpen && (
            <Modal isOpen={true} onClose={() => setIsAddModalOpen(false)} title="Nova Movimentação de Simulação">
              <form onSubmit={handleAddCustomItem} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>
                    Tipo de Movimentação
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setNewTipo('entrada')}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '6px',
                        border: `1px solid ${newTipo === 'entrada' ? 'var(--color-verde-entradas)' : 'var(--border-color)'}`,
                        backgroundColor: newTipo === 'entrada' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        color: newTipo === 'entrada' ? 'var(--color-verde-entradas)' : 'var(--text-color)',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      + Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTipo('fixo')}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '6px',
                        border: `1px solid ${newTipo === 'fixo' ? 'var(--color-vermelho-fixos)' : 'var(--border-color)'}`,
                        backgroundColor: newTipo === 'fixo' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                        color: newTipo === 'fixo' ? 'var(--color-vermelho-fixos)' : 'var(--text-color)',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      - Saída Fixa
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTipo('diario')}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '6px',
                        border: `1px solid ${newTipo === 'diario' ? 'var(--warning)' : 'var(--border-color)'}`,
                        backgroundColor: newTipo === 'diario' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                        color: newTipo === 'diario' ? 'var(--warning)' : 'var(--text-color)',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      - Saída Diária
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>
                    Descrição da Simulação
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Venda de item, Bônus, Manutenção do Carro..."
                    value={newDescricao}
                    onChange={e => setNewDescricao(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-color)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>
                      Valor (R$)
                    </label>
                    <CurrencyInput value={newValor} onChange={setNewValor} />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>
                      Dia Previsto (1 a {baseData?.daysInMonth || 31})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={baseData?.daysInMonth || 31}
                      required
                      value={newDia}
                      onChange={e => setNewDia(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-color)',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" type="submit" disabled={!newDescricao.trim() || newValor <= 0}>
                    Adicionar à Simulação
                  </Button>
                </div>
              </form>
            </Modal>
          )}

          {/* ----------------- MODAL: DETALHES DO DIA (EXTRATO DO DIA) ----------------- */}
          {selectedDay !== null &&
            (() => {
              const point = timelinePoints.find(p => p.dia === selectedDay);
              if (!point) return null;

              const saldoInicial = simSummary.saldoInicial;
              const saldoPct =
                saldoInicial > 0 ? point.saldoConta / saldoInicial : point.saldoConta >= 0 ? 1 : -1;
              let saldoColor = 'var(--color-verde-entradas)';
              if (saldoPct < 0) saldoColor = 'var(--color-vermelho-fixos)';
              else if (saldoPct < 0.05) saldoColor = 'var(--color-laranja-diarios, var(--warning))';
              else if (saldoPct < 0.2) saldoColor = 'var(--warning)';

              return (
                <Modal
                  isOpen={true}
                  onClose={() => setSelectedDay(null)}
                  title={`Detalhes - Dia ${point.diaFormatado} (${point.diaSemana})`}
                >
                  <div>
                    {point.entradas.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--color-verde-entradas)',
                            textTransform: 'uppercase',
                            borderBottom: '1px solid var(--border-color)',
                            paddingBottom: '0.25rem',
                            marginBottom: '0.35rem'
                          }}
                        >
                          Entradas
                        </div>
                        {point.entradas.map((item, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: '0.35rem 0',
                              fontSize: '0.9rem',
                              fontWeight: item.isExecutado ? 600 : 400
                            }}
                          >
                            <span>
                              {item.descricao} {item.isExecutado ? '(Oficial)' : '(Simulado)'}
                            </span>
                            <span style={{ color: 'var(--color-verde-entradas)' }}>+{formatBRL(item.valor)}</span>
                          </div>
                        ))}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            paddingTop: '0.2rem'
                          }}
                        >
                          Total: <strong style={{ marginLeft: '0.35rem', color: 'var(--color-verde-entradas)' }}>+{formatBRL(point.totalEntradas)}</strong>
                        </div>
                      </div>
                    )}

                    {point.saidasFixas.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--color-vermelho-fixos)',
                            textTransform: 'uppercase',
                            borderBottom: '1px solid var(--border-color)',
                            paddingBottom: '0.25rem',
                            marginBottom: '0.35rem'
                          }}
                        >
                          Saídas Fixas
                        </div>
                        {point.saidasFixas.map((item, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: '0.35rem 0',
                              fontSize: '0.9rem',
                              fontWeight: item.isExecutado ? 600 : 400
                            }}
                          >
                            <span>
                              {item.descricao} {item.isExecutado ? '(Oficial)' : '(Simulado)'}
                            </span>
                            <span style={{ color: 'var(--color-vermelho-fixos)' }}>-{formatBRL(item.valor)}</span>
                          </div>
                        ))}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            paddingTop: '0.2rem'
                          }}
                        >
                          Total: <strong style={{ marginLeft: '0.35rem', color: 'var(--color-vermelho-fixos)' }}>-{formatBRL(point.totalSaidasFixas)}</strong>
                        </div>
                      </div>
                    )}

                    {point.saidasDiarias.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--color-laranja-diarios, var(--warning))',
                            textTransform: 'uppercase',
                            borderBottom: '1px solid var(--border-color)',
                            paddingBottom: '0.25rem',
                            marginBottom: '0.35rem'
                          }}
                        >
                          Saídas Diárias
                        </div>
                        {point.saidasDiarias.map((item, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: '0.35rem 0',
                              fontSize: '0.9rem',
                              fontWeight: item.isExecutado ? 600 : 400
                            }}
                          >
                            <span>
                              {item.descricao} {item.isExecutado ? '(Oficial)' : '(Simulado)'}
                            </span>
                            <span style={{ color: 'var(--color-laranja-diarios, var(--warning))' }}>-{formatBRL(item.valor)}</span>
                          </div>
                        ))}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            paddingTop: '0.2rem'
                          }}
                        >
                          Total: <strong style={{ marginLeft: '0.35rem', color: 'var(--color-laranja-diarios, var(--warning))' }}>-{formatBRL(point.totalSaidasDiarias)}</strong>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 0',
                        borderTop: '2px solid var(--border-color)',
                        marginTop: '0.5rem',
                        fontSize: '1.05rem',
                        fontWeight: 700
                      }}
                    >
                      <span>Saldo ao Final do Dia:</span>
                      <span style={{ color: saldoColor }}>{formatBRL(point.saldoConta)}</span>
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                      <Button
                        variant="outline"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        onClick={() => {
                          const diaTarget = point.dia;
                          setSelectedDay(null);
                          handleOpenAddForDay(diaTarget);
                        }}
                      >
                        <Plus size={16} />
                        Adicionar Simulação no Dia {point.diaFormatado}
                      </Button>
                    </div>
                  </div>
                </Modal>
              );
            })()}
        </>
      )}
    </div>
  );
}
