import { useState, useEffect, useRef } from 'react';
import { Card } from '../components/ui/Card';
import { BalanceProgressBar } from '../components/ui/BalanceProgressBar';
import { AIPromptArea } from '../components/ui/AIPromptArea';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Link } from 'react-router-dom';
import { Wallet, CalendarDays, CreditCard, ArrowRight, TrendingUp, TrendingDown, Loader2, PiggyBank, Eye } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { gastosFixosService } from '../services/gastosFixos';
import { gastosDiariosService } from '../services/gastosDiarios';
import { parcelasService } from '../services/parcelas';
import { entradasService } from '../services/entradas';
import { chartsService } from '../services/charts';
import type { DailyCalendarPoint, DailyCalendarItem, MonthlyPerformancePoint } from '../services/charts';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const { currentMonth } = useMonth();
  const year = currentMonth.getFullYear();
  const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${monthStr}`;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarData, setCalendarData] = useState<DailyCalendarPoint[]>([]);
  const [monthlyChartData, setMonthlyChartData] = useState<MonthlyPerformancePoint[]>([]);
  const [activeTab, setActiveTab] = useState<'visaoFuturo' | 'monthly'>('visaoFuturo');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [selectedMobileDay, setSelectedMobileDay] = useState<number | null>(null);

  // Detectar mobile
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ref e Estados para Rolagem Vertical da Tabela
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollVal, setScrollVal] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);

  const handleScroll = () => {
    if (tableContainerRef.current) {
      setScrollVal(tableContainerRef.current.scrollTop);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setScrollVal(val);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = val;
    }
  };

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    const timer = setTimeout(() => {
      setMaxScroll(el.scrollHeight - el.clientHeight);
    }, 150);

    const handleResize = () => {
      setMaxScroll(el.scrollHeight - el.clientHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [calendarData, activeTab]);

  // Totais de todos os tempos (Saldo da Conta)
  const [saldoConta, setSaldoConta] = useState(0);

  // Totais do mês selecionado
  const [totalInflowsThisMonth, setTotalInflowsThisMonth] = useState(0);

  const [fixosPrevisto, setFixosPrevisto] = useState(0);
  const [fixosRealizado, setFixosRealizado] = useState(0);
  const [fixosExecutadoProjetado, setFixosExecutadoProjetado] = useState(0);
  const [fixosNaoInformadas, setFixosNaoInformadas] = useState(0);

  const [diariosPrevisto, setDiariosPrevisto] = useState(0);
  const [diariosRealizado, setDiariosRealizado] = useState(0);
  const [diariosExecutadoProjetado, setDiariosExecutadoProjetado] = useState(0);
  const [diariosNaoInformados, setDiariosNaoInformados] = useState(0);

  const [parcelasPrevisto, setParcelasPrevisto] = useState(0);
  const [parcelasRealizado, setParcelasRealizado] = useState(0);

  // Cartão Fatura do Mês Anterior
  const [ccBillPreviousMonth, setCcBillPreviousMonth] = useState(0);
  const [faturaPrevStatus, setFaturaPrevStatus] = useState<any | null>(null);
  const [prevMesAno, setPrevMesAno] = useState('');
  const [prevMesAnoFormatado, setPrevMesAnoFormatado] = useState('');

  // Estados para Reserva Financeira
  const [saldoReserva, setSaldoReserva] = useState(0);
  const [saldoDevedorReserva, setSaldoDevedorReserva] = useState(0);
  const [reservaPrevistoIn, setReservaPrevistoIn] = useState(0);
  const [reservaPrevistoOut, setReservaPrevistoOut] = useState(0);

  // Modal para Pagar Fatura do Cartão
  const [isCCPaymentModalOpen, setIsCCPaymentModalOpen] = useState(false);
  const [diaPagamentoCCInput, setDiaPagamentoCCInput] = useState<number>(new Date().getDate());

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Determinar mês anterior
      const prevMonthDate = new Date(year, currentMonth.getMonth() - 1, 1);
      const pYear = prevMonthDate.getFullYear();
      const pMonthStr = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const pMesAno = `${pYear}-${pMonthStr}`;
      setPrevMesAno(pMesAno);
      
      const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setPrevMesAnoFormatado(`${mesesAbrev[prevMonthDate.getMonth()]}/${String(pYear).slice(-2)}`);

      // 1. Inflows / Entradas do mês selecionado
      const eMensais = await entradasService.fetchEntradasMensais(mesAno);
      const infThisMonth = eMensais.reduce((acc, e) => acc + (e.projetar ? ((e.registro_atual && Number(e.registro_atual.valor_real) > 0) ? Number(e.registro_atual.valor_real) : Number(e.valor_previsto_base)) : Number(e.valor_previsto_base)), 0);
      setTotalInflowsThisMonth(infThisMonth);

      // 2. Gastos Fixos
      const fMensais = await gastosFixosService.fetchGastosMensais(mesAno);
      const fPrev = fMensais.reduce((acc, g) => acc + (g.registro_atual?.valor_previsto_ajustado || g.valor_previsto_base), 0);
      const fReal = fMensais.reduce((acc, g) => acc + (g.registro_atual?.valor_real || 0), 0);
      const fRealProj = fMensais.reduce((acc, g) => {
        const isPaid = g.registro_atual?.valor_real !== undefined && g.registro_atual?.valor_real !== null && g.registro_atual?.valor_real > 0;
        const value = isPaid 
          ? g.registro_atual!.valor_real 
          : (g.registro_atual?.valor_previsto_ajustado || g.valor_previsto_base);
        return acc + value;
      }, 0);
      const fNaoInf = fMensais.filter(g => !g.registro_atual?.valor_real || g.registro_atual.valor_real === 0).length;
      setFixosPrevisto(fPrev);
      setFixosRealizado(fReal);
      setFixosExecutadoProjetado(fRealProj);
      setFixosNaoInformadas(fNaoInf);

      // 3. Gastos Diários
      const [cats, registros] = await Promise.all([
        gastosDiariosService.fetchCategoriasComRegistroDia(`${mesAno}-01`),
        gastosDiariosService.fetchRegistrosDoMes(mesAno)
      ]);
      const dPrev = cats.reduce((acc, c) => acc + c.limite_mensal, 0);

      const daysInMonth = new Date(year, currentMonth.getMonth() + 1, 0).getDate();
      const dReal = registros.reduce((acc, r) => acc + r.valor_gasto, 0);
      const dRealProj = cats.reduce((acc, c) => {
        const now = new Date();
        const isCurrentMonth = now.getFullYear() === year && now.getMonth() === currentMonth.getMonth();
        const isFutureMonth = currentMonth > now;
        const isPastMonth = !isCurrentMonth && !isFutureMonth;
        const todayDay = now.getDate();

        let catTotal = 0;
        for (let dia = 1; dia <= daysInMonth; dia++) {
          const dataIsoLoop = `${mesAno}-${String(dia).padStart(2, '0')}`;
          const rDia = registros.filter(r => r.id_categoria === c.id && r.data === dataIsoLoop);
          
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
      }, 0);

      const totalPontuaisMensal = registros
        .filter(r => r.id_categoria === null)
        .reduce((sum, r) => sum + r.valor_gasto, 0);

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
      if (lastDayToCheck >= 1 && cats.length > 0) {
        for (let dia = 1; dia <= lastDayToCheck; dia++) {
          const dataIso = `${mesAno}-${String(dia).padStart(2, '0')}`;
          cats.forEach(cat => {
            const hasRecord = registros.some(r => r.id_categoria === cat.id && r.data === dataIso);
            if (!hasRecord) {
              diasComLacuna.add(dataIso);
            }
          });
        }
      }
      const dNaoInf = diasComLacuna.size;

      setDiariosPrevisto(dPrev);
      setDiariosRealizado(dReal);
      setDiariosExecutadoProjetado(dRealProj + totalPontuaisMensal);
      setDiariosNaoInformados(dNaoInf);

      // 4. Cartão de Crédito / Parcelas
      const [config, parcelas] = await Promise.all([
        parcelasService.fetchConfiguracao(),
        parcelasService.fetchTodasParcelas()
      ]);
      setParcelasPrevisto(config?.limite_mensal_parcelas || 0);

      const getParcelaAtual = (mesAnoInicio: string, mesAnoAtual: string, numParcelas: number) => {
        const [startY, startM] = mesAnoInicio.split('-').map(Number);
        const [currY, currM] = mesAnoAtual.split('-').map(Number);
        const diff = (currY - startY) * 12 + (currM - startM);
        if (diff >= 0 && diff < numParcelas) return diff + 1;
        return null;
      };

      // Fatura do Mês Atual
      const ativas = parcelas.filter(c => getParcelaAtual(c.mes_ano_inicio, mesAno, c.num_parcelas) !== null);
      const pReal = ativas.reduce((acc, p) => acc + p.valor_parcela, 0);
      setParcelasRealizado(pReal);

      // Fatura do Mês Anterior
      const prevAtivas = parcelas.filter(c => getParcelaAtual(c.mes_ano_inicio, pMesAno, c.num_parcelas) !== null);
      const ccPrevValue = prevAtivas.reduce((acc, p) => acc + p.valor_parcela, 0);
      setCcBillPreviousMonth(ccPrevValue);

      // Status do Pagamento da Fatura do Mês Anterior
      const pFatura = await parcelasService.fetchPagamentoFatura(pMesAno);
      setFaturaPrevStatus(pFatura);

      const systemDate = new Date();
      const todayIso = `${systemDate.getFullYear()}-${String(systemDate.getMonth() + 1).padStart(2, '0')}-${String(systemDate.getDate()).padStart(2, '0')}`;

      // 5. Buscar todos os históricos para Saldo Cumulativo da Conta
      const [
        { data: allRegEntradasDb },
        { data: allPontualEntradasDb },
        { data: allGastosFixosDb },
        { data: allGastosDiariosDb },
        { data: allFaturasDb },
        { data: allMovsReservaDb },
        { data: allRegsReservaDb },
        { data: allSalariosDb }
      ] = await Promise.all([
        // Registros de entradas recorrentes (projetadas) — valor_real é o recebido de fato
        supabase.from('registros_entradas').select('valor_real').in('id_entrada',
          await supabase.from('entradas').select('id').eq('projetar', true).then(r => (r.data || []).map((e: any) => e.id))
        ),
        // Entradas pontuais (únicas) — valor_previsto_base é sempre o valor recebido
        supabase.from('entradas').select('valor_previsto_base').eq('projetar', false).eq('ativo', true).lte('data_entrada', todayIso),
        supabase.from('registros_gastos_fixos').select('valor_real'),
        supabase.from('registros_diarios').select('valor_gasto'),
        supabase.from('pagamentos_faturas').select('valor_pago').eq('pago', true),
        supabase.from('movimentacoes_reserva').select('*'),
        supabase.from('registros_movimentacoes_reserva').select('*'),
        supabase.from('salario').select('*')
      ]);

      const allMovsReserva = allMovsReservaDb || [];
      const allRegsReserva = allRegsReservaDb || [];

      // 5.1 Calcular Saldo Real da Reserva e Saldo Devedor
      let calcSaldoReserva = 0;
      let calcSaldoDevedor = 0;
      const histReserva: any[] = [];

      allMovsReserva.filter((m: any) => !m.projetar).forEach((m: any) => {
        histReserva.push({
          data: m.data_movimentacao,
          tipo: m.tipo,
          valor: Number(m.valor_previsto_base),
          gerar_saldo_devedor: m.tipo === 'saida' && m.gerar_saldo_devedor,
          quitar_saldo_devedor: m.tipo === 'entrada' && m.quitar_saldo_devedor,
          afeta_conta_geral: m.afeta_conta_geral,
          created_at: m.created_at
        });
      });

      allRegsReserva.forEach((r: any) => {
        const parent = allMovsReserva.find((m: any) => m.id === r.id_movimentacao);
        if (parent) {
          const dia = r.dia_movimentacao_real || parent.dia_movimentacao_previsto;
          const dataMov = `${r.mes_ano}-${String(dia).padStart(2, '0')}`;
          histReserva.push({
            data: dataMov,
            tipo: parent.tipo,
            valor: Number(r.valor_real),
            gerar_saldo_devedor: parent.tipo === 'saida' && r.gerar_saldo_devedor,
            quitar_saldo_devedor: parent.tipo === 'entrada' && r.quitar_saldo_devedor,
            afeta_conta_geral: r.afeta_conta_geral,
            created_at: r.created_at
          });
        }
      });

      histReserva.sort((a, b) => {
        if (a.data !== b.data) return a.data.localeCompare(b.data);
        return a.created_at.localeCompare(b.created_at);
      });

      histReserva.forEach(mov => {
        if (mov.tipo === 'entrada') {
          calcSaldoReserva += mov.valor;
        } else {
          calcSaldoReserva -= mov.valor;
        }

        if (mov.tipo === 'saida' && mov.gerar_saldo_devedor) {
          calcSaldoDevedor += mov.valor;
        } else if (mov.tipo === 'entrada' && mov.quitar_saldo_devedor) {
          calcSaldoDevedor = Math.max(0, calcSaldoDevedor - mov.valor);
        }
      });

      setSaldoReserva(calcSaldoReserva);
      setSaldoDevedorReserva(calcSaldoDevedor);

      // 5.2 Calcular o impacto das movimentações da Reserva na Conta Corrente Geral
      const totalReservaInflows = histReserva
        .filter(mov => mov.tipo === 'saida' && mov.afeta_conta_geral)
        .reduce((sum, mov) => sum + mov.valor, 0);

      const totalReservaOutflows = histReserva
        .filter(mov => mov.tipo === 'entrada' && mov.afeta_conta_geral)
        .reduce((sum, mov) => sum + mov.valor, 0);

      // 5.3 Calcular Movimentações Previstas da Reserva no Mês Atual (para exibição no card)
      let calcReservaPrevIn = 0;
      let calcReservaPrevOut = 0;

      const movsVigentesMes = allMovsReserva.filter((mov: any) => {
        const startMonth = mov.data_movimentacao.substring(0, 7);
        if (mov.projetar) {
          const startsOnOrBefore = startMonth <= mesAno;
          const endsOnOrAfter = !mov.mes_ano_fim || mov.mes_ano_fim >= mesAno;
          return startsOnOrBefore && endsOnOrAfter && mov.ativo;
        } else {
          return startMonth === mesAno && mov.ativo;
        }
      });

      movsVigentesMes.forEach((mov: any) => {
        if (mov.projetar) {
          const reg = allRegsReserva.find((r: any) => r.id_movimentacao === mov.id && r.mes_ano === mesAno);
          if (reg) {
            if (mov.tipo === 'entrada') calcReservaPrevIn += Number(reg.valor_real);
            else calcReservaPrevOut += Number(reg.valor_real);
          } else {
            if (mov.tipo === 'entrada') calcReservaPrevIn += Number(mov.valor_previsto_base);
            else calcReservaPrevOut += Number(mov.valor_previsto_base);
          }
        } else {
          if (mov.tipo === 'entrada') calcReservaPrevIn += Number(mov.valor_previsto_base);
          else calcReservaPrevOut += Number(mov.valor_previsto_base);
        }
      });

      setReservaPrevistoIn(calcReservaPrevIn);
      setReservaPrevistoOut(calcReservaPrevOut);

      // Calcula o total acumulado de salários até hoje
      let totalSalariosInflow = 0;
      (allSalariosDb || []).forEach((s: any) => {
        if (s.valor_real !== null && s.valor_real !== undefined) {
          if (s.data_real && s.data_real <= todayIso) {
            totalSalariosInflow += Number(s.valor_real);
          }
        } else if (s.valor_previsto > 0) {
          const desvio = s.desvio_mes_deposito ?? 0;
          const [y, m] = s.mes_ano.split('-').map(Number);
          const dateDep = new Date(y, m - 1 + desvio, s.dia_previsto || 5);
          const dateDepIso = `${dateDep.getFullYear()}-${String(dateDep.getMonth() + 1).padStart(2, '0')}-${String(dateDep.getDate()).padStart(2, '0')}`;
          
          if (dateDepIso <= todayIso) {
            totalSalariosInflow += Number(s.valor_previsto);
          }
        }
      });

      // Entradas recorrentes: soma o valor_real de cada registro (o que de fato entrou no mês)
      // Entradas pontuais: sempre usa valor_previsto_base (registro não sobrescreve o valor único)
      const totalInflows =
        (allRegEntradasDb || []).reduce((acc, r) => acc + Number(r.valor_real), 0) +
        (allPontualEntradasDb || []).reduce((acc, e) => acc + Number(e.valor_previsto_base), 0) +
        totalSalariosInflow;

      const totalOutflows = 
        (allGastosFixosDb || []).reduce((acc, r) => acc + Number(r.valor_real), 0) +
        (allGastosDiariosDb || []).reduce((acc, r) => acc + Number(r.valor_gasto), 0) +
        (allFaturasDb || []).reduce((acc, r) => acc + Number(r.valor_pago), 0);

      setSaldoConta(totalInflows + totalReservaInflows - totalOutflows - totalReservaOutflows);

      // 6. Buscar dados do calendário financeiro e desempenho mensal
      const [calData, mData] = await Promise.all([
        chartsService.getDailyCalendarData(currentMonth),
        chartsService.getMonthlyPerformance(currentMonth)
      ]);
      setCalendarData(calData);
      setMonthlyChartData(mData);

    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mesAno]);

  // Ações de pagamento

  // Cálculos consolidados para o mês selecionado
  // Outflows consolidate: Gastos Fixos + Gastos Diários + Fatura do Mês Anterior (que é paga neste mês)
  const consolidatedOutflowThisMonth = fixosRealizado + diariosRealizado + ccBillPreviousMonth;
  const netPerformanceThisMonth = totalInflowsThisMonth - consolidatedOutflowThisMonth;

  const globalPrevisto = fixosPrevisto + diariosPrevisto + parcelasPrevisto;
  const globalRealizado = fixosExecutadoProjetado + diariosExecutadoProjetado + parcelasRealizado;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia!';
    if (hour >= 12 && hour < 18) return 'Boa tarde!';
    return 'Boa noite!';
  };

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getStatusColor = (previsto: number, executado: number) => {
    if (executado === 0) return 'var(--text-muted)';
    if (previsto === 0) return executado > 0 ? 'var(--danger)' : 'var(--text-muted)';
    const pct = executado / previsto;
    if (pct <= 0.8) return 'var(--success)';
    if (pct <= 1.0) return 'var(--warning)';
    return 'var(--danger)';
  };

  // Condição para exibir aviso na fatura do mês anterior
  const isPastDay10 = new Date().getDate() > 10 || new Date() > new Date(year, currentMonth.getMonth(), 10);
  const isFaturaPrevPendente = !faturaPrevStatus?.pago && ccBillPreviousMonth > 0;
  const showFaturaWarning = isFaturaPrevPendente && isPastDay10;

  return (
    <div className="theme-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="text-h1" style={{ marginBottom: 0 }}>{getGreeting()}</h1>
      </div>

      <AIPromptArea />

      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Calculando e Atualizando Dashboard...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* ----------------- PRIMARY HEADER BOX ----------------- */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            
            {/* Saldo da Conta */}
            <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Wallet size={20} color="var(--primary)" />
                <h3 className="text-h3" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)' }}>Saldo em conta</h3>
              </div>
              <span className="text-h1" style={{ margin: '0.5rem 0 0 0', fontSize: '2.5rem', color: saldoConta >= 0 ? 'var(--color-verde-entradas)' : 'var(--color-vermelho-fixos)' }}>
                {formatBRL(saldoConta)}
              </span>
              <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem', margin: 0 }}>
                Saldo real acumulado retroativamente até hoje.
              </p>
            </Card>

            {/* Resumo de Performance */}
            <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
              <h3 className="text-h3" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Desempenho de {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                    <TrendingUp size={16} color="var(--color-verde-entradas)" /> Receitas do Mês:
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-verde-entradas)' }}>{formatBRL(totalInflowsThisMonth)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                    <TrendingDown size={16} color="var(--color-vermelho-fixos)" /> Despesas do Mês:
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--color-vermelho-fixos)' }}>{formatBRL(consolidatedOutflowThisMonth)}</span>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Resultado Líquido:</span>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: netPerformanceThisMonth >= 0 ? 'var(--color-verde-entradas)' : 'var(--color-vermelho-fixos)' }}>
                    {formatBRL(netPerformanceThisMonth)}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* ----------------- ANÁLISE FINANCEIRA (DUAL TABS: VISÃO DO FUTURO & DESEMPENHO MENSAL) ----------------- */}
          <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-color)' }}>
            <style>{`
              .vf-table-container::-webkit-scrollbar { display: none; }
              .vf-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8rem; }
              .vf-table thead { position: sticky; top: 0; z-index: 2; }
              .vf-table th { background: var(--bg-card, #fff); border-bottom: 2px solid var(--border-color); padding: 0.5rem 0.625rem; text-align: right; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); white-space: nowrap; }
              .vf-table th:first-child { text-align: center; width: 42px; }
              .vf-table td { padding: 0.4rem 0.625rem; border-bottom: 1px solid var(--border-color); text-align: right; white-space: nowrap; transition: background 0.15s; }
              .vf-table td:first-child { text-align: center; font-weight: 600; color: var(--text-muted); font-size: 0.75rem; }
              .vf-table tbody tr:hover td { background: rgba(99, 102, 241, 0.03); }
              .vf-row-today td { border-left: 3px solid var(--primary) !important; background: rgba(99, 102, 241, 0.04) !important; }
              .vf-row-today td:first-child { border-left: 3px solid var(--primary) !important; }
              .vf-val-previsto { opacity: 0.6; font-style: italic; }
              .vf-val-executado { font-weight: 600; opacity: 1; }
              .vf-tooltip { position: absolute; z-index: 10; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.75rem; box-shadow: var(--shadow-lg); min-width: 220px; max-width: 320px; pointer-events: none; font-size: 0.8rem; }
              .vf-tooltip-item { display: flex; justify-content: space-between; gap: 1rem; padding: 0.15rem 0; }
              .vf-tooltip-item-exec { font-weight: 600; }
              .vf-tooltip-item-prev { opacity: 0.6; font-style: italic; }
              .vf-slider-vertical { writing-mode: vertical-lr; width: 8px; height: 100%; max-height: 380px; accent-color: var(--primary); cursor: pointer; border-radius: 4px; border: none; outline: none; background: var(--border-color); }

              /* --- MOBILE: tabela simplificada --- */
              .vf-desktop-view { display: flex; }
              .vf-mobile-view { display: none; }
              .vf-mobile-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.95rem; }
              .vf-mobile-table th { background: var(--bg-card, #fff); border-bottom: 2px solid var(--border-color); padding: 0.6rem 0.75rem; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
              .vf-mobile-table th:first-child { text-align: center; width: 50px; }
              .vf-mobile-table th:last-child { text-align: right; }
              .vf-mobile-table td { padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border-color); transition: background 0.15s; cursor: pointer; }
              .vf-mobile-table td:first-child { text-align: center; font-weight: 600; color: var(--text-muted); font-size: 0.85rem; }
              .vf-mobile-table td:last-child { text-align: right; font-weight: 700; font-size: 0.95rem; }
              .vf-mobile-table tbody tr:active td { background: rgba(99, 102, 241, 0.06); }
              .vf-mobile-table .vf-row-today td { border-left: 3px solid var(--primary) !important; background: rgba(99, 102, 241, 0.04); }
              .vf-mobile-row-has-items td:last-child::after { content: ' \\203A'; font-size: 1.1rem; color: var(--text-muted); margin-left: 0.25rem; }

              /* Modal detail items on mobile */
              .vf-modal-section { margin-bottom: 1rem; }
              .vf-modal-section-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--border-color); }
              .vf-modal-item { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding: 0.35rem 0; font-size: 0.9rem; }
              .vf-modal-item-exec { font-weight: 600; }
              .vf-modal-item-prev { opacity: 0.6; font-style: italic; }
              .vf-modal-summary { display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0; border-top: 2px solid var(--border-color); margin-top: 0.5rem; font-size: 1rem; font-weight: 700; }

              @media (max-width: 768px) {
                .vf-table { font-size: 0.7rem; }
                .vf-table th, .vf-table td { padding: 0.3rem 0.4rem; }
                .vf-col-reserva { display: none; }
                .vf-desktop-view { display: none !important; }
                .vf-mobile-view { display: block !important; }
              }
            `}</style>

            {/* Header com Abas */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 className="text-h2" style={{ margin: 0, fontSize: '1.25rem' }}>Análise Financeira</h2>
              
              <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-muted, #f1f5f9)', padding: '0.25rem', borderRadius: '8px' }}>
                <button
                  onClick={() => setActiveTab('visaoFuturo')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'visaoFuturo' ? 'var(--bg-card, #ffffff)' : 'transparent',
                    color: activeTab === 'visaoFuturo' ? 'var(--primary, #3b82f6)' : 'var(--text-muted, #64748b)',
                    boxShadow: activeTab === 'visaoFuturo' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <Eye size={16} />
                  Visão do Futuro
                </button>
                <button
                  onClick={() => setActiveTab('monthly')}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'monthly' ? 'var(--bg-card, #ffffff)' : 'transparent',
                    color: activeTab === 'monthly' ? 'var(--text-color, #1e293b)' : 'var(--text-muted, #64748b)',
                    boxShadow: activeTab === 'monthly' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Desempenho Mensal
                </button>
              </div>
            </div>

            {/* ABA 1: VISÃO DO FUTURO */}
            {activeTab === 'visaoFuturo' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontWeight: 600, opacity: 1 }}>●</span>
                    <span>Executado</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ opacity: 0.5, fontStyle: 'italic' }}>○</span>
                    <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Previsto</span>
                  </div>
                </div>

                <div className="vf-desktop-view" style={{ gap: '0.75rem', alignItems: 'stretch', position: 'relative' }}>
                  {/* Tabela Principal */}
                  <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                    <div ref={!isMobile ? tableContainerRef : undefined} onScroll={!isMobile ? handleScroll : undefined} className="vf-table-container" style={{ maxHeight: 380, overflowY: 'auto', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      <table className="vf-table">
                        <thead>
                          <tr>
                            <th>Dia</th>
                            <th style={{ color: 'var(--color-verde-entradas)' }}>Entradas</th>
                            <th style={{ color: 'var(--color-vermelho-fixos)' }}>Saídas Fixas</th>
                            <th style={{ color: 'var(--color-laranja-diarios, var(--warning))' }}>Saídas Diárias</th>
                            <th style={{ color: 'var(--primary)' }}>Saldo Conta</th>
                            <th className="vf-col-reserva">Reserva</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calendarData.map((point) => {
                            const saldoInicial = calendarData.length > 0 ? (calendarData[0].saldoConta - calendarData[0].totalEntradas + calendarData[0].totalSaidasFixas + calendarData[0].totalSaidasDiarias) : 0;
                            const saldoPct = saldoInicial > 0 ? point.saldoConta / saldoInicial : (point.saldoConta >= 0 ? 1 : -1);
                            let saldoColor = 'var(--color-verde-entradas)';
                            if (saldoPct < 0) saldoColor = 'var(--color-vermelho-fixos)';
                            else if (saldoPct < 0.05) saldoColor = 'var(--color-laranja-diarios, var(--warning))';
                            else if (saldoPct < 0.20) saldoColor = 'var(--warning)';

                            const hasEntradas = point.totalEntradas > 0;
                            const hasSaidasFixas = point.totalSaidasFixas > 0;
                            const hasSaidasDiarias = point.totalSaidasDiarias > 0;
                            const allEntradasExec = point.entradas.length > 0 && point.entradas.every(i => i.isExecutado);
                            const allFixasExec = point.saidasFixas.length > 0 && point.saidasFixas.every(i => i.isExecutado);
                            const allDiariasExec = point.saidasDiarias.length > 0 && point.saidasDiarias.every(i => i.isExecutado);

                            const renderCellValue = (total: number, hasItems: boolean, allExec: boolean, color: string) => {
                              if (!hasItems) return <span style={{ color: 'var(--text-muted)', opacity: 0.3 }}>—</span>;
                              return (
                                <span className={allExec ? 'vf-val-executado' : 'vf-val-previsto'} style={{ color }}>
                                  {formatBRL(total)}
                                </span>
                              );
                            };

                            return (
                              <tr
                                key={point.dia}
                                className={point.isToday ? 'vf-row-today' : ''}
                                onMouseEnter={() => setHoveredDay(point.dia)}
                                onMouseLeave={() => setHoveredDay(null)}
                                style={{ cursor: (point.entradas.length > 0 || point.saidasFixas.length > 0 || point.saidasDiarias.length > 0) ? 'help' : 'default' }}
                              >
                                <td>{point.diaFormatado}</td>
                                <td>{renderCellValue(point.totalEntradas, hasEntradas, allEntradasExec, 'var(--color-verde-entradas)')}</td>
                                <td>{renderCellValue(point.totalSaidasFixas, hasSaidasFixas, allFixasExec, 'var(--color-vermelho-fixos)')}</td>
                                <td>{renderCellValue(point.totalSaidasDiarias, hasSaidasDiarias, allDiariasExec, 'var(--color-laranja-diarios, var(--warning))')}</td>
                                <td style={{ fontWeight: 700, color: saldoColor }}>{formatBRL(point.saldoConta)}</td>
                                <td className="vf-col-reserva" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatBRL(point.saldoReserva)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Tooltip */}
                    {hoveredDay !== null && (() => {
                      const point = calendarData.find(p => p.dia === hoveredDay);
                      if (!point || (point.entradas.length === 0 && point.saidasFixas.length === 0 && point.saidasDiarias.length === 0)) return null;
                      return (
                        <div className="vf-tooltip" style={{ top: 0, right: 0, transform: 'translateY(40px)' }}>
                          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-color)', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.35rem' }}>
                            Dia {point.diaFormatado} de {currentMonth.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                          </p>
                          {point.entradas.length > 0 && (
                            <div style={{ marginBottom: '0.35rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-verde-entradas)', textTransform: 'uppercase' }}>Entradas</span>
                              {point.entradas.map((item, i) => (
                                <div key={i} className={`vf-tooltip-item ${item.isExecutado ? 'vf-tooltip-item-exec' : 'vf-tooltip-item-prev'}`}>
                                  <span style={{ color: 'var(--text-muted)' }}>{item.descricao}</span>
                                  <span style={{ color: 'var(--color-verde-entradas)' }}>+{formatBRL(item.valor)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {point.saidasFixas.length > 0 && (
                            <div style={{ marginBottom: '0.35rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-vermelho-fixos)', textTransform: 'uppercase' }}>Saídas Fixas</span>
                              {point.saidasFixas.map((item, i) => (
                                <div key={i} className={`vf-tooltip-item ${item.isExecutado ? 'vf-tooltip-item-exec' : 'vf-tooltip-item-prev'}`}>
                                  <span style={{ color: 'var(--text-muted)' }}>{item.descricao}</span>
                                  <span style={{ color: 'var(--color-vermelho-fixos)' }}>-{formatBRL(item.valor)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {point.saidasDiarias.length > 0 && (
                            <div>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-laranja-diarios, var(--warning))', textTransform: 'uppercase' }}>Saídas Diárias</span>
                              {point.saidasDiarias.map((item, i) => (
                                <div key={i} className={`vf-tooltip-item ${item.isExecutado ? 'vf-tooltip-item-exec' : 'vf-tooltip-item-prev'}`}>
                                  <span style={{ color: 'var(--text-muted)' }}>{item.descricao}</span>
                                  <span style={{ color: 'var(--color-laranja-diarios, var(--warning))' }}>-{formatBRL(item.valor)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Slider Vertical na Lateral Direita */}
                  {maxScroll > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.25rem 0', gap: '0.5rem' }}>
                      <input
                        type="range"
                        min={0}
                        max={maxScroll}
                        value={scrollVal}
                        onChange={handleSliderChange}
                        className="vf-slider-vertical"
                        title="Rolar dias na tabela"
                      />
                    </div>
                  )}
                </div>

              {/* === MOBILE VIEW === */}
              <div className="vf-mobile-view">
                <div ref={isMobile ? tableContainerRef : undefined} onScroll={isMobile ? handleScroll : undefined} style={{ maxHeight: 420, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <table className="vf-mobile-table">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                      <tr>
                        <th>Dia</th>
                        <th>Saldo em Conta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendarData.map((point) => {
                        const saldoInicial = calendarData.length > 0 ? (calendarData[0].saldoConta - calendarData[0].totalEntradas + calendarData[0].totalSaidasFixas + calendarData[0].totalSaidasDiarias) : 0;
                        const saldoPct = saldoInicial > 0 ? point.saldoConta / saldoInicial : (point.saldoConta >= 0 ? 1 : -1);
                        let saldoColor = 'var(--color-verde-entradas)';
                        if (saldoPct < 0) saldoColor = 'var(--color-vermelho-fixos)';
                        else if (saldoPct < 0.05) saldoColor = 'var(--color-laranja-diarios, var(--warning))';
                        else if (saldoPct < 0.20) saldoColor = 'var(--warning)';

                        const hasItems = point.entradas.length > 0 || point.saidasFixas.length > 0 || point.saidasDiarias.length > 0;

                        return (
                          <tr
                            key={point.dia}
                            className={`${point.isToday ? 'vf-row-today' : ''} ${hasItems ? 'vf-mobile-row-has-items' : ''}`}
                            onClick={() => setSelectedMobileDay(point.dia)}
                          >
                            <td>{point.diaFormatado}</td>
                            <td style={{ color: saldoColor }}>{formatBRL(point.saldoConta)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

            {/* Modal de Detalhes do Dia (Mobile) */}
            {selectedMobileDay !== null && (() => {
              const point = calendarData.find(p => p.dia === selectedMobileDay);
              if (!point) return null;
              const saldoInicial = calendarData.length > 0 ? (calendarData[0].saldoConta - calendarData[0].totalEntradas + calendarData[0].totalSaidasFixas + calendarData[0].totalSaidasDiarias) : 0;
              const saldoPct = saldoInicial > 0 ? point.saldoConta / saldoInicial : (point.saldoConta >= 0 ? 1 : -1);
              let saldoColor = 'var(--color-verde-entradas)';
              if (saldoPct < 0) saldoColor = 'var(--color-vermelho-fixos)';
              else if (saldoPct < 0.05) saldoColor = 'var(--color-laranja-diarios, var(--warning))';
              else if (saldoPct < 0.20) saldoColor = 'var(--warning)';

              return (
                <Modal isOpen={true} onClose={() => setSelectedMobileDay(null)} title={`Dia ${point.diaFormatado}`}>
                  <div>
                    {point.entradas.length > 0 && (
                      <div className="vf-modal-section">
                        <div className="vf-modal-section-title" style={{ color: 'var(--color-verde-entradas)' }}>Entradas</div>
                        {point.entradas.map((item, i) => (
                          <div key={i} className={`vf-modal-item ${item.isExecutado ? 'vf-modal-item-exec' : 'vf-modal-item-prev'}`}>
                            <span>{item.descricao}</span>
                            <span style={{ color: 'var(--color-verde-entradas)' }}>+{formatBRL(item.valor)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: '0.2rem' }}>
                          Total: <strong style={{ marginLeft: '0.35rem', color: 'var(--color-verde-entradas)' }}>+{formatBRL(point.totalEntradas)}</strong>
                        </div>
                      </div>
                    )}

                    {point.saidasFixas.length > 0 && (
                      <div className="vf-modal-section">
                        <div className="vf-modal-section-title" style={{ color: 'var(--color-vermelho-fixos)' }}>Saídas Fixas</div>
                        {point.saidasFixas.map((item, i) => (
                          <div key={i} className={`vf-modal-item ${item.isExecutado ? 'vf-modal-item-exec' : 'vf-modal-item-prev'}`}>
                            <span>{item.descricao}</span>
                            <span style={{ color: 'var(--color-vermelho-fixos)' }}>-{formatBRL(item.valor)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: '0.2rem' }}>
                          Total: <strong style={{ marginLeft: '0.35rem', color: 'var(--color-vermelho-fixos)' }}>-{formatBRL(point.totalSaidasFixas)}</strong>
                        </div>
                      </div>
                    )}

                    {point.saidasDiarias.length > 0 && (
                      <div className="vf-modal-section">
                        <div className="vf-modal-section-title" style={{ color: 'var(--color-laranja-diarios, var(--warning))' }}>Saídas Diárias</div>
                        {point.saidasDiarias.map((item, i) => (
                          <div key={i} className={`vf-modal-item ${item.isExecutado ? 'vf-modal-item-exec' : 'vf-modal-item-prev'}`}>
                            <span>{item.descricao}</span>
                            <span style={{ color: 'var(--color-laranja-diarios, var(--warning))' }}>-{formatBRL(item.valor)}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: '0.2rem' }}>
                          Total: <strong style={{ marginLeft: '0.35rem', color: 'var(--color-laranja-diarios, var(--warning))' }}>-{formatBRL(point.totalSaidasDiarias)}</strong>
                        </div>
                      </div>
                    )}

                    {point.entradas.length === 0 && point.saidasFixas.length === 0 && point.saidasDiarias.length === 0 && (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0', fontSize: '0.9rem' }}>
                        Nenhuma movimentação neste dia.
                      </p>
                    )}

                    <div className="vf-modal-summary">
                      <span style={{ color: 'var(--primary)' }}>Saldo em Conta</span>
                      <span style={{ color: saldoColor }}>{formatBRL(point.saldoConta)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
                      <span>Reserva</span>
                      <span>{formatBRL(point.saldoReserva)}</span>
                    </div>
                  </div>
                </Modal>
              );
            })()}

            {/* ABA 2: DESEMPENHO MENSAL */}
            {activeTab === 'monthly' && (
              <div>
                <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '0.75rem', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-verde-entradas)' }}></div>
                    <span>Receitas</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-vermelho-fixos)' }}></div>
                    <span>Despesas</span>
                  </div>
                </div>

                <div className="scrollable-chart-outer" style={{ width: '100%', height: 350, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <style>{`.scrollable-chart-outer::-webkit-scrollbar { display: none; }`}</style>
                  <div style={{ minWidth: 'max(100%, 500px)', height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                        <XAxis dataKey="mesAnoFormatado" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                        <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                        <Tooltip content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={{
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                boxShadow: 'var(--shadow-lg)'
                              }}>
                                <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-color)', marginBottom: '0.25rem' }}>
                                  {data.mesAnoFormatado}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <p style={{ margin: 0, color: 'var(--color-verde-entradas)', fontSize: '0.875rem' }}>
                                    Receitas: <strong style={{ color: 'var(--text-color)' }}>{formatBRL(data.receitas)}</strong>
                                  </p>
                                  <p style={{ margin: 0, color: 'var(--color-vermelho-fixos)', fontSize: '0.875rem' }}>
                                    Despesas: <strong style={{ color: 'var(--text-color)' }}>{formatBRL(data.despesas)}</strong>
                                  </p>
                                  <p style={{ margin: 0, color: data.receitas - data.despesas >= 0 ? 'var(--color-verde-entradas)' : 'var(--color-vermelho-fixos)', fontSize: '0.875rem', fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                                    Resultado: <span>{formatBRL(data.receitas - data.despesas)}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Bar name="Receitas" dataKey="receitas" fill="var(--color-verde-entradas)" radius={[4, 4, 0, 0]} maxBarSize={25} />
                        <Bar name="Despesas" dataKey="despesas" fill="var(--color-vermelho-fixos)" radius={[4, 4, 0, 0]} maxBarSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ----------------- BOX "CONTA REAL VS PROJETADA" (BELOW CHART) ----------------- */}
          <Card className={`summary-card-geral ${globalRealizado > globalPrevisto ? 'is-overbudget' : ''}`} style={{ border: '2px solid var(--border-color)', boxShadow: 'var(--shadow-md)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h2 className="text-h2" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-muted)' }}>Conta Real vs Projetada</h2>
                <style>{`
                  .global-value-container { display: flex; align-items: baseline; gap: 0.75rem; margin-top: 0.5rem; }
                  @media (max-width: 768px) {
                    .global-value-container { flex-direction: column; align-items: flex-start; gap: 0; }
                  }
                `}</style>
                <div className="global-value-container">
                  <span className="text-h1" style={{ margin: 0, color: globalRealizado > globalPrevisto ? 'var(--danger)' : '#141816' }}>
                    {formatBRL(globalRealizado)}
                  </span>
                  <span className="text-muted" style={{ fontSize: '1.1rem' }}>
                    de {formatBRL(globalPrevisto)} projetado
                  </span>
                </div>
              </div>
            </div>
            
            <BalanceProgressBar previsto={globalPrevisto} projetado={globalRealizado} />
          </Card>

          {/* ----------------- SECONDARY SUMMARY CARDS ----------------- */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            
            {/* Gastos Fixos Card */}
            <StatCard
              className="theme-fixos"
              icon={<Wallet size={18} color="var(--primary)" />}
              title="Gastos Fixos"
              description="Despesas essenciais do mês"
              linkTo="/fixos"
              linkText="Gerenciar Fixos"
              valueDisplay={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span className="text-h2" style={{ margin: 0, color: getStatusColor(fixosPrevisto, fixosRealizado) }}>
                      {formatBRL(fixosRealizado)}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.875rem' }}>/ {formatBRL(fixosPrevisto)}</span>
                  </div>
                  {fixosNaoInformadas > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                      ⚠️ {fixosNaoInformadas} conta(s) não paga(s) / informada(s)
                    </span>
                  )}
                </div>
              }
            />

            {/* Gastos Diários Card */}
            <StatCard
              className="theme-diarios"
              icon={<CalendarDays size={18} color="var(--primary)" />}
              title="Gastos Diários"
              description="Gasto total executado até hoje"
              linkTo="/diarios"
              linkText="Gerenciar Diários"
              valueDisplay={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span className="text-h2" style={{ margin: 0, color: getStatusColor(diariosPrevisto, diariosRealizado) }}>
                      {formatBRL(diariosRealizado)}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.875rem' }}>/ Limite {formatBRL(diariosPrevisto)}</span>
                  </div>
                  {diariosNaoInformados > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                      ⚠️ {diariosNaoInformados} dia(s) com gastos não informados
                    </span>
                  )}
                </div>
              }
            />

            {/* Cartão de Crédito Card (Custom Card for precise styling/warnings) */}
            <Card 
              className="theme-parcelas" 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                border: showFaturaWarning ? '2px solid var(--danger)' : '1px solid var(--border-color)',
                boxShadow: showFaturaWarning ? '0 0 12px rgba(239, 68, 68, 0.15)' : 'none',
                transition: 'all 0.3s ease',
                padding: '1.5rem'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <CreditCard size={18} color="var(--primary)" />
                  <h3 className="text-h3" style={{ margin: 0, fontSize: '1.1rem' }}>Cartão de Crédito</h3>
                </div>
                <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Fatura atual e controle de fechamento
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {/* Fatura do Mês Atual (Aberta) */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span className="text-h2" style={{ margin: 0, color: getStatusColor(parcelasPrevisto, parcelasRealizado) }}>
                      {formatBRL(parcelasRealizado)}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.875rem' }}>/ Teto {formatBRL(parcelasPrevisto)}</span>
                  </div>

                  {/* Fatura do Mês Anterior */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                      <span className="text-muted">Fatura Anterior ({prevMesAnoFormatado}):</span>
                      <span style={{ fontWeight: 600, color: faturaPrevStatus?.pago ? 'var(--color-verde-entradas)' : 'var(--color-vermelho-fixos)' }}>
                        {formatBRL(ccBillPreviousMonth)} ({faturaPrevStatus?.pago ? 'Paga' : 'Aberta'})
                      </span>
                    </div>
                    
                    {isFaturaPrevPendente && (
                      showFaturaWarning ? (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-vermelho-fixos)', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                            ⚠️ Fatura vencida dia 10!
                          </span>
                          <Button 
                            onClick={() => {
                              setDiaPagamentoCCInput(new Date().getDate());
                              setIsCCPaymentModalOpen(true);
                            }} 
                            disabled={isSubmitting}
                            style={{ backgroundColor: 'var(--color-vermelho-fixos)', color: 'white', width: '100%', justifyContent: 'center', padding: '0.5rem' }}
                          >
                            Pagar Fatura
                          </Button>
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.75rem' }}>
                          <Button 
                            onClick={() => {
                              setDiaPagamentoCCInput(new Date().getDate());
                              setIsCCPaymentModalOpen(true);
                            }} 
                            disabled={isSubmitting}
                            style={{ width: '100%', justifyContent: 'center', padding: '0.5rem' }}
                          >
                            Pagar Fatura
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
              <Link 
                to="/cartao-credito" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)', fontSize: '0.875rem', transition: 'color 0.2s', marginTop: 'auto' }} 
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'} 
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                Gerenciar Cartão <ArrowRight size={14} />
              </Link>
            </Card>

            {/* Reserva Financeira Card */}
            <StatCard
              className="theme-reserva"
              icon={<PiggyBank size={18} color="var(--primary)" />}
              title="Reserva Financeira"
              description="Valor guardado e controle de reposição"
              linkTo="/reserva"
              linkText="Gerenciar Reserva"
              valueDisplay={
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span className="text-h2" style={{ margin: 0, color: 'var(--color-verde-entradas)' }}>
                      {formatBRL(saldoReserva)}
                    </span>
                  </div>
                  {saldoDevedorReserva > 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-vermelho-fixos)', fontWeight: 700 }}>
                      Valores a Repor: {formatBRL(saldoDevedorReserva)}
                    </span>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Previsto no mês: <span style={{ color: 'var(--color-verde-entradas)', fontWeight: 600 }}>+{formatBRL(reservaPrevistoIn)}</span> / <span style={{ color: 'var(--text-color)', fontWeight: 600 }}>-{formatBRL(reservaPrevistoOut)}</span>
                  </div>
                </div>
              }
            />

          </div>
        </div>
      )}
      {/* Modal de Pagamento de Fatura do Cartão */}
      <Modal isOpen={isCCPaymentModalOpen} onClose={() => setIsCCPaymentModalOpen(false)} title="Confirmar Pagamento de Fatura">
        <div>
          <p style={{ marginBottom: '1rem', lineHeight: '1.5' }}>
            O pagamento da fatura de <strong>{formatBRL(ccBillPreviousMonth)}</strong> do mês anterior ({prevMesAnoFormatado}) será registrado como tendo sido efetuado hoje, dia <strong>{new Date().getDate()}</strong>, ou você pode informar outra data abaixo:
          </p>
          
          <div className="input-group">
            <label>Dia do Pagamento</label>
            <select 
              className="input" 
              value={diaPagamentoCCInput} 
              onChange={e => setDiaPagamentoCCInput(Number(e.target.value))}
              style={{ appearance: 'auto', cursor: 'pointer' }}
              required
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', gap: '1rem' }}>
            <Button type="button" variant="outline" onClick={() => setIsCCPaymentModalOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              try {
                setIsSubmitting(true);
                await parcelasService.upsertPagamentoFatura(prevMesAno, true, diaPagamentoCCInput, ccBillPreviousMonth);
                await fetchData();
                setIsCCPaymentModalOpen(false);
                alert('Pagamento registrado com sucesso!');
              } catch (error: any) {
                alert('Erro ao pagar fatura: ' + error.message);
              } finally {
                setIsSubmitting(false);
              }
            }} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" size={14} style={{ marginRight: '0.25rem' }} /> : null}
              Confirmar Pagamento
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
