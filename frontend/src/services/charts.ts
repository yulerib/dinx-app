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
  entradas?: number;
  fixos?: number;
  diarios?: number;
  reserva?: number;
  cartao?: number;
}

export interface MonthlyPerformancePoint {
  mesAno: string;
  mesAnoFormatado: string;
  receitas: number;
  despesas: number;
}

export interface DailyCalendarItem {
  descricao: string;
  valor: number;
  isExecutado: boolean; // true if valor_real was explicitly set (even if 0)
}

export interface DailyCalendarPoint {
  dia: number;
  diaFormatado: string;
  entradas: DailyCalendarItem[];
  saidasFixas: DailyCalendarItem[];
  saidasDiarias: DailyCalendarItem[];
  totalEntradas: number;
  totalSaidasFixas: number;
  totalSaidasDiarias: number;
  saldoConta: number;
  saldoReserva: number;
  isToday: boolean;
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

const getSalarioForMonth = (dbSalarios: any[], mesAno: string) => {
  const exact = dbSalarios.find(s => s.mes_ano === mesAno);
  if (exact) return exact;

  const inherited = [...dbSalarios]
    .filter(s => s.mes_ano <= mesAno)
    .sort((a, b) => b.mes_ano.localeCompare(a.mes_ano))[0];

  if (inherited) {
    return {
      ...inherited,
      mes_ano: mesAno,
      valor_real: null,
      data_real: null,
      id: ''
    };
  }
  return null;
};

function getMesAnoAnterior(mesAno: string): string {
  const [year, month] = mesAno.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
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
      { data: dbRegsReserva },
      { data: dbSalarios }
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
      supabase.from('registros_movimentacoes_reserva').select('*'),
      supabase.from('salario').select('*')
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

    // Build virtualSalarios for past, current and next months
    const minMonth = pastMonths.length > 0 ? pastMonths[0] : currentMonthIso;
    const maxReferenceMonth = addMonths(currentMonthIso, 2);

    const virtualSalarios: any[] = [];
    let tempM = minMonth;
    while (tempM <= maxReferenceMonth) {
      const sal = getSalarioForMonth(dbSalarios || [], tempM);
      if (sal) {
        virtualSalarios.push(sal);
      }
      tempM = addMonths(tempM, 1);
    }

    // 3. Compute retroactive balance up to M-1
    let saldoAcumulado = 0;

    for (const m of pastMonths) {
      // Receitas — entradas normais
      let inflowsM = 0;
      
      // Entradas pontuais neste mês
      const pontuaisEmM = (dbEntradas || []).filter(e => !e.projetar && e.data_entrada.substring(0, 7) === m);
      pontuaisEmM.forEach(e => {
        inflowsM += Number(e.valor_previsto_base);
      });

      // Entradas recorrentes vigentes neste mês
      const recorrentesEmM = (dbEntradas || []).filter(e => {
        if (!e.projetar) return false;
        const startMonth = e.data_entrada.substring(0, 7);
        return startMonth <= m && (!e.mes_ano_fim || e.mes_ano_fim >= m);
      });

      recorrentesEmM.forEach(e => {
        const reg = (dbRegEntradas || []).find(r => r.id_entrada === e.id && r.mes_ano === m);
        if (reg && Number(reg.valor_real) > 0) {
          inflowsM += Number(reg.valor_real);
        } else if (e.ativo) {
          inflowsM += Number(e.valor_previsto_base);
        }
      });

      // Salário cujo recebimento físico ocorreu no mês m
      let salarioMTotal = 0;
      virtualSalarios.forEach(s => {
        let physicalMonth = '';
        if (s.data_real) {
          physicalMonth = s.data_real.substring(0, 7);
        } else {
          const desvio = s.desvio_mes_deposito ?? 0;
          physicalMonth = addMonths(s.mes_ano, desvio);
        }

        if (physicalMonth === m) {
          if (s.valor_real !== null && s.valor_real !== undefined) {
            salarioMTotal += Number(s.valor_real);
          } else if (s.valor_previsto > 0) {
            salarioMTotal += Number(s.valor_previsto);
          }
        }
      });
      inflowsM += salarioMTotal;

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

    // Entradas normais do mês atual
    const pontuaisNoMes = (dbEntradas || []).filter(e => !e.projetar && e.data_entrada.substring(0, 7) === currentMonthIso);
    
    const recorrentesNoMes = (dbEntradas || []).filter(e => {
      if (!e.projetar) return false;
      const startMonth = e.data_entrada.substring(0, 7);
      return startMonth <= currentMonthIso && (!e.mes_ano_fim || e.mes_ano_fim >= currentMonthIso);
    });

    const activeFixos = (dbGastosFixos || []).filter(f => {
      const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= currentMonthIso;
      return isCreated && (f.ativo || (dbRegGastosFixos || []).some(r => r.id_gasto_fixo === f.id && r.mes_ano === currentMonthIso));
    });

    const totalLimiteMensalCategorias = (dbCategoriasDiarias || []).reduce((sum, c) => sum + Number(c.limite_mensal), 0);



    for (let d = 1; d <= 31; d++) {
      // a) Inflows — entradas normais
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
          const reg = (dbRegEntradas || []).find(r => r.id_entrada === e.id && r.mes_ano === currentMonthIso);
          if (reg && Number(reg.valor_real) > 0) {
            inflowsDay += Number(reg.valor_real);
          } else if (e.ativo) {
            inflowsDay += Number(e.valor_previsto_base);
          }
        }
      });

      // Salário no dia correto do gráfico
      let salarioDay = 0;
      virtualSalarios.forEach(s => {
        let physicalMonth = '';
        let physicalDay = 0;
        let value = 0;

        if (s.data_real) {
          physicalMonth = s.data_real.substring(0, 7);
          physicalDay = Number(s.data_real.split('-')[2]);
          value = Number(s.valor_real);
        } else {
          const desvio = s.desvio_mes_deposito ?? 0;
          physicalMonth = addMonths(s.mes_ano, desvio);
          physicalDay = s.dia_previsto || 5;
          value = Number(s.valor_previsto);
        }

        if (physicalMonth === currentMonthIso && physicalDay === d) {
          salarioDay += value;
        }
      });
      inflowsDay += salarioDay;

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

      const ccValue = (pagoFaturaAnterior && Number(pagoFaturaAnterior.valor_pago) > 0) 
        ? Number(pagoFaturaAnterior.valor_pago) 
        : faturaAnterior;

      if (ccPaid) {
        const ccDia = ccDiaPagamentoReal || 10;
        if (d === ccDia) {
          ccDebitDay = ccValue;
        }
      } else if (faturaAnterior > 0) {
        if (d === 10) {
          ccDebitDay = ccValue;
        }
        if (isTodayPast10 && d >= 10) {
          isAtrasada = true;
        }
      }

      // e) Reserva
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
        atrasada: isAtrasada,
        entradas: inflowsDay,
        fixos: fixedDay,
        diarios: dailyDay,
        reserva: reservaInflowsDay - reservaOutflowsDay,
        cartao: ccDebitDay
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
      { data: dbRegsReserva },
      { data: dbSalarios }
    ] = await Promise.all([
      supabase.from('entradas').select('*'),
      supabase.from('registros_entradas').select('*'),
      supabase.from('gastos_fixos').select('*'),
      supabase.from('registros_gastos_fixos').select('*'),
      supabase.from('registros_diarios').select('*'),
      supabase.from('compras_parceladas').select('*'),
      supabase.from('movimentacoes_reserva').select('*'),
      supabase.from('registros_movimentacoes_reserva').select('*'),
      supabase.from('salario').select('*')
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
      // Receitas — contabilizadas no mês de referência
      let inflowsM = 0;

      // Entradas normais vigentes no mês m
      const entradasVigentes = (dbEntradas || []).filter(e => {
        const mesAnoInicio = e.data_entrada.substring(0, 7);
        if (!e.projetar) {
          return mesAnoInicio === m;
        }
        return mesAnoInicio <= m && (!e.mes_ano_fim || e.mes_ano_fim >= m);
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

      // Salário: contabilizado sempre no mês de referência (mes_ano)
      const salarioM = (dbSalarios || []).find(s => s.mes_ano === m);
      if (salarioM) {
        if (salarioM.valor_real !== null && salarioM.valor_real !== undefined) {
          inflowsM += Number(salarioM.valor_real);
        } else if (salarioM.valor_previsto > 0) {
          inflowsM += Number(salarioM.valor_previsto);
        }
      }

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
  },

  // Aba 3: Daily Calendar
  async getDailyCalendarData(currentMonthDate: Date): Promise<DailyCalendarPoint[]> {
    const targetYear = currentMonthDate.getFullYear();
    const targetMonth = currentMonthDate.getMonth();
    const currentMonthIso = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    const realToday = new Date();
    const realTodayDay = realToday.getDate();
    const realTodayMonthIso = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}`;

    // 1. Fetch all data
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
      { data: dbRegsReserva },
      { data: dbSalarios }
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
      supabase.from('registros_movimentacoes_reserva').select('*'),
      supabase.from('salario').select('*')
    ]);

    // 2. Build past months range
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

    // Build virtual salarios
    const minMonth = pastMonths.length > 0 ? pastMonths[0] : currentMonthIso;
    const maxReferenceMonth = addMonths(currentMonthIso, 2);
    const virtualSalarios: any[] = [];
    let tempM = minMonth;
    while (tempM <= maxReferenceMonth) {
      const sal = getSalarioForMonth(dbSalarios || [], tempM);
      if (sal) virtualSalarios.push(sal);
      tempM = addMonths(tempM, 1);
    }

    // 3. Compute retroactive balance and reserve balance up to M-1
    let saldoAcumulado = 0;
    let reserveBalance = 0;

    for (const m of pastMonths) {
      let inflowsM = 0;
      const pontuaisEmM = (dbEntradas || []).filter(e => !e.projetar && e.data_entrada.substring(0, 7) === m);
      pontuaisEmM.forEach(e => { inflowsM += Number(e.valor_previsto_base); });

      const recorrentesEmM = (dbEntradas || []).filter(e => {
        if (!e.projetar) return false;
        const sm = e.data_entrada.substring(0, 7);
        return sm <= m && (!e.mes_ano_fim || e.mes_ano_fim >= m);
      });
      recorrentesEmM.forEach(e => {
        const reg = (dbRegEntradas || []).find(r => r.id_entrada === e.id && r.mes_ano === m);
        if (reg && Number(reg.valor_real) > 0) inflowsM += Number(reg.valor_real);
        else if (e.ativo) inflowsM += Number(e.valor_previsto_base);
      });

      let salarioMTotal = 0;
      virtualSalarios.forEach(s => {
        let physicalMonth = '';
        if (s.data_real) physicalMonth = s.data_real.substring(0, 7);
        else { const desvio = s.desvio_mes_deposito ?? 0; physicalMonth = addMonths(s.mes_ano, desvio); }
        if (physicalMonth === m) {
          if (s.valor_real !== null && s.valor_real !== undefined) salarioMTotal += Number(s.valor_real);
          else if (s.valor_previsto > 0) salarioMTotal += Number(s.valor_previsto);
        }
      });
      inflowsM += salarioMTotal;

      let fixedM = 0;
      const fixosVigentes = (dbGastosFixos || []).filter(f => {
        const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= m;
        return isCreated && (f.ativo || (dbRegGastosFixos || []).some(r => r.id_gasto_fixo === f.id && r.mes_ano === m));
      });
      fixosVigentes.forEach(f => {
        const reg = (dbRegGastosFixos || []).find(r => r.id_gasto_fixo === f.id && r.mes_ano === m);
        if (reg) fixedM += Number(reg.valor_real);
        else if (f.ativo) fixedM += Number(f.valor_previsto_base);
      });

      const dailyM = (dbRegistrosDiarios || []).filter(r => r.data.substring(0, 7) === m).reduce((sum, r) => sum + Number(r.valor_gasto), 0);

      const m1 = getMesAnoAnterior(m);
      const faturaM1 = (dbComprasParceladas || []).filter(compra => getParcelaAtual(compra.mes_ano_inicio, m1, compra.num_parcelas) !== null).reduce((sum, p) => sum + Number(p.valor_parcela), 0);
      const pagoFaturaM1 = (dbPagamentosFaturas || []).find(f => f.mes_ano === m1 && f.pago === true);
      const ccM = pagoFaturaM1 ? faturaM1 : 0;

      let reservaInflowsM = 0;
      let reservaOutflowsM = 0;
      (dbMovsReserva || []).filter(mov => !mov.projetar && mov.data_movimentacao.substring(0, 7) === m && mov.afeta_conta_geral).forEach(mov => {
        if (mov.tipo === 'saida') reservaInflowsM += Number(mov.valor_previsto_base);
        else reservaOutflowsM += Number(mov.valor_previsto_base);
      });
      (dbRegsReserva || []).filter(r => r.mes_ano === m && r.afeta_conta_geral).forEach(r => {
        const parent = (dbMovsReserva || []).find(mov => mov.id === r.id_movimentacao);
        if (parent) {
          if (parent.tipo === 'saida') reservaInflowsM += Number(r.valor_real);
          else reservaOutflowsM += Number(r.valor_real);
        }
      });

      saldoAcumulado += (inflowsM + reservaInflowsM - fixedM - dailyM - ccM - reservaOutflowsM);

      // Reserve balance for past months
      (dbMovsReserva || []).filter(mov => !mov.projetar && mov.data_movimentacao.substring(0, 7) === m).forEach(mov => {
        if (mov.tipo === 'entrada') reserveBalance += Number(mov.valor_previsto_base);
        else reserveBalance -= Number(mov.valor_previsto_base);
      });
      (dbRegsReserva || []).filter(r => r.mes_ano === m).forEach(r => {
        const parent = (dbMovsReserva || []).find(mov => mov.id === r.id_movimentacao);
        if (parent) {
          if (parent.tipo === 'entrada') reserveBalance += Number(r.valor_real);
          else reserveBalance -= Number(r.valor_real);
        }
      });
    }

    // 4. Prepare current month data
    const pontuaisNoMes = (dbEntradas || []).filter(e => !e.projetar && e.data_entrada.substring(0, 7) === currentMonthIso);
    const recorrentesNoMes = (dbEntradas || []).filter(e => {
      if (!e.projetar) return false;
      const sm = e.data_entrada.substring(0, 7);
      return sm <= currentMonthIso && (!e.mes_ano_fim || e.mes_ano_fim >= currentMonthIso);
    });
    const activeFixos = (dbGastosFixos || []).filter(f => {
      const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= currentMonthIso;
      return isCreated && (f.ativo || (dbRegGastosFixos || []).some(r => r.id_gasto_fixo === f.id && r.mes_ano === currentMonthIso));
    });
    const totalLimiteMensalCategorias = (dbCategoriasDiarias || []).reduce((sum, c) => sum + Number(c.limite_mensal), 0);

    // Category name map
    const catNameMap = new Map<string, string>();
    (dbCategoriasDiarias || []).forEach(c => catNameMap.set(c.id, c.nome));

    // CC bill from previous month
    const mesAnoAnterior = getMesAnoAnterior(currentMonthIso);
    const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const [prevY, prevMo] = mesAnoAnterior.split('-').map(Number);
    const prevMonthLabel = `${mesesAbrev[prevMo - 1]}/${String(prevY).slice(-2)}`;
    const faturaAnterior = (dbComprasParceladas || []).filter(compra => getParcelaAtual(compra.mes_ano_inicio, mesAnoAnterior, compra.num_parcelas) !== null).reduce((sum, p) => sum + Number(p.valor_parcela), 0);
    const pagoFaturaAnterior = (dbPagamentosFaturas || []).find(f => f.mes_ano === mesAnoAnterior);
    const ccPaid = pagoFaturaAnterior ? pagoFaturaAnterior.pago : false;
    const ccDiaPagamentoReal = pagoFaturaAnterior ? pagoFaturaAnterior.dia_pagamento_real : null;
    const ccValue = (pagoFaturaAnterior && Number(pagoFaturaAnterior.valor_pago) > 0) ? Number(pagoFaturaAnterior.valor_pago) : faturaAnterior;

    // Reserve movements for current month
    const activeMovsReserva = (dbMovsReserva || []).filter(mov => {
      const sm = mov.data_movimentacao.substring(0, 7);
      if (!mov.projetar) return sm === currentMonthIso && mov.afeta_conta_geral;
      if (sm > currentMonthIso) return false;
      if (mov.mes_ano_fim && currentMonthIso > mov.mes_ano_fim) return false;
      return mov.afeta_conta_geral;
    });

    // All reserve movements for current month (for saldoReserva tracking, including non-afeta_conta_geral)
    const allReserveMovsCurrentMonth = (dbMovsReserva || []).filter(mov => {
      const sm = mov.data_movimentacao.substring(0, 7);
      if (!mov.projetar) return sm === currentMonthIso;
      if (sm > currentMonthIso) return false;
      if (mov.mes_ano_fim && currentMonthIso > mov.mes_ano_fim) return false;
      return true;
    });

    // 5. Day-by-day iteration
    const dailyPoints: DailyCalendarPoint[] = [];
    let currentBalance = saldoAcumulado;
    let currentReserveBalance = reserveBalance;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${currentMonthIso}-${String(d).padStart(2, '0')}`;
      const isFutureDay = currentMonthIso > realTodayMonthIso || (currentMonthIso === realTodayMonthIso && d > realTodayDay);
      const isToday = currentMonthIso === realTodayMonthIso && d === realTodayDay;

      const entradas: DailyCalendarItem[] = [];
      const saidasFixas: DailyCalendarItem[] = [];
      const saidasDiarias: DailyCalendarItem[] = [];

      // --- ENTRADAS ---
      // Salary
      virtualSalarios.forEach(s => {
        let physicalMonth = '';
        let physicalDay = 0;
        let value = 0;
        let isExec = false;
        if (s.data_real) {
          physicalMonth = s.data_real.substring(0, 7);
          physicalDay = Number(s.data_real.split('-')[2]);
          value = Number(s.valor_real);
          isExec = true;
        } else {
          const desvio = s.desvio_mes_deposito ?? 0;
          physicalMonth = addMonths(s.mes_ano, desvio);
          physicalDay = s.dia_previsto || 5;
          value = Number(s.valor_previsto);
          isExec = false;
        }
        if (physicalMonth === currentMonthIso && physicalDay === d) {
          const [refY, refM] = s.mes_ano.split('-').map(Number);
          entradas.push({ descricao: `Salário ${mesesAbrev[refM - 1]}/${String(refY).slice(-2)}`, valor: value, isExecutado: isExec });
        }
      });

      // Pontual entries
      pontuaisNoMes.forEach(e => {
        const entryDay = Number(e.data_entrada.split('-')[2]);
        if (entryDay === d) {
          entradas.push({ descricao: e.descricao, valor: Number(e.valor_previsto_base), isExecutado: true });
        }
      });

      // Recurrent entries
      recorrentesNoMes.forEach(e => {
        const entryDay = Number(e.data_entrada.split('-')[2]);
        if (entryDay === d) {
          const reg = (dbRegEntradas || []).find(r => r.id_entrada === e.id && r.mes_ano === currentMonthIso);
          const isExec = reg !== undefined && reg !== null;
          const value = isExec ? Number(reg!.valor_real) : (e.ativo ? Number(e.valor_previsto_base) : 0);
          if (value > 0 || isExec) {
            entradas.push({ descricao: e.descricao, valor: value, isExecutado: isExec });
          }
        }
      });

      // Reserve withdrawals (saida = money from reserve TO account = inflow for account)
      activeMovsReserva.forEach(mov => {
        if (mov.tipo !== 'saida') return;
        if (!mov.projetar) {
          const entryDay = Number(mov.data_movimentacao.split('-')[2]);
          if (entryDay === d) {
            entradas.push({ descricao: `Resgate Reserva: ${mov.descricao}`, valor: Number(mov.valor_previsto_base), isExecutado: true });
          }
        } else {
          const reg = (dbRegsReserva || []).find(r => r.id_movimentacao === mov.id && r.mes_ano === currentMonthIso);
          if (reg) {
            const paidDay = reg.dia_movimentacao_real || mov.dia_movimentacao_previsto;
            if (paidDay === d) {
              entradas.push({ descricao: `Resgate Reserva: ${mov.descricao}`, valor: Number(reg.valor_real), isExecutado: true });
            }
          } else if (mov.ativo && mov.dia_movimentacao_previsto === d) {
            entradas.push({ descricao: `Resgate Reserva: ${mov.descricao}`, valor: Number(mov.valor_previsto_base), isExecutado: false });
          }
        }
      });

      // --- SAÍDAS FIXAS ---
      // Fixed expenses
      activeFixos.forEach(f => {
        const reg = (dbRegGastosFixos || []).find(r => r.id_gasto_fixo === f.id && r.mes_ano === currentMonthIso);
        const hasReal = reg && reg.valor_real !== null && reg.valor_real !== undefined;
        if (hasReal) {
          const paidDay = (reg!.dia_pagamento_real && reg!.dia_pagamento_real > 0) ? reg!.dia_pagamento_real : f.dia_pagamento_previsto;
          if (paidDay === d) {
            saidasFixas.push({ descricao: f.nome, valor: Number(reg!.valor_real), isExecutado: true });
          }
        } else {
          if (f.dia_pagamento_previsto === d) {
            const previsto = reg && reg.valor_previsto_ajustado !== null ? reg.valor_previsto_ajustado : f.valor_previsto_base;
            saidasFixas.push({ descricao: f.nome, valor: Number(previsto), isExecutado: false });
          }
        }
      });

      // Credit card bill
      if (faturaAnterior > 0 || (ccPaid && ccValue > 0)) {
        if (ccPaid) {
          const ccDia = ccDiaPagamentoReal || 10;
          if (d === ccDia) {
            saidasFixas.push({ descricao: `Fatura Cartão (${prevMonthLabel})`, valor: ccValue, isExecutado: true });
          }
        } else if (faturaAnterior > 0 && d === 10) {
          saidasFixas.push({ descricao: `Fatura Cartão (${prevMonthLabel})`, valor: ccValue, isExecutado: false });
        }
      }

      // Reserve deposits — previsionado (projetar=true) = saída fixa
      activeMovsReserva.forEach(mov => {
        if (mov.tipo !== 'entrada') return;
        if (!mov.projetar) return; // non-previsionado goes to saidasDiarias
        const reg = (dbRegsReserva || []).find(r => r.id_movimentacao === mov.id && r.mes_ano === currentMonthIso);
        if (reg) {
          const paidDay = reg.dia_movimentacao_real || mov.dia_movimentacao_previsto;
          if (paidDay === d) {
            saidasFixas.push({ descricao: `Depósito Reserva: ${mov.descricao}`, valor: Number(reg.valor_real), isExecutado: true });
          }
        } else if (mov.ativo && mov.dia_movimentacao_previsto === d) {
          saidasFixas.push({ descricao: `Depósito Reserva: ${mov.descricao}`, valor: Number(mov.valor_previsto_base), isExecutado: false });
        }
      });

      // --- SAÍDAS DIÁRIAS ---
      const recordsForDay = (dbRegistrosDiarios || []).filter(r => r.data === dayStr);
      if (recordsForDay.length > 0) {
        recordsForDay.forEach(r => {
          const valor = Number(r.valor_gasto);
          if (valor > 0) {
            const catName = r.id_categoria ? (catNameMap.get(r.id_categoria) || 'Categoria') : 'Gasto Pontual';
            const desc = r.descricao && r.descricao !== 'Zerado' ? `${r.descricao} (${catName})` : catName;
            saidasDiarias.push({ descricao: desc, valor, isExecutado: true });
          }
        });
      } else if (isFutureDay && totalLimiteMensalCategorias > 0) {
        saidasDiarias.push({ descricao: 'Limite diário projetado', valor: Number((totalLimiteMensalCategorias / daysInMonth).toFixed(2)), isExecutado: false });
      }
      // Past days without records: leave saidasDiarias empty (zero)

      // Reserve deposits — NOT previsionado (projetar=false) = saída diária
      activeMovsReserva.forEach(mov => {
        if (mov.tipo !== 'entrada') return;
        if (mov.projetar) return; // previsionado already handled above
        const entryDay = Number(mov.data_movimentacao.split('-')[2]);
        if (entryDay === d) {
          saidasDiarias.push({ descricao: `Depósito Reserva: ${mov.descricao}`, valor: Number(mov.valor_previsto_base), isExecutado: true });
        }
      });

      // --- TOTALS ---
      const totalEntradas = entradas.reduce((sum, i) => sum + i.valor, 0);
      const totalSaidasFixas = saidasFixas.reduce((sum, i) => sum + i.valor, 0);
      const totalSaidasDiarias = saidasDiarias.reduce((sum, i) => sum + i.valor, 0);

      currentBalance = currentBalance + totalEntradas - totalSaidasFixas - totalSaidasDiarias;

      // --- RESERVE BALANCE ---
      allReserveMovsCurrentMonth.forEach(mov => {
        if (!mov.projetar) {
          const entryDay = Number(mov.data_movimentacao.split('-')[2]);
          if (entryDay === d) {
            if (mov.tipo === 'entrada') currentReserveBalance += Number(mov.valor_previsto_base);
            else currentReserveBalance -= Number(mov.valor_previsto_base);
          }
        } else {
          const reg = (dbRegsReserva || []).find(r => r.id_movimentacao === mov.id && r.mes_ano === currentMonthIso);
          if (reg) {
            const paidDay = reg.dia_movimentacao_real || mov.dia_movimentacao_previsto;
            if (paidDay === d) {
              if (mov.tipo === 'entrada') currentReserveBalance += Number(reg.valor_real);
              else currentReserveBalance -= Number(reg.valor_real);
            }
          } else if (mov.ativo && mov.dia_movimentacao_previsto === d) {
            if (mov.tipo === 'entrada') currentReserveBalance += Number(mov.valor_previsto_base);
            else currentReserveBalance -= Number(mov.valor_previsto_base);
          }
        }
      });

      dailyPoints.push({
        dia: d,
        diaFormatado: String(d).padStart(2, '0'),
        entradas,
        saidasFixas,
        saidasDiarias,
        totalEntradas: Number(totalEntradas.toFixed(2)),
        totalSaidasFixas: Number(totalSaidasFixas.toFixed(2)),
        totalSaidasDiarias: Number(totalSaidasDiarias.toFixed(2)),
        saldoConta: Number(currentBalance.toFixed(2)),
        saldoReserva: Number(currentReserveBalance.toFixed(2)),
        isToday
      });
    }

    return dailyPoints;
  }
};
