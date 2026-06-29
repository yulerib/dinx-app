import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Loader2, ArrowUpRight, Wallet, CreditCard, Calendar, PiggyBank } from 'lucide-react';
import { useMonth } from '../contexts/MonthContext';
import { supabase } from '../lib/supabase';
import { getLocalYearMonth } from '../services/gastosFixos';

const addMonths = (mesAno: string, count: number): string => {
  const [y, m] = mesAno.split('-').map(Number);
  const date = new Date(y, m - 1 + count, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
};

const formatMesAnoStr = (mesAno: string) => {
  const [y, m] = mesAno.split('-').map(Number);
  const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${mesesAbrev[m - 1]}/${String(y).slice(-2)}`;
};

interface Movimento {
  id: string;
  dia: number;
  descricao: string;
  tipo: 'inflow' | 'outflow';
  origem: 'entrada' | 'fixo' | 'diario' | 'fatura' | 'reserva';
  status: 'realizado' | 'pago' | 'provisionado' | 'atrasado';
  valor: number;
  saldoPosMovimento?: number;
}

export function Extrato() {
  const { currentMonth } = useMonth();
  const year = currentMonth.getFullYear();
  const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
  const mesAno = `${year}-${monthStr}`;
  const daysInMonth = new Date(year, currentMonth.getMonth() + 1, 0).getDate();

  const [isLoading, setIsLoading] = useState(true);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [entradasCompetenciaOutroMes, setEntradasCompetenciaOutroMes] = useState<{
    id: string;
    descricao: string;
    valor: number;
    dataRecebimento: string;
    tipoDesvio: 'antecipado' | 'atrasado';
  }[]>([]);

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getMesAnoAnterior = (mStr: string): string => {
    const [y, m] = mStr.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    return `${newY}-${newM}`;
  };

  const getParcelaAtual = (mesAnoInicio: string, mesAnoAtual: string, numParcelas: number): number | null => {
    const [startY, startM] = mesAnoInicio.split('-').map(Number);
    const [currY, currM] = mesAnoAtual.split('-').map(Number);
    const diff = (currY - startY) * 12 + (currM - startM);
    if (diff >= 0 && diff < numParcelas) return diff + 1;
    return null;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // 1. Carregar todos os dados necessários do Supabase
      const [
        { data: dbEntradas },
        { data: dbRegEntradas },
        { data: dbGastosFixos },
        { data: dbRegGastosFixos },
        { data: dbCategoriasDiarias },
        { data: dbRegistrosDiarios },
        { data: dbComprasParceladas },
        { data: dbPagamentosFaturas },
        { data: dbMovsReserva },
        { data: dbRegsReserva }
      ] = await Promise.all([
        supabase.from('entradas').select('*'),
        supabase.from('registros_entradas').select('*'),
        supabase.from('gastos_fixos').select('*'),
        supabase.from('registros_gastos_fixos').select('*'),
        supabase.from('categorias_diarias').select('*'),
        supabase.from('registros_diarios').select('*'),
        supabase.from('compras_parceladas').select('*'),
        supabase.from('pagamentos_faturas').select('*'),
        supabase.from('movimentacoes_reserva').select('*'),
        supabase.from('registros_movimentacoes_reserva').select('*')
      ]);

      const entradas = dbEntradas || [];
      const regEntradas = dbRegEntradas || [];
      const gastosFixos = dbGastosFixos || [];
      const regGastosFixos = dbRegGastosFixos || [];
      const categoriasDiarias = dbCategoriasDiarias || [];
      const registrosDiarios = dbRegistrosDiarios || [];
      const comprasParceladas = dbComprasParceladas || [];
      const pagamentosFaturas = dbPagamentosFaturas || [];
      const dbMovsReservaList = dbMovsReserva || [];
      const dbRegsReservaList = dbRegsReserva || [];

      // 2. Determinar intervalo de meses passados
      let startYear = year - 1;
      let startMonth = 0;

      const allDates: string[] = [];
      entradas.forEach(e => allDates.push(e.data_entrada.substring(0, 7)));
      regEntradas.forEach(r => allDates.push(r.mes_ano));
      regGastosFixos.forEach(r => allDates.push(r.mes_ano));
      registrosDiarios.forEach(r => allDates.push(r.data.substring(0, 7)));
      comprasParceladas.forEach(p => allDates.push(p.mes_ano_inicio));
      pagamentosFaturas.forEach(f => allDates.push(f.mes_ano));
      dbMovsReservaList.forEach(m => allDates.push(m.data_movimentacao.substring(0, 7)));
      dbRegsReservaList.forEach(r => allDates.push(r.mes_ano));

      if (allDates.length > 0) {
        allDates.sort();
        const [minY, minM] = allDates[0].split('-').map(Number);
        if (minY < year || (minY === year && (minM - 1) < currentMonth.getMonth())) {
          startYear = minY;
          startMonth = minM - 1;
        }
      }

      const pastMonths: string[] = [];
      let tempDate = new Date(startYear, startMonth, 1);
      const limitDate = new Date(year, currentMonth.getMonth(), 1);

      while (tempDate < limitDate) {
        const y = tempDate.getFullYear();
        const mStr = String(tempDate.getMonth() + 1).padStart(2, '0');
        pastMonths.push(`${y}-${mStr}`);
        tempDate.setMonth(tempDate.getMonth() + 1);
      }

      // 3. Calcular saldo inicial acumulado retroativamente até M-1
      let saldoAcumulado = 0;

      for (const m of pastMonths) {
        // Receitas (Caixa Físico)
        let inflowsM = 0;
        const pontuaisEmM = entradas.filter(e => !e.projetar && e.data_entrada.substring(0, 7) === m);
        pontuaisEmM.forEach(e => {
          inflowsM += Number(e.valor_previsto_base);
        });

        const recorrentesEmM = entradas.filter(e => {
          if (!e.projetar) return false;
          const d = e.desvio_competencia || 0;
          const C = addMonths(m, d);
          const competenciaInicio = addMonths(e.data_entrada.substring(0, 7), d);
          const startsOnOrBefore = competenciaInicio <= C;
          const endsOnOrAfter = !e.mes_ano_fim || e.mes_ano_fim >= C;
          return startsOnOrBefore && endsOnOrAfter;
        });

        recorrentesEmM.forEach(e => {
          const d = e.desvio_competencia || 0;
          const C = addMonths(m, d);
          const reg = regEntradas.find(r => r.id_entrada === e.id && r.mes_ano === C);
          if (reg) {
            inflowsM += Number(reg.valor_real);
          } else if (e.ativo) {
            inflowsM += Number(e.valor_previsto_base);
          }
        });

        // Despesas Fixas
        let fixedM = 0;
        const fixosVigentes = gastosFixos.filter(f => {
          const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= m;
          return isCreated && (f.ativo || regGastosFixos.some(r => r.id_gasto_fixo === f.id && r.mes_ano === m));
        });

        fixosVigentes.forEach(f => {
          const reg = regGastosFixos.find(r => r.id_gasto_fixo === f.id && r.mes_ano === m);
          if (reg) {
            fixedM += Number(reg.valor_real);
          } else if (f.ativo) {
            fixedM += Number(f.valor_previsto_base);
          }
        });

        // Despesas Diárias
        const dailyM = registrosDiarios
          .filter(r => r.data.substring(0, 7) === m)
          .reduce((sum, r) => sum + Number(r.valor_gasto), 0);

        // Fatura Cartão M-1 paga em M
        const m1 = getMesAnoAnterior(m);
        const faturaM1 = comprasParceladas.filter(compra => {
          const p = getParcelaAtual(compra.mes_ano_inicio, m1, compra.num_parcelas);
          return p !== null;
        }).reduce((sum, p) => sum + Number(p.valor_parcela), 0);

        const pagoFaturaM1 = pagamentosFaturas.find(f => f.mes_ano === m1 && f.pago === true);
        const ccM = pagoFaturaM1 ? faturaM1 : 0;

        // Reserva
        let reservaInflowsM = 0;
        let reservaOutflowsM = 0;

        dbMovsReservaList
          .filter(mov => !mov.projetar && mov.data_movimentacao.substring(0, 7) === m && mov.afeta_conta_geral)
          .forEach(mov => {
            if (mov.tipo === 'saida') reservaInflowsM += Number(mov.valor_previsto_base);
            else reservaOutflowsM += Number(mov.valor_previsto_base);
          });

        dbRegsReservaList
          .filter(r => r.mes_ano === m && r.afeta_conta_geral)
          .forEach(r => {
            const parent = dbMovsReservaList.find(mov => mov.id === r.id_movimentacao);
            if (parent) {
              if (parent.tipo === 'saida') reservaInflowsM += Number(r.valor_real);
              else reservaOutflowsM += Number(r.valor_real);
            }
          });

        saldoAcumulado += (inflowsM + reservaInflowsM - fixedM - dailyM - ccM - reservaOutflowsM);
      }

      setSaldoInicial(saldoAcumulado);

      // 4. Mapear e estruturar todos os movimentos do mês selecionado (M)
      const listMovimentos: Movimento[] = [];

      // A1. Lançamentos físicos de caixa de entradas que caíram em mesAno
      const pontuaisNoMes = entradas.filter(e => !e.projetar && e.data_entrada.substring(0, 7) === mesAno);
      
      const recorrentesFisicosNoMes = entradas.filter(e => {
        if (!e.projetar) return false;
        const d = e.desvio_competencia || 0;
        const C = addMonths(mesAno, d);
        const competenciaInicio = addMonths(e.data_entrada.substring(0, 7), d);
        const startsOnOrBefore = competenciaInicio <= C;
        const endsOnOrAfter = !e.mes_ano_fim || e.mes_ano_fim >= C;
        return startsOnOrBefore && endsOnOrAfter;
      });

      pontuaisNoMes.forEach(e => {
        const entryDay = Number(e.data_entrada.split('-')[2]);
        listMovimentos.push({
          id: `inflow-${e.id}-unique`,
          dia: entryDay,
          descricao: e.descricao,
          tipo: 'inflow',
          origem: 'entrada',
          status: 'realizado',
          valor: Number(e.valor_previsto_base)
        });
      });

      recorrentesFisicosNoMes.forEach(e => {
        const entryDay = Number(e.data_entrada.split('-')[2]);
        const d = e.desvio_competencia || 0;
        const C = addMonths(mesAno, d); // Competência correspondente
        const reg = regEntradas.find(r => r.id_entrada === e.id && r.mes_ano === C);
        
        let desc = e.descricao;
        if (d === 1) {
          desc = `${e.descricao} (Competência ${formatMesAnoStr(C)})`;
        } else if (d === -1) {
          desc = `${e.descricao} (Competência ${formatMesAnoStr(C)})`;
        }

        if (reg) {
          listMovimentos.push({
            id: `inflow-${e.id}-real`,
            dia: entryDay,
            descricao: `${desc} (Realizado)`,
            tipo: 'inflow',
            origem: 'entrada',
            status: 'realizado',
            valor: Number(reg.valor_real)
          });
        } else if (e.ativo) {
          listMovimentos.push({
            id: `inflow-${e.id}-proj`,
            dia: entryDay,
            descricao: `${desc} (Provisionada)`,
            tipo: 'inflow',
            origem: 'entrada',
            status: 'provisionado',
            valor: Number(e.valor_previsto_base)
          });
        }
      });

      // A2. Entradas de competência mesAno que caíram em outros meses
      const compOutroMes: any[] = [];
      const todasEntradasCompetencia = entradas.filter(e => {
        if (!e.projetar) return false;
        const d = e.desvio_competencia || 0;
        const competenciaInicio = addMonths(e.data_entrada.substring(0, 7), d);
        const startsOnOrBefore = competenciaInicio <= mesAno;
        const endsOnOrAfter = !e.mes_ano_fim || e.mes_ano_fim >= mesAno;
        return startsOnOrBefore && endsOnOrAfter;
      });

      todasEntradasCompetencia.forEach(e => {
        const d = e.desvio_competencia || 0;
        if (d !== 0) {
          const mesFisico = addMonths(mesAno, -d);
          const diaFisico = e.data_entrada.split('-')[2];
          
          const reg = regEntradas.find(r => r.id_entrada === e.id && r.mes_ano === mesAno);
          const valor = reg ? Number(reg.valor_real) : Number(e.valor_previsto_base);

          compOutroMes.push({
            id: e.id,
            descricao: e.descricao,
            valor,
            dataRecebimento: `${diaFisico}/${mesFisico.split('-')[1]}`,
            tipoDesvio: d > 0 ? 'antecipado' : 'atrasado'
          });
        }
      });
      setEntradasCompetenciaOutroMes(compOutroMes);

      // B. Gastos Fixos
      const activeFixos = gastosFixos.filter(f => {
        const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= mesAno;
        return isCreated && (f.ativo || regGastosFixos.some(r => r.id_gasto_fixo === f.id && r.mes_ano === mesAno));
      });

      activeFixos.forEach(f => {
        const reg = regGastosFixos.find(r => r.id_gasto_fixo === f.id && r.mes_ano === mesAno);
        const hasRealPaid = reg && reg.valor_real > 0;

        if (hasRealPaid) {
          const paidDay = (reg!.dia_pagamento_real && reg!.dia_pagamento_real > 0) ? reg!.dia_pagamento_real : f.dia_pagamento_previsto;
          listMovimentos.push({
            id: `fixed-${f.id}-real`,
            dia: paidDay,
            descricao: `${f.nome} (Pago)`,
            tipo: 'outflow',
            origem: 'fixo',
            status: 'pago',
            valor: Number(reg!.valor_real)
          });
        } else {
          const previsto = reg && reg.valor_previsto_ajustado !== null ? reg.valor_previsto_ajustado : f.valor_previsto_base;
          listMovimentos.push({
            id: `fixed-${f.id}-proj`,
            dia: f.dia_pagamento_previsto,
            descricao: `${f.nome} (Provisionado)`,
            tipo: 'outflow',
            origem: 'fixo',
            status: 'provisionado',
            valor: Number(previsto)
          });
        }
      });

      // C. Fatura Cartão de Crédito
      const mesAnoAnterior = getMesAnoAnterior(mesAno);
      const faturaAnterior = comprasParceladas.filter(compra => {
        const p = getParcelaAtual(compra.mes_ano_inicio, mesAnoAnterior, compra.num_parcelas);
        return p !== null;
      }).reduce((sum, p) => sum + Number(p.valor_parcela), 0);

      const pagoFaturaAnterior = pagamentosFaturas.find(f => f.mes_ano === mesAnoAnterior);
      const ccPaid = pagoFaturaAnterior ? pagoFaturaAnterior.pago : false;
      const ccDiaPagamentoReal = pagoFaturaAnterior ? pagoFaturaAnterior.dia_pagamento_real : null;

      if (faturaAnterior > 0) {
        if (ccPaid && ccDiaPagamentoReal !== null) {
          listMovimentos.push({
            id: `fatura-${mesAnoAnterior}-pago`,
            dia: ccDiaPagamentoReal,
            descricao: 'Fatura Cartão Mês Anterior (Paga)',
            tipo: 'outflow',
            origem: 'fatura',
            status: 'pago',
            valor: faturaAnterior
          });
        } else {
          listMovimentos.push({
            id: `fatura-${mesAnoAnterior}-proj`,
            dia: 10,
            descricao: 'Fatura Cartão Mês Anterior (Provisionada)',
            tipo: 'outflow',
            origem: 'fatura',
            status: 'provisionado',
            valor: faturaAnterior
          });
        }
      }

      // D. Gastos Diários
      const systemDate = new Date();
      const realTodayDay = systemDate.getDate();
      const realTodayMonthIso = `${systemDate.getFullYear()}-${String(systemDate.getMonth() + 1).padStart(2, '0')}`;

      // Apenas categorias com limite_mensal > 0 geram provisões
      const catsComLimite = categoriasDiarias.filter(c => Number(c.limite_mensal) > 0);

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${mesAno}-${String(d).padStart(2, '0')}`;
        const recordsForDay = registrosDiarios.filter(r => r.data === dayStr);
        const isFutureDay = mesAno > realTodayMonthIso || (mesAno === realTodayMonthIso && d > realTodayDay);

        // 1. Gastos pontuais sem categoria — mostra sempre que valor > 0
        recordsForDay
          .filter(r => r.id_categoria === null)
          .forEach(r => {
            if (Number(r.valor_gasto) > 0) {
              listMovimentos.push({
                id: `daily-pontual-${r.id_registro}`,
                dia: d,
                descricao: r.descricao ? r.descricao : 'Gasto Pontual',
                tipo: 'outflow',
                origem: 'diario',
                status: 'realizado',
                valor: Number(r.valor_gasto)
              });
            }
          });

        // 2. Gastos por categoria — cada registro aparece de forma independente
        catsComLimite.forEach(cat => {
          const limiteDiario = Number(cat.limite_mensal) / 31;
          const regsReal = recordsForDay.filter(r => r.id_categoria === cat.id);

          if (regsReal.length > 0) {
            // Itera cada lançamento real da categoria neste dia de forma independente
            regsReal.forEach(regReal => {
              const valorReal = Number(regReal.valor_gasto);
              if (valorReal > 0) {
                listMovimentos.push({
                  id: `daily-cat-${regReal.id_registro}`,
                  dia: d,
                  descricao: regReal.descricao && regReal.descricao !== 'Zerado'
                    ? `${regReal.descricao} (${cat.nome})`
                    : cat.nome,
                  tipo: 'outflow',
                  origem: 'diario',
                  status: 'realizado',
                  valor: valorReal
                });
              }
              // valor=0 (zerado pelo usuário): não aparece
            });
          } else if (isFutureDay && limiteDiario > 0) {
            // Dia futuro sem nenhum registro: mostra projeção do limite diário da categoria
            listMovimentos.push({
              id: `daily-proj-${cat.id}-${d}`,
              dia: d,
              descricao: `${cat.nome} (Provisão)`,
              tipo: 'outflow',
              origem: 'diario',
              status: 'provisionado',
              valor: limiteDiario
            });
          }
          // Dia passado sem registro = não aparece
        });
      }

      // E. Movimentações da Reserva Financeira que afetam a Conta Geral
      const activeMovsReserva = dbMovsReservaList.filter(mov => {
        const startMonth = mov.data_movimentacao.substring(0, 7);
        if (!mov.projetar) {
          return startMonth === mesAno && mov.afeta_conta_geral;
        }
        if (startMonth > mesAno) return false;
        if (mov.mes_ano_fim && mesAno > mov.mes_ano_fim) return false;
        return mov.afeta_conta_geral;
      });

      activeMovsReserva.forEach(mov => {
        if (!mov.projetar) {
          const entryDay = Number(mov.data_movimentacao.split('-')[2]);
          listMovimentos.push({
            id: `reserva-${mov.id}-unique`,
            dia: entryDay,
            descricao: mov.tipo === 'entrada' ? `Depósito na Reserva: ${mov.descricao}` : `Resgate da Reserva: ${mov.descricao}`,
            tipo: mov.tipo === 'entrada' ? 'outflow' : 'inflow', // Depósito é saída, Resgate é entrada na geral
            origem: 'reserva',
            status: 'realizado',
            valor: Number(mov.valor_previsto_base)
          });
        } else {
          const reg = dbRegsReservaList.find(r => r.id_movimentacao === mov.id && r.mes_ano === mesAno);
          if (reg) {
            const paidDay = reg.dia_movimentacao_real || mov.dia_movimentacao_previsto;
            listMovimentos.push({
              id: `reserva-${mov.id}-real`,
              dia: paidDay,
              descricao: mov.tipo === 'entrada' ? `Depósito na Reserva: ${mov.descricao} (Realizado)` : `Resgate da Reserva: ${mov.descricao} (Realizado)`,
              tipo: mov.tipo === 'entrada' ? 'outflow' : 'inflow',
              origem: 'reserva',
              status: 'realizado',
              valor: Number(reg.valor_real)
            });
          } else if (mov.ativo) {
            listMovimentos.push({
              id: `reserva-${mov.id}-proj`,
              dia: mov.dia_movimentacao_previsto,
              descricao: mov.tipo === 'entrada' ? `Depósito na Reserva: ${mov.descricao} (Provisionado)` : `Resgate da Reserva: ${mov.descricao} (Provisionado)`,
              tipo: mov.tipo === 'entrada' ? 'outflow' : 'inflow',
              origem: 'reserva',
              status: 'provisionado',
              valor: Number(mov.valor_previsto_base)
            });
          }
        }
      });

      // 5. Ordenação Cronológica e Acumulação de Saldo Líquido
      // Inflow primeiro no mesmo dia para evitar saldos falsamente negativos intermediários
      listMovimentos.sort((a, b) => {
        if (a.dia !== b.dia) return a.dia - b.dia;
        if (a.tipo !== b.tipo) return a.tipo === 'inflow' ? -1 : 1;
        return a.id.localeCompare(b.id);
      });

      let runningBalance = saldoAcumulado;
      const sortedMovimentos = listMovimentos.map(mov => {
        if (mov.tipo === 'inflow') {
          runningBalance += mov.valor;
        } else {
          runningBalance -= mov.valor;
        }
        return {
          ...mov,
          saldoPosMovimento: runningBalance
        };
      });

      setMovimentos(sortedMovimentos);

    } catch (error) {
      console.error('Erro ao montar extrato consolidado:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mesAno]);

  const totalEntradas = movimentos.filter(m => m.tipo === 'inflow').reduce((acc, m) => acc + m.valor, 0);
  const totalSaidas = movimentos.filter(m => m.tipo === 'outflow').reduce((acc, m) => acc + m.valor, 0);
  const saldoProjetadoFinal = saldoInicial + totalEntradas - totalSaidas;

  return (
    <div className="theme-extrato" style={{ padding: '0.25rem 0' }}>
      <style>{`
        .theme-extrato {
          --primary: #6366f1; /* Indigo */
        }
        .extrato-grid {
          display: grid;
          grid-template-columns: 80px 1.2fr 1fr 1.2fr 1fr 1fr;
          gap: 1.25rem;
          align-items: center;
          padding: 0.85rem 1.25rem;
          border-bottom: 1px solid var(--border-color);
        }
        .extrato-header-row {
          font-weight: 700;
          color: var(--text-muted);
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid var(--border-color);
          background-color: rgba(255, 255, 255, 0.01);
        }
        .extrato-movement-row {
          transition: background-color var(--transition-fast);
        }
        .extrato-movement-row:hover {
          background-color: rgba(99, 102, 241, 0.03);
        }
        .origem-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.25rem 0.6rem;
          border-radius: 50px;
          font-size: 0.75rem;
          fontWeight: 600;
          border: 1.5px solid var(--border-color);
        }
        .origem-entrada { background-color: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.3); color: #10b981; }
        .origem-fixo { background-color: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.3); color: #3b82f6; }
        .origem-diario { background-color: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.3); color: #f59e0b; }
        .origem-fatura { background-color: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); color: #ef4444; }
        .origem-reserva { background-color: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.3); color: #6366f1; }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-realizado, .status-pago { background-color: rgba(16, 185, 129, 0.12); color: #10b981; }
        .status-provisionado { background-color: rgba(107, 114, 128, 0.12); color: var(--text-muted); }
        .status-atrasado { background-color: rgba(239, 68, 68, 0.12); color: #ef4444; }

        @media (max-width: 992px) {
          .extrato-header-row { display: none !important; }
          .extrato-grid {
            grid-template-columns: 1fr !important;
            gap: 0.5rem;
            padding: 1.25rem;
            border: 2px solid var(--border-color);
            border-radius: var(--radius-md);
            margin-bottom: 0.75rem;
          }
          .extrato-grid > div {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
          }
          .extrato-grid > div::before {
            content: attr(data-label);
            font-weight: 700;
            color: var(--text-muted);
            font-size: 0.8rem;
            text-transform: uppercase;
          }
          .extrato-grid > div:first-child::before { content: "Data" !important; }
          .extrato-grid > div:last-child {
            border-top: 1px dashed var(--border-color);
            padding-top: 0.5rem;
            margin-top: 0.25rem;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="text-h1" style={{ marginBottom: 0, color: 'var(--primary)' }}>Extrato Financeiro</h1>
      </div>

      {/* Resumo de Saldos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <Card style={{ padding: '1.25rem', borderLeft: '4px solid var(--text-muted)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Saldo Inicial do Mês</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>{formatBRL(saldoInicial)}</div>
        </Card>
        <Card style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Recebido (Mês)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#10b981' }}>{formatBRL(totalEntradas)}</div>
        </Card>
        <Card style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Saídas (Mês)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: '#ef4444' }}>{formatBRL(totalSaidas)}</div>
        </Card>
        <Card style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Saldo Projetado Final</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--primary)' }}>{formatBRL(saldoProjetadoFinal)}</div>
        </Card>
      </div>

      {/* Entradas de Competência do Mês Recebidas em Outro Mês */}
      {entradasCompetenciaOutroMes.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Card style={{ padding: '1.25rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Entradas deste mês recebidas em outro período (Competência)
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.25rem' }}>
              {entradasCompetenciaOutroMes.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.85rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{item.descricao}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {item.tipoDesvio === 'antecipado' ? 'Recebida antecipadamente em' : 'Recebida com atraso em'} {item.dataRecebimento}
                  </span>
                  <span style={{ fontWeight: 800, color: '#10b981', fontSize: '0.9rem', marginLeft: '0.5rem' }}>
                    {formatBRL(item.valor)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Lista de Movimentos */}
      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" />
            <span style={{ marginLeft: '0.5rem', fontWeight: 500 }}>Processando extrato...</span>
          </div>
        ) : movimentos.length === 0 ? (
          <p className="text-muted" style={{ padding: '1.5rem', margin: 0 }}>Nenhuma movimentação registrada ou provisionada para este mês.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header Columns */}
            <div className="extrato-grid extrato-header-row">
              <div>Dia</div>
              <div>Descrição</div>
              <div>Origem</div>
              <div>Status</div>
              <div style={{ textAlign: 'right' }}>Valor</div>
              <div style={{ textAlign: 'right' }}>Saldo Acumulado</div>
            </div>

            {/* Rows list */}
            {movimentos.map(mov => {
              const isInflow = mov.tipo === 'inflow';
              return (
                <div key={mov.id} className="extrato-grid extrato-movement-row">
                  {/* Dia */}
                  <div data-label="Dia" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                    {String(mov.dia).padStart(2, '0')}/{monthStr}
                  </div>

                  {/* Descrição */}
                  <div data-label="Descrição" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {mov.descricao}
                  </div>

                  {/* Origem */}
                  <div data-label="Origem">
                    <span className={`origem-badge origem-${mov.origem}`}>
                      {mov.origem === 'entrada' && <ArrowUpRight size={12} />}
                      {mov.origem === 'fixo' && <Wallet size={12} />}
                      {mov.origem === 'diario' && <Calendar size={12} />}
                      {mov.origem === 'fatura' && <CreditCard size={12} />}
                      {mov.origem === 'reserva' && <PiggyBank size={12} />}
                      {mov.origem.toUpperCase()}
                    </span>
                  </div>

                  {/* Status */}
                  <div data-label="Status">
                    <span className={`status-badge status-${mov.status}`}>
                      {mov.status}
                    </span>
                  </div>

                  {/* Valor */}
                  <div data-label="Valor" style={{ textAlign: 'right', fontWeight: 700, color: isInflow ? '#10b981' : 'var(--text-main)' }}>
                    {isInflow ? '+' : '-'} {formatBRL(mov.valor)}
                  </div>

                  {/* Saldo Acumulado */}
                  <div data-label="Saldo" style={{ textAlign: 'right', fontWeight: 800, color: mov.saldoPosMovimento! >= 0 ? 'var(--primary)' : '#ef4444' }}>
                    {formatBRL(mov.saldoPosMovimento!)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
