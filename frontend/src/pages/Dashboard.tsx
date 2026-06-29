import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { BalanceProgressBar } from '../components/ui/BalanceProgressBar';
import { AIPromptArea } from '../components/ui/AIPromptArea';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Link } from 'react-router-dom';
import { Wallet, CalendarDays, CreditCard, ArrowRight, TrendingUp, TrendingDown, Loader2, PiggyBank } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { gastosFixosService } from '../services/gastosFixos';
import { gastosDiariosService } from '../services/gastosDiarios';
import { parcelasService } from '../services/parcelas';
import { entradasService } from '../services/entradas';
import { chartsService } from '../services/charts';
import type { DailyForecastPoint, MonthlyPerformancePoint } from '../services/charts';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';
import { supabase } from '../lib/supabase';

export function Dashboard() {
  const { currentMonth } = useMonth();
  const year = currentMonth.getFullYear();
  const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${monthStr}`;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dailyChartData, setDailyChartData] = useState<DailyForecastPoint[]>([]);
  const [monthlyChartData, setMonthlyChartData] = useState<MonthlyPerformancePoint[]>([]);
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly'>('daily');

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
      const infThisMonth = eMensais.reduce((acc, e) => acc + (e.projetar ? (e.registro_atual?.valor_real || 0) : e.valor_previsto_base), 0);
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
        { data: allRegsReservaDb }
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
        supabase.from('registros_movimentacoes_reserva').select('*')
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

      // Entradas recorrentes: soma o valor_real de cada registro (o que de fato entrou no mês)
      // Entradas pontuais: sempre usa valor_previsto_base (registro não sobrescreve o valor único)
      const totalInflows =
        (allRegEntradasDb || []).reduce((acc, r) => acc + Number(r.valor_real), 0) +
        (allPontualEntradasDb || []).reduce((acc, e) => acc + Number(e.valor_previsto_base), 0);

      const totalOutflows = 
        (allGastosFixosDb || []).reduce((acc, r) => acc + Number(r.valor_real), 0) +
        (allGastosDiariosDb || []).reduce((acc, r) => acc + Number(r.valor_gasto), 0) +
        (allFaturasDb || []).reduce((acc, r) => acc + Number(r.valor_pago), 0);

      setSaldoConta(totalInflows + totalReservaInflows - totalOutflows - totalReservaOutflows);

      // 6. Buscar histórico consolidado para os gráficos
      const [dData, mData] = await Promise.all([
        chartsService.getDailyBalanceForecast(currentMonth),
        chartsService.getMonthlyPerformance(currentMonth)
      ]);
      setDailyChartData(dData);
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
              <span className="text-h1" style={{ margin: '0.5rem 0 0 0', fontSize: '2.5rem', color: saldoConta >= 0 ? '#10b981' : 'var(--danger)' }}>
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
                    <TrendingUp size={16} color="#10b981" /> Receitas do Mês:
                  </span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>{formatBRL(totalInflowsThisMonth)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                    <TrendingDown size={16} color="#ef4444" /> Despesas do Mês:
                  </span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>{formatBRL(consolidatedOutflowThisMonth)}</span>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Resultado Líquido:</span>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: netPerformanceThisMonth >= 0 ? '#10b981' : 'var(--danger)' }}>
                    {formatBRL(netPerformanceThisMonth)}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* ----------------- RECHARTS CHART BOX (DUAL TABS) ----------------- */}
          <Card style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 className="text-h2" style={{ margin: 0, fontSize: '1.25rem' }}>Análise Financeira</h2>
              <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-muted, #f1f5f9)', padding: '0.25rem', borderRadius: '8px' }}>
                <button
                  onClick={() => setActiveTab('daily')}
                  style={{
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'daily' ? 'var(--bg-card, #ffffff)' : 'transparent',
                    color: activeTab === 'daily' ? 'var(--text-color, #1e293b)' : 'var(--text-muted, #64748b)',
                    boxShadow: activeTab === 'daily' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  Previsão de Saldo Diário
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
            
            {activeTab === 'daily' && (
              <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '0.5rem', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--primary, #3b82f6)' }}></div>
                  <span>Saldo Previsto</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--danger, #ef4444)' }}></div>
                  <span>Fatura Anterior Atrasada</span>
                </div>
              </div>
            )}

            {activeTab === 'monthly' && (
              <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '0.5rem', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                  <span>Receitas</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                  <span>Despesas</span>
                </div>
              </div>
            )}
            
            <div style={{ width: '100%', height: 320, marginTop: '0.5rem' }}>
              {activeTab === 'daily' ? (
                <div className="scrollable-chart-outer" style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <style>{`.scrollable-chart-outer::-webkit-scrollbar { display: none; }`}</style>
                  <div style={{ minWidth: 'max(100%, 750px)', height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                        <XAxis dataKey="diaFormatado" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
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
                                  Dia {data.diaFormatado} de {new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(currentMonth)}
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <p style={{ margin: 0, color: 'var(--primary)', fontSize: '0.875rem' }}>
                                    Saldo Previsto: <strong style={{ color: 'var(--text-color)' }}>{formatBRL(data.saldo)}</strong>
                                  </p>
                                  {data.atrasada && (
                                    <p style={{ margin: 0, color: 'var(--danger, #ef4444)', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '0.25rem' }}>
                                      ⚠️ Fatura do Mês Anterior Atrasada!
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Line
                          type="monotone"
                          dataKey="saldo"
                          stroke="var(--primary)"
                          strokeWidth={3}
                          dot={({ cx, cy, payload }) => {
                            if (payload.atrasada) {
                              return (
                                <circle cx={cx} cy={cy} r={5} fill="var(--danger, #ef4444)" stroke="#fff" strokeWidth={2} />
                              );
                            }
                            return (
                              <circle cx={cx} cy={cy} r={3} fill="var(--primary)" />
                            );
                          }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="scrollable-chart-outer" style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
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
                                  <p style={{ margin: 0, color: '#10b981', fontSize: '0.875rem' }}>
                                    Receitas: <strong style={{ color: 'var(--text-color)' }}>{formatBRL(data.receitas)}</strong>
                                  </p>
                                  <p style={{ margin: 0, color: '#ef4444', fontSize: '0.875rem' }}>
                                    Despesas: <strong style={{ color: 'var(--text-color)' }}>{formatBRL(data.despesas)}</strong>
                                  </p>
                                  <p style={{ margin: 0, color: data.receitas - data.despesas >= 0 ? '#10b981' : '#ef4444', fontSize: '0.875rem', fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                                    Resultado: <span>{formatBRL(data.receitas - data.despesas)}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }} />
                        <Bar name="Receitas" dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={25} />
                        <Bar name="Despesas" dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
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
                      <span style={{ fontWeight: 600, color: faturaPrevStatus?.pago ? '#10b981' : 'var(--danger)' }}>
                        {formatBRL(ccBillPreviousMonth)} ({faturaPrevStatus?.pago ? 'Paga' : 'Aberta'})
                      </span>
                    </div>
                    
                    {isFaturaPrevPendente && (
                      showFaturaWarning ? (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                            ⚠️ Fatura vencida dia 10!
                          </span>
                          <Button 
                            onClick={() => {
                              setDiaPagamentoCCInput(new Date().getDate());
                              setIsCCPaymentModalOpen(true);
                            }} 
                            disabled={isSubmitting}
                            style={{ backgroundColor: 'var(--danger)', color: 'white', width: '100%', justifyContent: 'center', padding: '0.5rem' }}
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
                    <span className="text-h2" style={{ margin: 0, color: '#10b981' }}>
                      {formatBRL(saldoReserva)}
                    </span>
                  </div>
                  {saldoDevedorReserva > 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 700 }}>
                      Valores a Repor: {formatBRL(saldoDevedorReserva)}
                    </span>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Previsto no mês: <span style={{ color: '#10b981', fontWeight: 600 }}>+{formatBRL(reservaPrevistoIn)}</span> / <span style={{ color: 'var(--text-color)', fontWeight: 600 }}>-{formatBRL(reservaPrevistoOut)}</span>
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
