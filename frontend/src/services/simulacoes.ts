import { supabase } from '../lib/supabase';
import { getLocalYearMonth } from './gastosFixos';

export type SimulationCategory = 'entrada' | 'fixo' | 'diario' | 'cartao';

export interface SimulatedItem {
  id: string; // unique identifier (original db id or generated for custom)
  origemId?: string; // original db id if derived from official
  tipo: SimulationCategory;
  descricao: string;
  valorOriginal: number;
  valorSimulado: number;
  diaPrevistoOriginal: number;
  diaSimulado: number;
  isOficialEfetuado: boolean; // true = locked, cannot be edited in simulation
  isCustom: boolean; // true = added by user in simulation
  ativo: boolean; // user can toggle item on/off in simulation
  detalhes?: string;
}

export interface SimulatedDayPoint {
  dia: number;
  diaFormatado: string;
  diaSemana: string;
  entradas: { descricao: string; valor: number; isExecutado: boolean; isSimulado?: boolean }[];
  saidasFixas: { descricao: string; valor: number; isExecutado: boolean; isSimulado?: boolean }[];
  saidasDiarias: { descricao: string; valor: number; isExecutado: boolean; isSimulado?: boolean }[];
  totalEntradas: number;
  totalSaidasFixas: number;
  totalSaidasDiarias: number;
  saldoConta: number;
  saldoReserva: number;
  isToday: boolean;
}

export interface SimulationBaseData {
  mesAno: string;
  daysInMonth: number;
  saldoInicialConta: number; // Saldo de abertura do dia 01 (herdado do fechamento do mês anterior)
  saldoInicialReserva: number;
  items: SimulatedItem[];
  limiteDiarioPadrao: number; // default daily projected limit
  gastosDiariosPorDia: { [dia: number]: { descricao: string; valor: number }[] };
  faturaCartaoInfo: {
    valor: number;
    pago: boolean;
    diaPagamento: number;
    mesRotulo: string;
  };
}

export interface SimulationSummary {
  saldoInicial: number;
  saldoFinalSimulado: number;
  saldoFinalOficial: number;
  diferenca: number;
  totalEntradasSimuladas: number;
  totalSaidasFixasSimuladas: number;
  totalSaidasDiariasSimuladas: number;
  totalEntradasOficiais: number;
  totalSaidasFixasOficiais: number;
  totalSaidasDiariasOficiais: number;
}

// Helpers
const parseMesAno = (mesAno: string) => {
  const [y, m] = mesAno.split('-').map(Number);
  return { year: y, month: m };
};

const addMonths = (mesAno: string, count: number): string => {
  const { year, month } = parseMesAno(mesAno);
  const date = new Date(year, month - 1 + count, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
};

const getMesAnoAnterior = (mesAno: string): string => {
  const [year, month] = mesAno.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
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

export const simulacoesService = {
  /**
   * Fetches official data directly from Supabase tables and builds the initial baseline.
   */
  async loadBaseData(currentMonthDate: Date): Promise<SimulationBaseData> {
    const targetYear = currentMonthDate.getFullYear();
    const targetMonth = currentMonthDate.getMonth();
    const currentMonthIso = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    // 1. Fetch all real records from database
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

    // 3. Compute retroactive balance up to M-1 (opening balance on Day 1 of Month M)
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

      const dailyM = (dbRegistrosDiarios || [])
        .filter(r => r.data.substring(0, 7) === m)
        .reduce((sum, r) => sum + Number(r.valor_gasto), 0);

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

    // 4. Build simulation items from current month
    const items: SimulatedItem[] = [];
    const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // a) Salários
    virtualSalarios.forEach(s => {
      let physicalMonth = '';
      let physicalDay = 5;
      let isExec = false;
      let valor = 0;

      if (s.data_real) {
        physicalMonth = s.data_real.substring(0, 7);
        physicalDay = Number(s.data_real.split('-')[2]);
        valor = Number(s.valor_real);
        isExec = true;
      } else {
        const desvio = s.desvio_mes_deposito ?? 0;
        physicalMonth = addMonths(s.mes_ano, desvio);
        physicalDay = s.dia_previsto || 5;
        valor = Number(s.valor_previsto);
        isExec = false;
      }

      if (physicalMonth === currentMonthIso && valor > 0) {
        const [refY, refM] = s.mes_ano.split('-').map(Number);
        const desc = `Salário ${mesesAbrev[refM - 1]}/${String(refY).slice(-2)}`;
        items.push({
          id: `salario_${s.mes_ano}`,
          origemId: s.id,
          tipo: 'entrada',
          descricao: desc,
          valorOriginal: valor,
          valorSimulado: valor,
          diaPrevistoOriginal: physicalDay,
          diaSimulado: physicalDay,
          isOficialEfetuado: isExec,
          isCustom: false,
          ativo: true,
          detalhes: isExec ? 'Salário recebido' : 'Salário previsto'
        });
      }
    });

    // b) Entradas pontuais
    const pontuaisNoMes = (dbEntradas || []).filter(e => !e.projetar && e.data_entrada.substring(0, 7) === currentMonthIso);
    pontuaisNoMes.forEach(e => {
      const entryDay = Number(e.data_entrada.split('-')[2]);
      const valor = Number(e.valor_previsto_base);
      items.push({
        id: `entrada_pontual_${e.id}`,
        origemId: e.id,
        tipo: 'entrada',
        descricao: e.descricao,
        valorOriginal: valor,
        valorSimulado: valor,
        diaPrevistoOriginal: entryDay,
        diaSimulado: entryDay,
        isOficialEfetuado: true, // Pontuais lançadas são oficiais
        isCustom: false,
        ativo: true,
        detalhes: 'Entrada pontual lançada'
      });
    });

    // c) Entradas recorrentes
    const recorrentesNoMes = (dbEntradas || []).filter(e => {
      if (!e.projetar) return false;
      const sm = e.data_entrada.substring(0, 7);
      return sm <= currentMonthIso && (!e.mes_ano_fim || e.mes_ano_fim >= currentMonthIso);
    });
    recorrentesNoMes.forEach(e => {
      const entryDay = Number(e.data_entrada.split('-')[2]);
      const reg = (dbRegEntradas || []).find(r => r.id_entrada === e.id && r.mes_ano === currentMonthIso);
      const isExec = reg !== undefined && reg !== null && Number(reg.valor_real) > 0;
      const valor = isExec ? Number(reg!.valor_real) : Number(e.valor_previsto_base);

      if (valor > 0 || e.ativo) {
        items.push({
          id: `entrada_recorrente_${e.id}`,
          origemId: e.id,
          tipo: 'entrada',
          descricao: e.descricao,
          valorOriginal: valor,
          valorSimulado: valor,
          diaPrevistoOriginal: entryDay,
          diaSimulado: entryDay,
          isOficialEfetuado: isExec,
          isCustom: false,
          ativo: e.ativo ?? true,
          detalhes: isExec ? 'Confirmada e recebida' : 'Recorrente prevista'
        });
      }
    });

    // d) Gastos Fixos
    const activeFixos = (dbGastosFixos || []).filter(f => {
      const isCreated = !f.created_at || getLocalYearMonth(f.created_at) <= currentMonthIso;
      return isCreated && (f.ativo || (dbRegGastosFixos || []).some(r => r.id_gasto_fixo === f.id && r.mes_ano === currentMonthIso));
    });

    activeFixos.forEach(f => {
      const reg = (dbRegGastosFixos || []).find(r => r.id_gasto_fixo === f.id && r.mes_ano === currentMonthIso);
      const hasReal = reg && reg.valor_real !== null && reg.valor_real !== undefined && Number(reg.valor_real) > 0;
      const valor = hasReal
        ? Number(reg!.valor_real)
        : (reg && reg.valor_previsto_ajustado !== null ? Number(reg.valor_previsto_ajustado) : Number(f.valor_previsto_base));
      const dia = (hasReal && reg!.dia_pagamento_real && reg!.dia_pagamento_real > 0)
        ? reg!.dia_pagamento_real
        : (f.dia_pagamento_previsto || 10);

      items.push({
        id: `fixo_${f.id}`,
        origemId: f.id,
        tipo: 'fixo',
        descricao: f.nome,
        valorOriginal: valor,
        valorSimulado: valor,
        diaPrevistoOriginal: dia,
        diaSimulado: dia,
        isOficialEfetuado: !!hasReal,
        isCustom: false,
        ativo: f.ativo ?? true,
        detalhes: hasReal ? 'Gasto fixo pago' : 'Gasto fixo previsto'
      });
    });

    // e) Fatura do Cartão (Mês anterior paga neste mês)
    const mesAnoAnterior = getMesAnoAnterior(currentMonthIso);
    const [prevY, prevMo] = mesAnoAnterior.split('-').map(Number);
    const prevMonthLabel = `${mesesAbrev[prevMo - 1]}/${String(prevY).slice(-2)}`;
    const faturaAnterior = (dbComprasParceladas || []).filter(compra => getParcelaAtual(compra.mes_ano_inicio, mesAnoAnterior, compra.num_parcelas) !== null).reduce((sum, p) => sum + Number(p.valor_parcela), 0);
    const pagoFaturaAnterior = (dbPagamentosFaturas || []).find(f => f.mes_ano === mesAnoAnterior);
    const ccPaid = pagoFaturaAnterior ? pagoFaturaAnterior.pago : false;
    const ccDiaPagamentoReal = pagoFaturaAnterior ? pagoFaturaAnterior.dia_pagamento_real : null;
    const ccValue = (pagoFaturaAnterior && Number(pagoFaturaAnterior.valor_pago) > 0) ? Number(pagoFaturaAnterior.valor_pago) : faturaAnterior;
    const ccDia = ccPaid ? (ccDiaPagamentoReal || 10) : 10;

    if (faturaAnterior > 0 || (ccPaid && ccValue > 0)) {
      items.push({
        id: `fatura_cartao_${mesAnoAnterior}`,
        origemId: pagoFaturaAnterior?.id,
        tipo: 'cartao',
        descricao: `Fatura Cartão (${prevMonthLabel})`,
        valorOriginal: ccValue,
        valorSimulado: ccValue,
        diaPrevistoOriginal: ccDia,
        diaSimulado: ccDia,
        isOficialEfetuado: ccPaid,
        isCustom: false,
        ativo: true,
        detalhes: ccPaid ? 'Fatura paga' : 'Fatura a vencer dia 10'
      });
    }

    // f) Movimentações da Reserva no mês atual
    const activeMovsReserva = (dbMovsReserva || []).filter(mov => {
      const sm = mov.data_movimentacao.substring(0, 7);
      if (!mov.projetar) return sm === currentMonthIso && mov.afeta_conta_geral;
      if (sm > currentMonthIso) return false;
      if (mov.mes_ano_fim && currentMonthIso > mov.mes_ano_fim) return false;
      return mov.afeta_conta_geral;
    });

    activeMovsReserva.forEach(mov => {
      if (mov.tipo === 'saida') {
        // Resgate da reserva para a conta (Entrada na conta)
        if (!mov.projetar) {
          const entryDay = Number(mov.data_movimentacao.split('-')[2]);
          items.push({
            id: `reserva_resgate_${mov.id}`,
            origemId: mov.id,
            tipo: 'entrada',
            descricao: `Resgate Reserva: ${mov.descricao}`,
            valorOriginal: Number(mov.valor_previsto_base),
            valorSimulado: Number(mov.valor_previsto_base),
            diaPrevistoOriginal: entryDay,
            diaSimulado: entryDay,
            isOficialEfetuado: true,
            isCustom: false,
            ativo: true,
            detalhes: 'Resgate de reserva efetuado'
          });
        } else {
          const reg = (dbRegsReserva || []).find(r => r.id_movimentacao === mov.id && r.mes_ano === currentMonthIso);
          const isExec = !!reg;
          const valor = isExec ? Number(reg!.valor_real) : Number(mov.valor_previsto_base);
          const dia = isExec ? (reg!.dia_movimentacao_real || mov.dia_movimentacao_previsto) : mov.dia_movimentacao_previsto;

          if (valor > 0 || mov.ativo) {
            items.push({
              id: `reserva_resgate_${mov.id}`,
              origemId: mov.id,
              tipo: 'entrada',
              descricao: `Resgate Reserva: ${mov.descricao}`,
              valorOriginal: valor,
              valorSimulado: valor,
              diaPrevistoOriginal: dia,
              diaSimulado: dia,
              isOficialEfetuado: isExec,
              isCustom: false,
              ativo: mov.ativo ?? true,
              detalhes: isExec ? 'Resgate efetuado' : 'Resgate previsto'
            });
          }
        }
      } else {
        // Depósito na reserva vindo da conta (Saída da conta)
        if (!mov.projetar) {
          const entryDay = Number(mov.data_movimentacao.split('-')[2]);
          items.push({
            id: `reserva_deposito_${mov.id}`,
            origemId: mov.id,
            tipo: 'diario',
            descricao: `Depósito Reserva: ${mov.descricao}`,
            valorOriginal: Number(mov.valor_previsto_base),
            valorSimulado: Number(mov.valor_previsto_base),
            diaPrevistoOriginal: entryDay,
            diaSimulado: entryDay,
            isOficialEfetuado: true,
            isCustom: false,
            ativo: true,
            detalhes: 'Depósito em reserva efetuado'
          });
        } else {
          const reg = (dbRegsReserva || []).find(r => r.id_movimentacao === mov.id && r.mes_ano === currentMonthIso);
          const isExec = !!reg;
          const valor = isExec ? Number(reg!.valor_real) : Number(mov.valor_previsto_base);
          const dia = isExec ? (reg!.dia_movimentacao_real || mov.dia_movimentacao_previsto) : mov.dia_movimentacao_previsto;

          if (valor > 0 || mov.ativo) {
            items.push({
              id: `reserva_deposito_${mov.id}`,
              origemId: mov.id,
              tipo: 'fixo',
              descricao: `Depósito Reserva: ${mov.descricao}`,
              valorOriginal: valor,
              valorSimulado: valor,
              diaPrevistoOriginal: dia,
              diaSimulado: dia,
              isOficialEfetuado: isExec,
              isCustom: false,
              ativo: mov.ativo ?? true,
              detalhes: isExec ? 'Depósito efetuado' : 'Depósito previsto'
            });
          }
        }
      }
    });

    // g) Gastos Diários Reais
    const catNameMap = new Map<string, string>();
    (dbCategoriasDiarias || []).forEach(c => catNameMap.set(c.id, c.nome));

    const gastosDiariosPorDia: { [dia: number]: { descricao: string; valor: number }[] } = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${currentMonthIso}-${String(d).padStart(2, '0')}`;
      const records = (dbRegistrosDiarios || []).filter(r => r.data === dayStr);
      if (records.length > 0) {
        gastosDiariosPorDia[d] = records
          .filter(r => Number(r.valor_gasto) > 0)
          .map(r => {
            const catName = r.id_categoria ? (catNameMap.get(r.id_categoria) || 'Categoria') : 'Gasto Pontual';
            const desc = r.descricao && r.descricao !== 'Zerado' ? `${r.descricao} (${catName})` : catName;
            return { descricao: desc, valor: Number(r.valor_gasto) };
          });
      }
    }

    const totalLimiteMensalCategorias = (dbCategoriasDiarias || []).reduce((sum, c) => sum + Number(c.limite_mensal), 0);
    const limiteDiarioPadrao = daysInMonth > 0 ? Number((totalLimiteMensalCategorias / daysInMonth).toFixed(2)) : 0;

    return {
      mesAno: currentMonthIso,
      daysInMonth,
      saldoInicialConta: Number(saldoAcumulado.toFixed(2)),
      saldoInicialReserva: Number(reserveBalance.toFixed(2)),
      items,
      limiteDiarioPadrao,
      gastosDiariosPorDia,
      faturaCartaoInfo: {
        valor: ccValue,
        pago: ccPaid,
        diaPagamento: ccDia,
        mesRotulo: prevMonthLabel
      }
    };
  },

  /**
   * Recalculates the day-by-day financial progression and summary metrics based on simulation inputs.
   */
  calculateSimulationTimeline(
    baseData: SimulationBaseData,
    simulatedItems: SimulatedItem[],
    limiteDiarioSimulado: number,
    customDailyExpenses: { [dia: number]: number } = {}
  ): { points: SimulatedDayPoint[]; summary: SimulationSummary } {
    const { daysInMonth, mesAno, saldoInicialConta, saldoInicialReserva, gastosDiariosPorDia } = baseData;

    const realToday = new Date();
    const realTodayDay = realToday.getDate();
    const realTodayMonthIso = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}`;

    const [yearNum, monthNum] = mesAno.split('-').map(Number);
    const weekdaysAbrev = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    let runningBalance = saldoInicialConta;
    let runningReserve = saldoInicialReserva;

    const points: SimulatedDayPoint[] = [];

    // Official Baseline Totals (for comparison)
    let totalEntradasOficiais = 0;
    let totalSaidasFixasOficiais = 0;
    let totalSaidasDiariasOficiais = 0;

    // Simulation Totals
    let totalEntradasSimuladas = 0;
    let totalSaidasFixasSimuladas = 0;
    let totalSaidasDiariasSimuladas = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const isFutureDay = mesAno > realTodayMonthIso || (mesAno === realTodayMonthIso && d > realTodayDay);
      const isToday = mesAno === realTodayMonthIso && d === realTodayDay;
      const dayDate = new Date(yearNum, monthNum - 1, d);
      const diaSemana = weekdaysAbrev[dayDate.getDay()];

      const entradas: { descricao: string; valor: number; isExecutado: boolean; isSimulado?: boolean }[] = [];
      const saidasFixas: { descricao: string; valor: number; isExecutado: boolean; isSimulado?: boolean }[] = [];
      const saidasDiarias: { descricao: string; valor: number; isExecutado: boolean; isSimulado?: boolean }[] = [];

      // 1. Process Simulated Items (Entradas, Fixos, Cartão, Reservas)
      simulatedItems.forEach(item => {
        if (!item.ativo) return;

        const diaAplicado = item.diaSimulado;
        if (diaAplicado !== d) return;

        const valor = item.valorSimulado;
        const isExec = item.isOficialEfetuado;
        const isSim = !isExec || item.isCustom;

        if (item.tipo === 'entrada') {
          entradas.push({
            descricao: item.descricao,
            valor,
            isExecutado: isExec,
            isSimulado: isSim
          });
        } else if (item.tipo === 'fixo' || item.tipo === 'cartao') {
          saidasFixas.push({
            descricao: item.descricao,
            valor,
            isExecutado: isExec,
            isSimulado: isSim
          });
        } else if (item.tipo === 'diario') {
          saidasDiarias.push({
            descricao: item.descricao,
            valor,
            isExecutado: isExec,
            isSimulado: true
          });
        }
      });

      // 2. Process Daily Expenses for Day d
      const realRecordsForDay = gastosDiariosPorDia[d];
      if (realRecordsForDay && realRecordsForDay.length > 0) {
        // Official executed daily expenses for this day
        realRecordsForDay.forEach(r => {
          saidasDiarias.push({
            descricao: r.descricao,
            valor: r.valor,
            isExecutado: true,
            isSimulado: false
          });
        });
      } else {
        // If there's a custom daily override for this day, apply it
        if (customDailyExpenses[d] !== undefined) {
          const customVal = customDailyExpenses[d];
          if (customVal > 0) {
            saidasDiarias.push({
              descricao: `Gasto diário simulado`,
              valor: customVal,
              isExecutado: false,
              isSimulado: true
            });
          }
        } else if (isFutureDay && limiteDiarioSimulado > 0) {
          // Future projected day uses the simulated daily limit
          saidasDiarias.push({
            descricao: `Limite diário projetado`,
            valor: limiteDiarioSimulado,
            isExecutado: false,
            isSimulado: true
          });
        }
      }

      // 3. Day sums
      const dayTotalEntradas = entradas.reduce((sum, item) => sum + item.valor, 0);
      const dayTotalFixas = saidasFixas.reduce((sum, item) => sum + item.valor, 0);
      const dayTotalDiarias = saidasDiarias.reduce((sum, item) => sum + item.valor, 0);

      runningBalance = runningBalance + dayTotalEntradas - dayTotalFixas - dayTotalDiarias;

      totalEntradasSimuladas += dayTotalEntradas;
      totalSaidasFixasSimuladas += dayTotalFixas;
      totalSaidasDiariasSimuladas += dayTotalDiarias;

      points.push({
        dia: d,
        diaFormatado: String(d).padStart(2, '0'),
        diaSemana,
        entradas,
        saidasFixas,
        saidasDiarias,
        totalEntradas: Number(dayTotalEntradas.toFixed(2)),
        totalSaidasFixas: Number(dayTotalFixas.toFixed(2)),
        totalSaidasDiarias: Number(dayTotalDiarias.toFixed(2)),
        saldoConta: Number(runningBalance.toFixed(2)),
        saldoReserva: Number(runningReserve.toFixed(2)),
        isToday
      });
    }

    // Compute Official summary for baseline comparison
    baseData.items.forEach(item => {
      if (item.isCustom) return;
      if (item.tipo === 'entrada') totalEntradasOficiais += item.valorOriginal;
      else if (item.tipo === 'fixo' || item.tipo === 'cartao') totalSaidasFixasOficiais += item.valorOriginal;
    });
    // Add real daily records + baseline projected daily
    for (let d = 1; d <= daysInMonth; d++) {
      const isFutureDay = mesAno > realTodayMonthIso || (mesAno === realTodayMonthIso && d > realTodayDay);
      const recs = gastosDiariosPorDia[d];
      if (recs && recs.length > 0) {
        totalSaidasDiariasOficiais += recs.reduce((sum, r) => sum + r.valor, 0);
      } else if (isFutureDay) {
        totalSaidasDiariasOficiais += baseData.limiteDiarioPadrao;
      }
    }

    const saldoFinalOficial = Number((saldoInicialConta + totalEntradasOficiais - totalSaidasFixasOficiais - totalSaidasDiariasOficiais).toFixed(2));
    const saldoFinalSimulado = points.length > 0 ? points[points.length - 1].saldoConta : saldoInicialConta;
    const diferenca = Number((saldoFinalSimulado - saldoFinalOficial).toFixed(2));

    const summary: SimulationSummary = {
      saldoInicial: saldoInicialConta,
      saldoFinalSimulado,
      saldoFinalOficial,
      diferenca,
      totalEntradasSimuladas: Number(totalEntradasSimuladas.toFixed(2)),
      totalSaidasFixasSimuladas: Number(totalSaidasFixasSimuladas.toFixed(2)),
      totalSaidasDiariasSimuladas: Number(totalSaidasDiariasSimuladas.toFixed(2)),
      totalEntradasOficiais: Number(totalEntradasOficiais.toFixed(2)),
      totalSaidasFixasOficiais: Number(totalSaidasFixasOficiais.toFixed(2)),
      totalSaidasDiariasOficiais: Number(totalSaidasDiariasOficiais.toFixed(2))
    };

    return { points, summary };
  }
};
