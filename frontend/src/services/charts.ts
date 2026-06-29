import { supabase } from '../lib/supabase';
import type { GastoFixo, RegistroGastoFixo, CategoriaDiaria, RegistroDiario, CompraParcelada, Configuracao } from '../types/database.types';
import { getLocalYearMonth } from './gastosFixos';

export interface ChartDataPoint {
  mesAno: string;      // ex: "2026-05"
  mesAnoFormatado: string; // ex: "Mai/26"
  projetadoTotal: number;
  executadoTotal: number;
  fixosProjetado: number;
  fixosExecutado: number;
  diariosProjetado: number;
  diariosExecutado: number;
  parcelasProjetado: number;
  parcelasExecutado: number;
  [key: string]: any;
}

export interface DailyForecastPoint {
  dia: number;
  diaFormatado: string;
  saldo: number;
  atrasada: boolean;
}

export interface MonthlyPerformancePoint {
  mesAno: string;
  mesAnoFormatado: string;
  receitas: number;
  despesas: number;
}

// Helpers para conversão de datas
const parseMesAno = (mesAno: string) => {
  const [y, m] = mesAno.split('-').map(Number);
  return { year: y, month: m };
};

const formatMesAnoStr = (mesAno: string) => {
  const { year, month } = parseMesAno(mesAno);
  const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${mesesAbrev[month - 1]}/${String(year).slice(-2)}`;
};

const addMonths = (mesAno: string, count: number): string => {
  const { year, month } = parseMesAno(mesAno);
  const date = new Date(year, month - 1 + count, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
};

const diffMonths = (start: string, end: string): number => {
  const s = parseMesAno(start);
  const e = parseMesAno(end);
  return (e.year - s.year) * 12 + (e.month - s.month);
};

function getParcelaAtual(mesAnoInicio: string, mesAnoAtual: string, numParcelas: number): number | null {
  const [startY, startM] = mesAnoInicio.split('-').map(Number);
  const [currY, currM] = mesAnoAtual.split('-').map(Number);
  const diff = (currY - startY) * 12 + (currM - startM);
  
  if (diff >= 0 && diff < numParcelas) {
    return diff + 1;
  }
  return null;
}

function getMesAnoAnterior(mesAno: string): string {
  const [year, month] = mesAno.split('-').map(Number);
  const date = new Date(year, month - 2, 1); // month-2 handles the 1-indexed month correctly
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
}

export const chartsService = {
  // Mantém retrocompatibilidade para as outras visualizações
  async getDashboardChartsData(currentMonthDate: Date): Promise<ChartDataPoint[]> {
    const currentYear = currentMonthDate.getFullYear();
    const currentM = String(currentMonthDate.getMonth() + 1).padStart(2, '0');
    const currentMesAno = `${currentYear}-${currentM}`;

    const [
      { data: fixos },
      { data: registrosFixos },
      { data: categoriasDiarias },
      { data: registrosDiarios },
      { data: parcelas },
      { data: configs }
    ] = await Promise.all([
      supabase.from('gastos_fixos').select('*'),
      supabase.from('registros_gastos_fixos').select('*').gte('mes_ano', `${currentYear}-01`),
      supabase.from('categorias_diarias').select('*'),
      supabase.from('registros_diarios').select('*').gte('data', `${currentYear}-01-01`),
      supabase.from('compras_parceladas').select('*'),
      supabase.from('configuracoes').select('*')
    ]);

    const activeFixos = (fixos || []) as GastoFixo[];
    const regFixos = (registrosFixos || []) as RegistroGastoFixo[];
    const catsDiarias = (categoriasDiarias || []) as CategoriaDiaria[];
    const regDiarios = (registrosDiarios || []) as RegistroDiario[];
    const allParcelas = (parcelas || []) as CompraParcelada[];
    const limiteParcelas = (configs?.[0] as Configuracao)?.limite_mensal_parcelas || 0;

    let maxMesAno = addMonths(currentMesAno, 1);

    allParcelas.forEach(p => {
      const pEndMonth = addMonths(p.mes_ano_inicio, p.num_parcelas - 1);
      if (pEndMonth > maxMesAno) {
        maxMesAno = pEndMonth;
      }
    });

    regFixos.forEach(rf => {
      if (rf.mes_ano > currentMesAno && rf.valor_previsto_ajustado !== null) {
        const nextMonth = addMonths(rf.mes_ano, 1);
        if (nextMonth > maxMesAno) {
          maxMesAno = nextMonth;
        }
      }
    });

    const mesesRange: string[] = [];
    let tempMonth = `${currentYear}-01`;
    while (tempMonth <= maxMesAno) {
      mesesRange.push(tempMonth);
      tempMonth = addMonths(tempMonth, 1);
    }

    return mesesRange.map(month => {
      const isFuture = month > currentMesAno;

      let fixosProj = 0;
      let fixosExec = 0;

      activeFixos.forEach(f => {
        const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= month;
        if (!isCreated) return;

        const reg = regFixos.find(r => r.id_gasto_fixo === f.id && r.mes_ano === month);
        
        if (f.ativo || reg) {
          const previsto = reg && reg.valor_previsto_ajustado !== null ? reg.valor_previsto_ajustado : f.valor_previsto_base;
          fixosProj += previsto;
          
          if (!isFuture) {
            fixosExec += reg ? reg.valor_real : 0;
          }
        }
      });

      const diariosProj = catsDiarias.reduce((sum, c) => sum + c.limite_mensal, 0);
      let diariosExec = 0;
      if (!isFuture) {
        diariosExec = regDiarios
          .filter(r => r.data.startsWith(month))
          .reduce((sum, r) => sum + r.valor_gasto, 0);
      }

      const parcelasProj = limiteParcelas;
      const ativas = allParcelas.filter(p => {
        const diff = diffMonths(p.mes_ano_inicio, month);
        return diff >= 0 && diff < p.num_parcelas;
      });
      const parcelasExec = ativas.reduce((sum, p) => sum + p.valor_parcela, 0);

      const totalProj = fixosProj + diariosProj + parcelasProj;
      const totalExec = fixosExec + diariosExec + parcelasExec;

      const dataPoint: ChartDataPoint = {
        mesAno: month,
        mesAnoFormatado: formatMesAnoStr(month),
        projetadoTotal: totalProj,
        executadoTotal: totalExec,
        fixosProjetado: fixosProj,
        fixosExecutado: fixosExec,
        diariosProjetado: diariosProj,
        diariosExecutado: diariosExec,
        parcelasProjetado: parcelasProj,
        parcelasExecutado: parcelasExec
      };

      catsDiarias.forEach(c => {
        const regCat = regDiarios.filter(r => r.id_categoria === c.id && r.data.startsWith(month));
        const executadoCat = regCat.reduce((sum, r) => sum + r.valor_gasto, 0);
        
        dataPoint[`cat_${c.id}_executado`] = isFuture ? 0 : executadoCat;
        dataPoint[`cat_${c.id}_projetado`] = c.limite_mensal;
      });

      return dataPoint;
    });
  },

  // Aba 1: Daily Balance Forecast
  async getDailyBalanceForecast(currentMonthDate: Date): Promise<DailyForecastPoint[]> {
    const targetYear = currentMonthDate.getFullYear();
    const targetMonth = currentMonthDate.getMonth();
    const currentMonthIso = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;

    // 1. Fetch all records from database
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

    // 2. Establish past range
    let startYear = targetYear - 1;
    let startMonth = 0;

    const allDates: string[] = [];
    if (dbEntradas) dbEntradas.forEach(e => allDates.push(e.data_entrada.substring(0, 7)));
    if (dbRegEntradas) dbRegEntradas.forEach(r => allDates.push(r.mes_ano));
    if (dbRegGastosFixos) dbRegGastosFixos.forEach(r => allDates.push(r.mes_ano));
    if (dbRegistrosDiarios) dbRegistrosDiarios.forEach(r => allDates.push(r.data.substring(0, 7)));
    if (dbComprasParceladas) dbComprasParceladas.forEach(p => allDates.push(p.mes_ano_inicio));
    if (dbPagamentosFaturas) dbPagamentosFaturas.forEach(f => allDates.push(f.mes_ano));

    if (allDates.length > 0) {
      allDates.sort();
      const [minY, minM] = allDates[0].split('-').map(Number);
      if (minY < targetYear || (minY === targetYear && (minM - 1) < targetMonth)) {
        startYear = minY;
        startMonth = minM - 1;
      }
    }

    const pastMonths: string[] = [];
    let tempDate = new Date(startYear, startMonth, 1);
    const limitDate = new Date(targetYear, targetMonth, 1);

    while (tempDate < limitDate) {
      const y = tempDate.getFullYear();
      const mStr = String(tempDate.getMonth() + 1).padStart(2, '0');
      pastMonths.push(`${y}-${mStr}`);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }

    // 3. Compute retroactive balance up to M-1
    let saldoAcumulado = 0;

    for (const m of pastMonths) {
      // Receitas
      let inflowsM = 0;
      const pontuaisEmM = (dbEntradas || []).filter(e => !e.projetar && e.data_entrada.substring(0, 7) === m);
      pontuaisEmM.forEach(e => {
        inflowsM += Number(e.valor_previsto_base);
      });

      const recorrentesEmM = (dbEntradas || []).filter(e => {
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
        const reg = (dbRegEntradas || []).find(r => r.id_entrada === e.id && r.mes_ano === C);
        if (reg) {
          inflowsM += Number(reg.valor_real);
        } else if (e.ativo) {
          inflowsM += Number(e.valor_previsto_base);
        }
      });

      // Despesas Fixas
      let fixedM = 0;
      const fixosVigentes = (dbGastosFixos || []).filter(f => {
        const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= m;
        return isCreated && (f.ativo || (dbRegGastosFixos || []).some(r => r.id_gasto_fixo === f.id && r.mes_ano === m));
      });

      fixosVigentes.forEach(f => {
        const reg = (dbRegGastosFixos || []).find(r => r.id_gasto_fixo === f.id && r.mes_ano === m);
        if (reg) {
          fixedM += Number(reg.valor_real);
        } else if (f.ativo) {
          fixedM += Number(f.valor_previsto_base);
        }
      });

      // Despesas Diárias
      const dailyM = (dbRegistrosDiarios || [])
        .filter(r => r.data.substring(0, 7) === m)
        .reduce((sum, r) => sum + Number(r.valor_gasto), 0);

      // Fatura Cartão M-1 paga em M
      const m1 = getMesAnoAnterior(m);
      const faturaM1 = (dbComprasParceladas || []).filter(compra => {
        const p = getParcelaAtual(compra.mes_ano_inicio, m1, compra.num_parcelas);
        return p !== null;
      }).reduce((sum, p) => sum + Number(p.valor_parcela), 0);

      const pagoFaturaM1 = (dbPagamentosFaturas || []).find(f => f.mes_ano === m1 && f.pago === true);
      const ccM = pagoFaturaM1 ? faturaM1 : 0;

      // Reserva
      let reservaInflowsM = 0;
      let reservaOutflowsM = 0;

      (dbMovsReserva || [])
        .filter(mov => !mov.projetar && mov.data_movimentacao.substring(0, 7) === m && mov.afeta_conta_geral)
        .forEach(mov => {
          if (mov.tipo === 'saida') reservaInflowsM += Number(mov.valor_previsto_base);
          else reservaOutflowsM += Number(mov.valor_previsto_base);
        });

      (dbRegsReserva || [])
        .filter(r => r.mes_ano === m && r.afeta_conta_geral)
        .forEach(r => {
          const parent = (dbMovsReserva || []).find(mov => mov.id === r.id_movimentacao);
          if (parent) {
            if (parent.tipo === 'saida') reservaInflowsM += Number(r.valor_real);
            else reservaOutflowsM += Number(r.valor_real);
          }
        });

      saldoAcumulado += (inflowsM + reservaInflowsM - fixedM - dailyM - ccM - reservaOutflowsM);
    }

    const saldo_acumulado_inicial = saldoAcumulado;

    // 4. Calculate day by day for current month M
    const realToday = new Date();
    const realTodayDay = realToday.getDate();
    const realTodayMonthIso = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}`;

    let isTodayPast10 = false;
    if (currentMonthIso === realTodayMonthIso) {
      isTodayPast10 = realTodayDay > 10;
    } else if (currentMonthIso < realTodayMonthIso) {
      isTodayPast10 = true;
    } else {
      isTodayPast10 = false;
    }

    // Fatura anterior (M-1)
    const mesAnoAnterior = getMesAnoAnterior(currentMonthIso);
    const faturaAnterior = (dbComprasParceladas || []).filter(compra => {
      const p = getParcelaAtual(compra.mes_ano_inicio, mesAnoAnterior, compra.num_parcelas);
      return p !== null;
    }).reduce((sum, p) => sum + Number(p.valor_parcela), 0);

    const pagoFaturaAnterior = (dbPagamentosFaturas || []).find(f => f.mes_ano === mesAnoAnterior);
    const ccPaid = pagoFaturaAnterior ? pagoFaturaAnterior.pago : false;
    const ccDiaPagamentoReal = pagoFaturaAnterior ? pagoFaturaAnterior.dia_pagamento_real : null;

    const dailyPoints: DailyForecastPoint[] = [];
    let currentBalance = saldo_acumulado_inicial;

    const pontuaisNoMes = (dbEntradas || []).filter(e => !e.projetar && e.data_entrada.substring(0, 7) === currentMonthIso);
    
    const recorrentesNoMes = (dbEntradas || []).filter(e => {
      if (!e.projetar) return false;
      const d = e.desvio_competencia || 0;
      const C = addMonths(currentMonthIso, d);
      const competenciaInicio = addMonths(e.data_entrada.substring(0, 7), d);
      const startsOnOrBefore = competenciaInicio <= C;
      const endsOnOrAfter = !e.mes_ano_fim || e.mes_ano_fim >= C;
      return startsOnOrBefore && endsOnOrAfter;
    });

    const activeFixos = (dbGastosFixos || []).filter(f => {
      const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= currentMonthIso;
      return isCreated && (f.ativo || (dbRegGastosFixos || []).some(r => r.id_gasto_fixo === f.id && r.mes_ano === currentMonthIso));
    });

    const totalLimiteMensalCategorias = (dbCategoriasDiarias || []).reduce((sum, c) => sum + Number(c.limite_mensal), 0);

    for (let d = 1; d <= 31; d++) {
      // a) Inflows
      let inflowsDay = 0;
      
      pontuaisNoMes.forEach(e => {
        const entryDay = Number(e.data_entrada.split('-')[2]);
        if (entryDay === d) {
          inflowsDay += Number(e.valor_previsto_base);
        }
      });

      recorrentesNoMes.forEach(e => {
        const entryDay = Number(e.data_entrada.split('-')[2]);
        if (entryDay === d) {
          const dev = e.desvio_competencia || 0;
          const C = addMonths(currentMonthIso, dev);
          const reg = (dbRegEntradas || []).find(r => r.id_entrada === e.id && r.mes_ano === C);
          if (reg) {
            inflowsDay += Number(reg.valor_real);
          } else if (e.ativo) {
            inflowsDay += Number(e.valor_previsto_base);
          }
        }
      });

      // b) Fixed Expenses
      let fixedDay = 0;
      activeFixos.forEach(f => {
        const reg = (dbRegGastosFixos || []).find(r => r.id_gasto_fixo === f.id && r.mes_ano === currentMonthIso);
        const hasRealPaid = reg && reg.valor_real > 0;
        
        if (hasRealPaid) {
          const paidDay = (reg!.dia_pagamento_real && reg!.dia_pagamento_real > 0) ? reg!.dia_pagamento_real : f.dia_pagamento_previsto;
          if (paidDay === d) {
            fixedDay += Number(reg!.valor_real);
          }
        } else {
          if (f.dia_pagamento_previsto === d) {
            const previsto = reg && reg.valor_previsto_ajustado !== null ? reg.valor_previsto_ajustado : f.valor_previsto_base;
            fixedDay += Number(previsto);
          }
        }
      });

      // c) Daily Expenses
      let dailyDay = 0;
      const dayStr = `${currentMonthIso}-${String(d).padStart(2, '0')}`;
      const recordsForDay = (dbRegistrosDiarios || []).filter(r => r.data === dayStr);

      const isFutureDay = currentMonthIso > realTodayMonthIso || (currentMonthIso === realTodayMonthIso && d > realTodayDay);

      if (recordsForDay.length > 0) {
        dailyDay = recordsForDay.reduce((sum, r) => sum + Number(r.valor_gasto), 0);
      } else {
        if (isFutureDay) {
          dailyDay = totalLimiteMensalCategorias / 31;
        } else {
          dailyDay = 0;
        }
      }

      // d) Credit Card Bill
      let ccDebitDay = 0;
      let isAtrasada = false;

      if (ccPaid && ccDiaPagamentoReal !== null) {
        if (ccDiaPagamentoReal === d) {
          ccDebitDay = faturaAnterior;
        }
      } else if (faturaAnterior > 0) {
        if (!isTodayPast10) {
          if (d === 10) {
            ccDebitDay = faturaAnterior;
          }
        } else {
          if (d >= 10) {
            isAtrasada = true;
          }
        }
      }

      // e) Reserva (depósitos como saídas, resgates como entradas na conta geral)
      let reservaInflowsDay = 0;
      let reservaOutflowsDay = 0;

      const activeMovsReserva = (dbMovsReserva || []).filter(mov => {
        const startMonth = mov.data_movimentacao.substring(0, 7);
        if (!mov.projetar) {
          return startMonth === currentMonthIso && mov.afeta_conta_geral;
        }
        if (startMonth > currentMonthIso) return false;
        if (mov.mes_ano_fim && currentMonthIso > mov.mes_ano_fim) return false;
        return mov.afeta_conta_geral;
      });

      activeMovsReserva.forEach(mov => {
        if (!mov.projetar) {
          const entryDay = Number(mov.data_movimentacao.split('-')[2]);
          if (entryDay === d) {
            if (mov.tipo === 'saida') reservaInflowsDay += Number(mov.valor_previsto_base);
            else reservaOutflowsDay += Number(mov.valor_previsto_base);
          }
        } else {
          const reg = (dbRegsReserva || []).find(r => r.id_movimentacao === mov.id && r.mes_ano === currentMonthIso);
          if (reg) {
            const paidDay = reg.dia_movimentacao_real || mov.dia_movimentacao_previsto;
            if (paidDay === d) {
              if (mov.tipo === 'saida') reservaInflowsDay += Number(reg.valor_real);
              else reservaOutflowsDay += Number(reg.valor_real);
            }
          } else if (mov.ativo) {
            if (mov.dia_movimentacao_previsto === d) {
              if (mov.tipo === 'saida') reservaInflowsDay += Number(mov.valor_previsto_base);
              else reservaOutflowsDay += Number(mov.valor_previsto_base);
            }
          }
        }
      });

      currentBalance = currentBalance + inflowsDay + reservaInflowsDay - fixedDay - dailyDay - ccDebitDay - reservaOutflowsDay;

      dailyPoints.push({
        dia: d,
        diaFormatado: String(d).padStart(2, '0'),
        saldo: Number(currentBalance.toFixed(2)),
        atrasada: isAtrasada
      });
    }

    return dailyPoints;
  },

  // Aba 2: Monthly Performance
  async getMonthlyPerformance(currentMonthDate: Date): Promise<MonthlyPerformancePoint[]> {
    const targetYear = currentMonthDate.getFullYear();
    const targetMonth = currentMonthDate.getMonth();

    const [
      { data: dbEntradas },
      { data: dbRegEntradas },
      { data: dbGastosFixos },
      { data: dbRegGastosFixos },
      { data: dbRegistrosDiarios },
      { data: dbComprasParceladas },
      { data: dbMovsReserva },
      { data: dbRegsReserva }
    ] = await Promise.all([
      supabase.from('entradas').select('*'),
      supabase.from('registros_entradas').select('*'),
      supabase.from('gastos_fixos').select('*'),
      supabase.from('registros_gastos_fixos').select('*'),
      supabase.from('registros_diarios').select('*'),
      supabase.from('compras_parceladas').select('*'),
      supabase.from('movimentacoes_reserva').select('*'),
      supabase.from('registros_movimentacoes_reserva').select('*')
    ]);

    // Build performance range (last 6 months up to current month)
    const performanceMonths: string[] = [];
    const tempPerfDate = new Date(targetYear, targetMonth - 5, 1);
    const endPerfDate = new Date(targetYear, targetMonth + 1, 1);

    while (tempPerfDate < endPerfDate) {
      const y = tempPerfDate.getFullYear();
      const mStr = String(tempPerfDate.getMonth() + 1).padStart(2, '0');
      performanceMonths.push(`${y}-${mStr}`);
      tempPerfDate.setMonth(tempPerfDate.getMonth() + 1);
    }

    return performanceMonths.map(m => {
      // Receitas (Competência)
      let inflowsM = 0;
      const entradasVigentes = (dbEntradas || []).filter(e => {
        const mesAnoInicio = e.data_entrada.substring(0, 7);
        if (!e.projetar) {
          return mesAnoInicio === m;
        }
        const competenciaInicio = addMonths(mesAnoInicio, e.desvio_competencia || 0);
        const startsOnOrBefore = competenciaInicio <= m;
        const endsOnOrAfter = !e.mes_ano_fim || e.mes_ano_fim >= m;
        return startsOnOrBefore && endsOnOrAfter;
      });

      entradasVigentes.forEach(e => {
        if (!e.projetar) {
          inflowsM += Number(e.valor_previsto_base);
        } else {
          const reg = (dbRegEntradas || []).find(r => r.id_entrada === e.id && r.mes_ano === m);
          if (reg) {
            inflowsM += Number(reg.valor_real);
          } else if (e.ativo) {
            inflowsM += Number(e.valor_previsto_base);
          }
        }
      });

      // Despesas Fixas
      let fixedM = 0;
      const fixosVigentes = (dbGastosFixos || []).filter(f => {
        const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= m;
        return isCreated && (f.ativo || (dbRegGastosFixos || []).some(r => r.id_gasto_fixo === f.id && r.mes_ano === m));
      });

      fixosVigentes.forEach(f => {
        const reg = (dbRegGastosFixos || []).find(r => r.id_gasto_fixo === f.id && r.mes_ano === m);
        if (reg) {
          fixedM += Number(reg.valor_real);
        } else if (f.ativo) {
          fixedM += Number(f.valor_previsto_base);
        }
      });

      // Despesas Diárias
      const dailyM = (dbRegistrosDiarios || [])
        .filter(r => r.data.substring(0, 7) === m)
        .reduce((sum, r) => sum + Number(r.valor_gasto), 0);

      // Fatura Cartão de Crédito
      const ccM = (dbComprasParceladas || []).filter(compra => {
        const p = getParcelaAtual(compra.mes_ano_inicio, m, compra.num_parcelas);
        return p !== null;
      }).reduce((sum, p) => sum + Number(p.valor_parcela), 0);

      // Impacto da Reserva no mês m
      let reservaInflowsM = 0;
      let reservaOutflowsM = 0;

      (dbMovsReserva || [])
        .filter(mov => !mov.projetar && mov.data_movimentacao.substring(0, 7) === m && mov.afeta_conta_geral)
        .forEach(mov => {
          if (mov.tipo === 'saida') reservaInflowsM += Number(mov.valor_previsto_base);
          else reservaOutflowsM += Number(mov.valor_previsto_base);
        });

      (dbRegsReserva || [])
        .filter(r => r.mes_ano === m && r.afeta_conta_geral)
        .forEach(r => {
          const parent = (dbMovsReserva || []).find(mov => mov.id === r.id_movimentacao);
          if (parent) {
            if (parent.tipo === 'saida') reservaInflowsM += Number(r.valor_real);
            else reservaOutflowsM += Number(r.valor_real);
          }
        });

      const totalDespesas = fixedM + dailyM + ccM + reservaOutflowsM;

      return {
        mesAno: m,
        mesAnoFormatado: formatMesAnoStr(m),
        receitas: Number((inflowsM + reservaInflowsM).toFixed(2)),
        despesas: Number(totalDespesas.toFixed(2))
      };
    });
  }
};
