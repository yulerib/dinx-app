import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { BalanceProgressBar } from '../components/ui/BalanceProgressBar';
import { WarningTooltip } from '../components/ui/WarningTooltip';
import { TransactionListItem } from '../components/ui/TransactionListItem';
import { Plus, Check, Loader2, Zap, Trash2, ListPlus, Edit2, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { gastosDiariosService } from '../services/gastosDiarios';
import { chartsService } from '../services/charts';
import type { ChartDataPoint } from '../services/charts';
import type { CategoriaComRegistroDiario, RegistroDiario } from '../types/database.types';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';

export function GastosDiarios() {
  const { currentMonth, selectedDay, nextDay, prevDay, goToToday } = useMonth();
  const year = currentMonth.getFullYear();
  const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${month}`;
  
  const daysInMonth = new Date(year, currentMonth.getMonth() + 1, 0).getDate();

  const dataIso = `${mesAno}-${String(selectedDay).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState<'lancamentos' | 'extrato' | 'resumo' | 'graficos'>('lancamentos');

  const [categorias, setCategorias] = useState<CategoriaComRegistroDiario[]>([]);
  const [registrosMensais, setRegistrosMensais] = useState<RegistroDiario[]>([]);
  const [registrosPontuais, setRegistrosPontuais] = useState<RegistroDiario[]>([]);
  const [chartDataMensal, setChartDataMensal] = useState<ChartDataPoint[]>([]);
  const [allRegistrosAno, setAllRegistrosAno] = useState<RegistroDiario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros de Gráfico
  const [chartView, setChartView] = useState<'mensal' | 'diario'>('diario');
  const [selectedChartCat, setSelectedChartCat] = useState<string>('all');

  // Modals
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [catToEdit, setCatToEdit] = useState<CategoriaComRegistroDiario | null>(null);
  const [nomeCat, setNomeCat] = useState('');
  const [limiteCat, setLimiteCat] = useState(0);
  
  const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
  const [isPontualModalOpen, setIsPontualModalOpen] = useState(false);
  const [activeCategoria, setActiveCategoria] = useState<CategoriaComRegistroDiario | null>(null);
  const [registroToEdit, setRegistroToEdit] = useState<RegistroDiario | null>(null);
  const [descLancamento, setDescLancamento] = useState('');
  const [valorLancamento, setValorLancamento] = useState(0);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [cats, registrosMes, cData, allRegs, pontuaisDia] = await Promise.all([
        gastosDiariosService.fetchCategoriasComRegistroDia(dataIso),
        gastosDiariosService.fetchRegistrosDoMes(mesAno),
        chartsService.getDashboardChartsData(currentMonth),
        gastosDiariosService.fetchRegistrosDoAno(year),
        gastosDiariosService.fetchRegistrosPontuaisDia(dataIso)
      ]);
      setCategorias(cats);
      setRegistrosMensais(registrosMes);
      setChartDataMensal(cData);
      setAllRegistrosAno(allRegs);
      setRegistrosPontuais(pontuaisDia);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dataIso, mesAno]);

  // --- Cálculos Mensais Globais ---
  const totalPrevisto = categorias.reduce((acc, c) => acc + c.limite_mensal, 0);
  const totalPontuaisMensal = registrosMensais
    .filter(r => r.id_categoria === null)
    .reduce((sum, r) => sum + r.valor_gasto, 0);

  const totalProjetado = categorias.reduce((acc, c) => {
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === currentMonth.getMonth();
    const isFutureMonth = currentMonth > now;
    const isPastMonth = !isCurrentMonth && !isFutureMonth;
    const todayDay = now.getDate();

    let catTotal = 0;
    for (let dia = 1; dia <= daysInMonth; dia++) {
      const dataIsoLoop = `${mesAno}-${String(dia).padStart(2, '0')}`;
      const rDia = registrosMensais.filter(r => r.id_categoria === c.id && r.data === dataIsoLoop);
      
      if (rDia.length > 0) {
        catTotal += rDia.reduce((sum, r) => sum + r.valor_gasto, 0);
      } else {
        if (isFutureMonth) {
          catTotal += c.limite_mensal / 31;
        } else if (isPastMonth) {
          catTotal += 0;
        } else {
          if (dia < todayDay) {
            catTotal += 0;
          } else {
            catTotal += c.limite_mensal / 31;
          }
        }
      }
    }
    return acc + catTotal;
  }, 0) + totalPontuaisMensal;

  const saldoGlobal = totalPrevisto - totalProjetado;

  // --- Cálculos do Dia Específico ---
  const previstoDia = categorias.reduce((acc, c) => acc + (c.limite_mensal / 31), 0);
  const realizadoDia = registrosMensais.filter(r => r.data === dataIso).reduce((acc, r) => acc + r.valor_gasto, 0);
  const saldoDia = previstoDia - realizadoDia;

  // --- Calcular dias com lacunas / não informados no mês atual ---
  const getDiasNaoInformados = () => {
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === currentMonth.getMonth();
    const isFutureMonth = currentMonth > now;

    let lastDayToCheck = 0;
    if (isFutureMonth) {
      lastDayToCheck = 0;
    } else if (isCurrentMonth) {
      lastDayToCheck = now.getDate() - 1; // até ontem
    } else {
      lastDayToCheck = daysInMonth; // último dia do mês
    }

    const diasComLacuna = new Set<string>();
    if (lastDayToCheck >= 1 && categorias.length > 0) {
      for (let dia = 1; dia <= lastDayToCheck; dia++) {
        const dataIsoLoop = `${mesAno}-${String(dia).padStart(2, '0')}`;
        categorias.forEach(cat => {
          const hasRecord = registrosMensais.some(r => r.id_categoria === cat.id && r.data === dataIsoLoop);
          if (!hasRecord) {
            diasComLacuna.add(dataIsoLoop);
          }
        });
      }
    }
    return Array.from(diasComLacuna);
  };

  const diasNaoInformados = getDiasNaoInformados();
  const totalDiasNaoInformados = diasNaoInformados.length;

  // --- Calcular dias não informados por categoria específica ---
  const getCatDiasNaoInformados = (catId: string) => {
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === currentMonth.getMonth();
    const isFutureMonth = currentMonth > now;

    let lastDayToCheck = 0;
    if (isFutureMonth) {
      lastDayToCheck = 0;
    } else if (isCurrentMonth) {
      lastDayToCheck = now.getDate() - 1; // até ontem
    } else {
      lastDayToCheck = daysInMonth;
    }

    const dias = [];
    if (lastDayToCheck >= 1) {
      for (let dia = 1; dia <= lastDayToCheck; dia++) {
        const dataIsoLoop = `${mesAno}-${String(dia).padStart(2, '0')}`;
        const hasRecord = registrosMensais.some(r => r.id_categoria === catId && r.data === dataIsoLoop);
        if (!hasRecord) {
          dias.push(dataIsoLoop);
        }
      }
    }
    return dias;
  };

  // --- Calcular meses com lacunas no ano ---
  const getMesesComLacuna = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const meses: string[] = [];
    const maxMonthToCheck = currentMonth.getFullYear() === currentYear ? currentMonth.getMonth() : 11;
    
    for (let mIdx = 0; mIdx <= maxMonthToCheck; mIdx++) {
      const loopMonthStr = String(mIdx + 1).padStart(2, '0');
      const loopMesAno = `${currentYear}-${loopMonthStr}`;
      
      const isCurrentMonth = currentYear === now.getFullYear() && mIdx === now.getMonth();
      
      let lastDayToCheck = 0;
      if (isCurrentMonth) {
        lastDayToCheck = now.getDate() - 1; // até ontem
      } else {
        lastDayToCheck = new Date(currentYear, mIdx + 1, 0).getDate(); // último dia do mês
      }
      
      if (lastDayToCheck >= 1 && categorias.length > 0) {
        let loopMonthHasGap = false;
        
        for (let dia = 1; dia <= lastDayToCheck; dia++) {
          const dataIsoLoop = `${loopMesAno}-${String(dia).padStart(2, '0')}`;
          
          for (let cat of categorias) {
            const hasRecord = allRegistrosAno.some(r => r.id_categoria === cat.id && r.data === dataIsoLoop);
            if (!hasRecord) {
              loopMonthHasGap = true;
              break;
            }
          }
          if (loopMonthHasGap) break;
        }
        
        if (loopMonthHasGap) {
          meses.push(loopMesAno);
        }
      }
    }
    return meses;
  };

  const mesesComLacuna = getMesesComLacuna();

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Manipuladores de Categoria
  const handleOpenNewCat = () => {
    setCatToEdit(null);
    setNomeCat('');
    setLimiteCat(0);
    setIsCatModalOpen(true);
  };

  const handleOpenEditCat = (cat: CategoriaComRegistroDiario) => {
    setCatToEdit(cat);
    setNomeCat(cat.nome);
    setLimiteCat(cat.limite_mensal);
    setIsCatModalOpen(true);
  };

  const handleSaveCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeCat || limiteCat <= 0) return;
    try {
      setIsSubmitting(true);
      if (catToEdit) {
        await gastosDiariosService.updateCategoria(catToEdit.id, nomeCat, limiteCat);
      } else {
        await gastosDiariosService.addCategoria(nomeCat, limiteCat);
      }
      await fetchData();
      setIsCatModalOpen(false);
    } catch (error: any) {
      alert('Erro: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategoria = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? Todo o histórico dela será apagado.')) return;
    try {
      await gastosDiariosService.deleteCategoria(id);
      await fetchData();
    } catch (error: any) {
      alert('Erro ao excluir: ' + (error.message || JSON.stringify(error)));
    }
  };

  // Lançamentos
  const handleOpenLancamentos = (cat: CategoriaComRegistroDiario) => {
    setActiveCategoria(cat);
    setRegistroToEdit(null);
    setDescLancamento('');
    setValorLancamento(0);
    setIsLancamentoModalOpen(true);
  };

  const handleOpenEditLancamento = (r: RegistroDiario) => {
    setRegistroToEdit(r);
    setDescLancamento(r.descricao || '');
    setValorLancamento(r.valor_gasto);
  };

  const handleSaveLancamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCategoria || !descLancamento || valorLancamento < 0) return;
    try {
      setIsSubmitting(true);
      if (registroToEdit) {
        await gastosDiariosService.updateRegistroDiario(registroToEdit.id_registro, valorLancamento, descLancamento);
      } else {
        await gastosDiariosService.addRegistroDiario(activeCategoria.id, dataIso, valorLancamento, descLancamento);
      }
      
      await fetchData();
      setRegistroToEdit(null);
      setDescLancamento('');
      setValorLancamento(0);
      
      const newCats = await gastosDiariosService.fetchCategoriasComRegistroDia(dataIso);
      const updatedCat = newCats.find(c => c.id === activeCategoria.id);
      if (updatedCat) setActiveCategoria(updatedCat);

    } catch (error: any) {
      alert('Erro ao lançar: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLancamento = async (id_registro: string) => {
    try {
      await gastosDiariosService.deleteRegistroDiario(id_registro);
      await fetchData();
      if (activeCategoria) {
        const newCats = await gastosDiariosService.fetchCategoriasComRegistroDia(dataIso);
        const updatedCat = newCats.find(c => c.id === activeCategoria.id);
        if (updatedCat) setActiveCategoria(updatedCat);
      }
    } catch (error: any) {
      alert('Erro ao excluir lançamento: ' + (error.message || JSON.stringify(error)));
    }
  };

  const handleOpenNewPontual = () => {
    setRegistroToEdit(null);
    setDescLancamento('');
    setValorLancamento(0);
    setIsPontualModalOpen(true);
  };

  const handleOpenEditPontual = (r: RegistroDiario) => {
    setRegistroToEdit(r);
    setDescLancamento(r.descricao || '');
    setValorLancamento(r.valor_gasto);
    setIsPontualModalOpen(true);
  };

  const handleSavePontual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descLancamento || valorLancamento < 0) return;
    try {
      setIsSubmitting(true);
      if (registroToEdit) {
        await gastosDiariosService.updateRegistroDiario(registroToEdit.id_registro, valorLancamento, descLancamento);
      } else {
        await gastosDiariosService.addRegistroDiario(null, dataIso, valorLancamento, descLancamento);
      }
      await fetchData();
      setIsPontualModalOpen(false);
      setRegistroToEdit(null);
      setDescLancamento('');
      setValorLancamento(0);
    } catch (error: any) {
      alert('Erro ao salvar lançamento pontual: ' + (error.message || JSON.stringify(error)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleZerarDiaInteiro = async () => {
    try {
      await gastosDiariosService.zerarDiaInteiro(categorias, dataIso);
      await fetchData();
    } catch (error: any) {
      alert('Erro ao zerar dia: ' + (error.message || JSON.stringify(error)));
    }
  };

  const handleZerarCategoria = async (cat: CategoriaComRegistroDiario) => {
    try {
      await gastosDiariosService.addRegistroDiario(cat.id, dataIso, 0, 'Zerado');
      await fetchData();
    } catch (error: any) {
      alert('Erro ao zerar categoria: ' + (error.message || JSON.stringify(error)));
    }
  };

  // --- Lógica e dados dos Gráficos ---
  const getDailyChartData = () => {
    return Array.from({ length: daysInMonth }, (_, idx) => {
      const dayNum = idx + 1;
      const dateStr = `${mesAno}-${String(dayNum).padStart(2, '0')}`;
      
      let gasto = 0;
      
      if (selectedChartCat === 'all') {
        gasto = registrosMensais
          .filter(r => r.data === dateStr)
          .reduce((sum, r) => sum + r.valor_gasto, 0);
      } else {
        gasto = registrosMensais
          .filter(r => r.data === dateStr && r.id_categoria === selectedChartCat)
          .reduce((sum, r) => sum + r.valor_gasto, 0);
      }

      return {
        dia: dayNum,
        diaFormatado: `${dayNum}`,
        gasto,
        limite: getDailyLimitReference()
      };
    });
  };

  const getDailyLimitReference = () => {
    if (selectedChartCat === 'all') {
      return categorias.reduce((sum, c) => sum + (c.limite_mensal / 31), 0);
    }
    const cat = categorias.find(c => c.id === selectedChartCat);
    return cat ? (cat.limite_mensal / 31) : 0;
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const executado = payload[0].value;
      const projetado = chartView === 'diario' ? dataPoint.limite : payload[1]?.value;

      return (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          padding: '0.75rem',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-color)', marginBottom: '0.25rem' }}>
            {chartView === 'diario' ? `Dia ${label}` : label}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <p style={{ margin: 0, color: executado > projetado ? 'var(--danger)' : 'var(--primary)', fontSize: '0.875rem' }}>
              Executado: <strong>{formatBRL(executado)}</strong>
            </p>
            {projetado !== undefined && (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
                Projetado: <strong>{formatBRL(projetado)}</strong>
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomDailyTick = (props: any) => {
    const { x, y, payload } = props;
    const dayStr = payload.value;
    const dayNum = parseInt(dayStr, 10);
    const dateStr = `${mesAno}-${String(dayNum).padStart(2, '0')}`;
    const isPending = diasNaoInformados.includes(dateStr);

    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>
          {dayStr}
        </text>
        {isPending && (
          <text x={0} y={0} dy={24} textAnchor="middle" fill="var(--warning)" fontSize={10} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
            ⚠️
          </text>
        )}
      </g>
    );
  };

  const CustomMonthlyTick = (props: any) => {
    const { x, y, payload } = props;
    const mesAnoFormatado = payload.value;
    const matched = chartDataMensal.find(d => d.mesAnoFormatado === mesAnoFormatado);
    const m = matched ? matched.mesAno : null;
    const isPending = m ? mesesComLacuna.includes(m) : false;

    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
          {mesAnoFormatado}
        </text>
        {isPending && (
          <text x={0} y={0} dy={24} textAnchor="middle" fill="var(--warning)" fontSize={10} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
            ⚠️
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="theme-diarios">
      <div className="diarios-header-container">
        {/* Lado esquerdo no desktop / Linha 1 no mobile */}
        <div className="diarios-title-section">
          <h1 className="text-h1" style={{ marginBottom: 0 }}>Gastos Diários</h1>
        </div>

        {/* Linha 2 no mobile (Hoje e Dia Selector) / Meio no desktop */}
        <div className="diarios-controls-section">
          {/* Botão Hoje */}
          <div className="diarios-today-container">
            <button 
              onClick={goToToday}
              style={{
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                border: '2px solid var(--border-color)',
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
          </div>

          {/* Seletor de Dia */}
          <div className="diarios-day-container">
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
              <button onClick={prevDay} style={{ padding: '0.25rem', color: '#141816', display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}><ChevronLeft size={18} /></button>
              <span style={{ fontWeight: 700, minWidth: '55px', textAlign: 'center', color: '#141816', fontSize: '0.9rem', userSelect: 'none' }}>Dia {String(selectedDay).padStart(2, '0')}</span>
              <button onClick={nextDay} style={{ padding: '0.25rem', color: '#141816', display: 'flex', background: 'none', border: 'none', cursor: 'pointer' }}><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        {/* Lado direito no desktop / Linha 1 direita no mobile */}
        <div className="diarios-action-section">
          <Button onClick={handleOpenNewCat} icon={<Plus size={16} />}>Nova Categoria</Button>
        </div>
      </div>

      {/* Resumo Global (Sempre Visível) */}
      <Card className={`summary-card-diarios mb-4 ${totalProjetado > totalPrevisto ? 'is-overbudget' : ''}`} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
          <div>
            <h3 className="text-h3" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Projeção Mensal Geral</h3>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span className="text-h2" style={{ margin: 0, color: saldoGlobal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatBRL(saldoGlobal)} <span style={{fontSize: '0.875rem', fontWeight: 400}}>de saldo</span>
              </span>
            </div>
            <div className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
              <span>Projetado: {formatBRL(totalPrevisto)} | Executado: {formatBRL(totalProjetado)}</span>
              {totalDiasNaoInformados > 0 && (
                <WarningTooltip text={`Há ${totalDiasNaoInformados} dia(s) com gastos não informados neste mês.`} />
              )}
            </div>
          </div>
        </div>
        <BalanceProgressBar previsto={totalPrevisto} projetado={totalProjetado} />
      </Card>

      {/* Abas */}
      <style>{`
        .diarios-header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          width: 100%;
        }

        .diarios-controls-section {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .diarios-title-section {
          display: flex;
          align-items: center;
        }

        .diarios-action-section {
          display: flex;
          justify-content: flex-end;
        }

        @media (max-width: 768px) {
          .diarios-header-container {
            display: grid !important;
            grid-template-columns: 1fr auto !important;
            gap: 1rem 0.5rem !important;
            align-items: center !important;
            width: 100% !important;
          }
          
          .diarios-title-section {
            grid-column: 1;
            grid-row: 1;
          }
          
          .diarios-action-section {
            grid-column: 2;
            grid-row: 1;
            display: flex;
            justify-content: flex-end;
          }
          
          .diarios-controls-section {
            grid-column: 1 / span 2;
            grid-row: 2;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            width: 100% !important;
            gap: 0 !important;
          }
          
          .diarios-today-container {
            display: flex;
            justify-content: flex-start;
          }
          
          .diarios-day-container {
            display: flex;
            justify-content: flex-end;
          }
        }

        .scrollable-tabs {
          display: flex;
          gap: 1rem;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 1.5rem;
          overflow-x: auto;
          white-space: nowrap;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollable-tabs::-webkit-scrollbar {
          display: none;
        }
        .scrollable-tabs button {
          flex-shrink: 0;
          white-space: nowrap;
        }
      `}</style>
      <div className="scrollable-tabs">
        <button 
          onClick={() => setActiveTab('lancamentos')}
          style={{ 
            padding: '0.5rem 1rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'lancamentos' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'lancamentos' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: activeTab === 'lancamentos' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Lançamentos Diários
        </button>

        <button 
          onClick={() => setActiveTab('resumo')}
          style={{ 
            padding: '0.5rem 1rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'resumo' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'resumo' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: activeTab === 'resumo' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Resumo Consolidado
        </button>
        <button 
          onClick={() => setActiveTab('graficos')}
          style={{ 
            padding: '0.5rem 1rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'graficos' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'graficos' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: activeTab === 'graficos' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Evolução
        </button>
      </div>

      {/* CONTEÚDO DA ABA 1: LANÇAMENTOS */}
      {activeTab === 'lancamentos' && (
        <>
          {diasNaoInformados.includes(dataIso) && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <span style={{ 
                backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                color: '#f59e0b', 
                border: '1.5px solid #f59e0b',
                padding: '0.5rem 1rem', 
                borderRadius: '50px', 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.4rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                ⚠️ Gastos não informados neste dia
              </span>
            </div>
          )}

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="text-h2" style={{ margin: 0, fontSize: '1.2rem' }}>Categorias</h2>
              {categorias.some(c => c.registros_hoje.length === 0) && (
                <Button variant="outline" onClick={handleZerarDiaInteiro} icon={<Zap size={16} />}>Zerar Dia</Button>
              )}
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <Loader2 className="animate-spin" />
              </div>
            ) : categorias.length === 0 ? (
              <p className="text-muted">Nenhuma categoria criada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 100px', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
                  <div>Categoria</div>
                  <div style={{ textAlign: 'right' }}>Limite Diário</div>
                  <div style={{ textAlign: 'right' }}>Gasto Hoje</div>
                  <div style={{ textAlign: 'center' }}>Ações</div>
                </div>
                
                <style>{`
                  @media (max-width: 768px) {
                    .table-header { display: none !important; }
                  }
                `}</style>
                
                {categorias.map(cat => {
                  const gastoHoje = cat.registros_hoje.reduce((acc, r) => acc + r.valor_gasto, 0);
                  const limiteDiario = cat.limite_mensal / 31;
                  const isZerado = cat.registros_hoje.some(r => r.descricao === 'Zerado');
                  const hasLancamentos = cat.registros_hoje.length > 0;
                  
                  return (
                    <TransactionListItem 
                      key={cat.id}
                      type="daily"
                      title={cat.nome}
                      editCategoryActions={
                        <>
                          <button onClick={() => handleOpenEditCat(cat)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} title="Editar Categoria">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteCategoria(cat.id)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} title="Excluir Categoria">
                            <Trash2 size={16} />
                          </button>
                        </>
                      }
                      value1={formatBRL(limiteDiario)}
                      value2={
                        <span style={{ 
                          color: !hasLancamentos ? 'var(--text-muted)' : (gastoHoje <= limiteDiario ? 'var(--success)' : 'var(--danger)'),
                          fontWeight: hasLancamentos ? 600 : 400
                        }}>
                          {!hasLancamentos ? 'Pendente' : (isZerado && gastoHoje === 0 ? 'Zerado' : formatBRL(gastoHoje))}
                        </span>
                      }
                      actions={
                        <>
                          {!hasLancamentos && (
                            <button onClick={() => handleZerarCategoria(cat)} title="Zerar" style={{ padding: '0.25rem', color: 'var(--success)', cursor: 'pointer', background: 'none', border: 'none' }}>
                              <Zap size={16} />
                            </button>
                          )}
                          <button onClick={() => handleOpenLancamentos(cat)} title="Adicionar / Ver" style={{ padding: '0.25rem', color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none' }}>
                            <ListPlus size={18} />
                          </button>
                        </>
                      }
                    />
                  );
                })}
              </div>
            )}
          </Card>

          <Card style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <h2 className="text-h2" style={{ margin: 0, fontSize: '1.2rem' }}>Gastos Pontuais (Não Previsionados)</h2>
              <Button onClick={handleOpenNewPontual} icon={<Plus size={16} />}>Lançar Gasto Pontual</Button>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <Loader2 className="animate-spin" />
              </div>
            ) : registrosPontuais.length === 0 ? (
              <p className="text-muted">Nenhum gasto pontual lançado hoje.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="table-header-pontuais" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 100px', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
                  <div>Descrição</div>
                  <div style={{ textAlign: 'right' }}>Valor Gasto</div>
                  <div style={{ textAlign: 'center' }}>Ações</div>
                </div>
                
                <style>{`
                  @media (max-width: 768px) {
                    .table-header-pontuais { display: none !important; }
                  }
                `}</style>
                
                {registrosPontuais.map(r => (
                  <div 
                    key={r.id_registro} 
                    className="pontual-row-container"
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 1.5fr 100px', 
                      padding: '0.75rem 1rem', 
                      alignItems: 'center',
                      backgroundColor: 'var(--bg-card)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 'var(--radius-md)',
                      transition: 'background-color var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
                  >
                    <style>{`
                      @media (max-width: 768px) {
                        .pontual-row-container {
                          display: flex !important;
                          flex-direction: column !important;
                          align-items: flex-start !important;
                          gap: 0.5rem !important;
                          padding: 1rem !important;
                        }
                        .pontual-row-container > div {
                          width: 100% !important;
                          text-align: left !important;
                        }
                        .pontual-row-container > div:last-child {
                          display: flex !important;
                          justify-content: flex-start !important;
                          gap: 1rem !important;
                          margin-top: 0.25rem !important;
                        }
                      }
                    `}</style>
                    <div style={{ fontWeight: 600 }}>{r.descricao}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>{formatBRL(r.valor_gasto)}</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleOpenEditPontual(r)} 
                        style={{ padding: '0.25rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Editar Gasto Pontual"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteLancamento(r.id_registro)} 
                        style={{ padding: '0.25rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Excluir Gasto Pontual"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}



      {/* CONTEÚDO DA ABA 2: RESUMO MENSAL */}
      {activeTab === 'resumo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {diasNaoInformados.includes(dataIso) && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <span style={{ 
                backgroundColor: 'rgba(245, 158, 11, 0.12)', 
                color: '#f59e0b', 
                border: '1.5px solid #f59e0b',
                padding: '0.5rem 1rem', 
                borderRadius: '50px', 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.4rem',
                boxShadow: 'var(--shadow-sm)'
              }}>
                ⚠️ Gastos não informados neste dia
              </span>
            </div>
          )}

          {/* Resumo do Dia Específico */}
          <Card>
            <h2 className="text-h2" style={{ margin: 0, fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Resumo do dia
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
              <div>
                <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Projetado</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatBRL(previstoDia)}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <span>Executado</span>
                  {diasNaoInformados.includes(dataIso) && (
                    <WarningTooltip text="Gastos não informados neste dia" />
                  )}
                </div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatBRL(realizadoDia)}</div>
              </div>
              <div>
                <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Saldo</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', color: saldoDia >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatBRL(saldoDia)}
                </div>
              </div>
            </div>
          </Card>

          {/* Consolidado por Categoria */}
          <Card>
            <h2 className="text-h2" style={{ margin: 0, fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Consolidado Mensal por Categoria
            </h2>
            
            <div className="table-header-consolidado" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.1fr 1.3fr 1fr', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>
              <div>Categoria</div>
              <div style={{ textAlign: 'right' }}>Proj. para o mês</div>
              <div style={{ textAlign: 'right' }}>Proj. até Hoje</div>
              <div style={{ textAlign: 'right' }}>Exec. até hoje</div>
              <div style={{ textAlign: 'right' }}>Saldo</div>
            </div>

            {categorias.map(c => {
              const rCat = registrosMensais.filter(r => r.id_categoria === c.id);
              // Gastos reais até o dia selecionado
              const gastoR = rCat
                .filter(r => {
                  const rDay = parseInt(r.data.split('-')[2], 10);
                  return rDay <= selectedDay;
                })
                .reduce((sum, r) => sum + r.valor_gasto, 0);

              // Dias restantes do mês a partir do dia selecionado
              const diasRestantes = daysInMonth - selectedDay;
              const projetado = gastoR + (diasRestantes * (c.limite_mensal / 31));
              const saldo = c.limite_mensal - projetado;
              const projAteHoje = (c.limite_mensal / 31) * selectedDay;
              const catDiasNaoInf = getCatDiasNaoInformados(c.id).length;

              return (
                <div key={c.id} className="consolidated-row">
                  <div className="cr-title">{c.nome}</div>
                  <div className="cr-details">
                    <div className="cr-detail-item">
                      <span className="cr-label">Proj. para o mês</span>
                      <span className="cr-value text-muted">{formatBRL(c.limite_mensal)}</span>
                    </div>
                    <div className="cr-detail-item">
                      <span className="cr-label">Proj. até Hoje</span>
                      <span className="cr-value text-muted">{formatBRL(projAteHoje)}</span>
                    </div>
                    <div className="cr-detail-item">
                      <span className="cr-label" style={{ display: 'none' }}>Exec. até hoje</span>
                      <span className="cr-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>{formatBRL(gastoR)}</span>
                        {catDiasNaoInf > 0 && (
                          <WarningTooltip text={`${catDiasNaoInf} dia(s) com gastos não informados nesta categoria`} />
                        )}
                      </span>
                    </div>
                    <div className="cr-detail-item">
                      <span className="cr-label">Saldo</span>
                      <span className="cr-value" style={{ fontWeight: 600, color: saldo >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatBRL(saldo)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: GRÁFICOS */}
      {activeTab === 'graficos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Barra de Filtros dos Gráficos */}
          <Card>
            <div className="graficos-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <style>{`
                 @media (min-width: 769px) {
                    .graficos-header { justify-content: space-between !important; }
                    .graficos-view-selector { order: 2; }
                    .graficos-filter-selector { order: 1; }
                 }
              `}</style>
              <div className="graficos-view-selector" style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-main)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => setChartView('diario')}
                  style={{
                    padding: '0.375rem 1rem', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                    backgroundColor: chartView === 'diario' ? 'var(--primary)' : 'transparent',
                    color: chartView === 'diario' ? '#ffffff' : 'var(--text-muted)',
                    boxShadow: chartView === 'diario' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  Visão Diária (Mês Atual)
                </button>
                <button 
                  onClick={() => setChartView('mensal')}
                  style={{
                    padding: '0.375rem 1rem', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                    backgroundColor: chartView === 'mensal' ? 'var(--primary)' : 'transparent',
                    color: chartView === 'mensal' ? '#ffffff' : 'var(--text-muted)',
                    boxShadow: chartView === 'mensal' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  Visão Mensal (Histórico)
                </button>
              </div>

              <div className="graficos-filter-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="text-muted" style={{ fontSize: '0.875rem' }}>Filtrar Categoria:</span>
                <select 
                  value={selectedChartCat} 
                  onChange={e => setSelectedChartCat(e.target.value)}
                  style={{
                    padding: '0.375rem 2rem 0.375rem 0.75rem', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="all">Todas Consolidadas</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Gráfico Dinâmico */}
          <Card style={{ padding: '1.5rem', minHeight: '350px' }}>
            <h3 className="text-h3" style={{ margin: 0, fontSize: '1.1rem', marginBottom: '1.5rem' }}>
              {chartView === 'diario' 
                ? `Gastos diários do mês` 
                : (
                   <>
                     Histórico Mensal <br className="mobile-only-br" /> de gastos diários
                     <style>{`@media (min-width: 769px) { .mobile-only-br { display: none; } }`}</style>
                   </>
                )}
            </h3>

            {chartView === 'diario' ? (
              // Visão Diária
              <div className="scrollable-chart-outer" style={{ width: '100%', height: 300, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`.scrollable-chart-outer::-webkit-scrollbar { display: none; }`}</style>
                <div style={{ minWidth: `max(100%, ${getDailyChartData().length * 40}px)`, height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getDailyChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="diaFormatado" stroke="var(--text-muted)" fontSize={11} tickLine={false} tick={<CustomDailyTick />} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={val => `R$ ${val}`} />
                    <Tooltip content={<CustomChartTooltip />} />
                    
                    {getDailyLimitReference() > 0 && (
                      <ReferenceLine y={getDailyLimitReference()} stroke="var(--danger)" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Meta Diária', fill: 'var(--danger)', fontSize: 10, position: 'top' }} />
                    )}
                    
                    <Bar name="Valor Efetivamente Gasto" dataKey="gasto" radius={[2, 2, 0, 0]} maxBarSize={20}>
                      {
                        getDailyChartData().map((entry, index) => {
                          const limit = getDailyLimitReference();
                          const fill = entry.gasto > limit ? 'var(--danger)' : 'var(--primary)';
                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })
                      }
                    </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              // Visão Mensal
              <>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '0.5rem', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#475569' }}></div>
                    <span>Projetado Diário</span>
                  </div>
                </div>
                <div className="scrollable-chart-outer" style={{ width: '100%', height: 300, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`.scrollable-chart-outer::-webkit-scrollbar { display: none; }`}</style>
                <div style={{ minWidth: `max(100%, ${chartDataMensal.length * 70}px)`, height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDataMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="mesAnoFormatado" stroke="var(--text-muted)" fontSize={12} tickLine={false} tick={<CustomMonthlyTick />} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={val => `R$ ${val}`} />
                    <Tooltip content={<CustomChartTooltip />} />
                    
                    <Bar 
                      name="Executado Diário" 
                      dataKey={(selectedChartCat === 'all' ? 'diariosExecutado' : `cat_${selectedChartCat}_executado`) as any} 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={30} 
                    >
                      {
                        chartDataMensal.map((entry, index) => {
                          const execKey = selectedChartCat === 'all' ? 'diariosExecutado' : `cat_${selectedChartCat}_executado`;
                          const projKey = selectedChartCat === 'all' ? 'diariosProjetado' : `cat_${selectedChartCat}_projetado`;
                          const execVal = entry[execKey] || 0;
                          const projVal = entry[projKey] || 0;
                          const fill = execVal > projVal ? 'var(--danger)' : 'var(--primary)';
                          return <Cell key={`cell-${index}`} fill={fill} />;
                        })
                      }
                    </Bar>
                    <Bar 
                      name="Projetado Diário" 
                      dataKey={(selectedChartCat === 'all' ? 'diariosProjetado' : `cat_${selectedChartCat}_projetado`) as any} 
                      fill="#475569" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={30} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            </>
            )}
          </Card>
        </div>
      )}

      {/* Modal: Nova Categoria */}
      <Modal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title={catToEdit ? "Editar Categoria" : "Nova Categoria"}>
        <form onSubmit={handleSaveCategoria}>
          <div className="input-group">
            <label>Nome da Categoria</label>
            <input type="text" className="input" placeholder="Ex: Transporte" value={nomeCat} onChange={e => setNomeCat(e.target.value)} required />
          </div>
          <CurrencyInput label="Limite MENSAL" value={limiteCat} onChange={setLimiteCat} required />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsCatModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Lançamentos Diários */}
      <Modal isOpen={isLancamentoModalOpen} onClose={() => { setIsLancamentoModalOpen(false); setRegistroToEdit(null); }} title={`Lançamentos - ${activeCategoria?.nome}`}>
        {activeCategoria && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div>
              <h4 className="text-h4" style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Registrados hoje:</h4>
              {activeCategoria.registros_hoje.length === 0 ? (
                <p style={{ fontSize: '0.875rem' }}>Nenhum lançamento.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activeCategoria.registros_hoje.map(r => (
                    <div key={r.id_registro} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{r.descricao}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.descricao === 'Zerado' ? '-' : formatBRL(r.valor_gasto)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleOpenEditLancamento(r)} style={{ padding: '0.25rem', color: 'var(--text-main)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteLancamento(r.id_registro)} style={{ padding: '0.25rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveLancamento} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <h4 className="text-h4" style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                {registroToEdit ? 'Editar Lançamento' : 'Novo Lançamento'}
              </h4>
              <div className="input-group">
                <label>Descrição do Gasto</label>
                <input type="text" className="input" placeholder="Ex: Almoço" value={descLancamento} onChange={e => setDescLancamento(e.target.value)} required />
              </div>
              <CurrencyInput label="Valor" value={valorLancamento} onChange={setValorLancamento} required />
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', gap: '0.5rem' }}>
                {registroToEdit && (
                  <Button type="button" variant="outline" onClick={() => { setRegistroToEdit(null); setDescLancamento(''); setValorLancamento(0); }}>
                    Cancelar Edição
                  </Button>
                )}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : (registroToEdit ? <Check size={16} /> : <Plus size={16} />)} 
                  {registroToEdit ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Modal: Gasto Pontual */}
      <Modal isOpen={isPontualModalOpen} onClose={() => { setIsPontualModalOpen(false); setRegistroToEdit(null); }} title={registroToEdit ? "Editar Gasto Pontual" : "Novo Gasto Pontual"}>
        <form onSubmit={handleSavePontual}>
          <div className="input-group">
            <label>Descrição do Gasto</label>
            <input 
              type="text" 
              className="input" 
              placeholder="Ex: Mercado rápido, Farmácia" 
              value={descLancamento} 
              onChange={e => setDescLancamento(e.target.value)} 
              required 
            />
          </div>
          <CurrencyInput label="Valor" value={valorLancamento} onChange={setValorLancamento} required />
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => { setIsPontualModalOpen(false); setRegistroToEdit(null); }}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              {registroToEdit ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
