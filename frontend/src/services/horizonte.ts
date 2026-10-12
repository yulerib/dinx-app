import { supabase } from '../lib/supabase';
import { getLocalYearMonth, isGastoFixoPago } from './gastosFixos';

/* ==========================================================================
   HORIZONTE — Planilha dia a dia da conta corrente
   - Base: movimentações previstas + efetuadas (fonte: Supabase, somente leitura)
   - Simulações: sobrescritas por célula, persistidas APENAS no navegador
     (localStorage). Nunca alteram dados das outras sessões.
   ========================================================================== */

export type HzColumn = 'entrada' | 'fixo' | 'diario' | 'cartao';
export const HZ_COLUMNS: HzColumn[] = ['entrada', 'fixo', 'diario', 'cartao'];

export type HzItemStatus = 'previsto' | 'executado';

export interface HzItem {
  id: string; // identificador único do item
  descricao: string;
  valor: number; // valor efetivo (simulado se houver override)
  valorOriginal: number; // valor base original
  simulado?: boolean; // se este item individual está simulado
  status: HzItemStatus;
  reserva?: boolean; // movimentação envolvendo a Reserva
  detalhe?: string;
}

export type HzCellState = 'vazio' | 'previsto' | 'executado' | 'misto' | 'simulado';

export interface HzCell {
  items: HzItem[];
  baseValor: number; // soma dos itens (previsto + efetuado original)
  valor: number; // valor efetivo (simulado, se houver)
  simulado: boolean;
  temItensSimulados: boolean; // se algum item individual da célula foi alterado
  novaSimulacao: boolean; // simulação em célula originalmente vazia
  state: HzCellState;
  temReserva: boolean;
}

export interface HzRow {
  dia: number;
  diaSemana: string;
  isToday: boolean;
  isWeekend: boolean;
  cells: Record<HzColumn, HzCell>;
  saldo: number; // saldo com simulações
  saldoBase: number; // saldo sem nenhuma simulação
}

export interface HzMonthView {
  mesAno: string;
  saldoInicial: number;
  saldoInicialBase: number;
  rows: HzRow[];
  totais: Record<HzColumn, number>;
  saldoFinal: number;
  saldoFinalBase: number;
  numSimulacoes: number;
}

/** 
 * Estrutura de simulações por mês:
 * mesAno -> chave da célula (`dia|coluna`) -> número (para célula inteira/vazia) OU Record<itemId, número> (para itens específicos)
 */
export type HzCellOverride = number | Record<string, number>;
export type HzOverrides = Record<string, Record<string, HzCellOverride>>;

export const cellKey = (dia: number, col: HzColumn) => `${dia}|${col}`;

// --------------------------------------------------------------------------
// Persistência local das simulações
// --------------------------------------------------------------------------
const STORAGE_KEY = 'dinx_horizonte_simulacoes_v1';

export function loadOverrides(): HzOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Horizonte: erro ao ler simulações locais', e);
  }
  return {};
}

export function saveOverrides(ov: HzOverrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ov));
  } catch (e) {
    console.error('Horizonte: erro ao salvar simulações locais', e);
  }
}

// --------------------------------------------------------------------------
// Helpers de data
// --------------------------------------------------------------------------
const addMonths = (mesAno: string, count: number): string => {
  const [y, m] = mesAno.split('-').map(Number);
  const d = new Date(y, m - 1 + count, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const daysIn = (mesAno: string) => {
  const [y, m] = mesAno.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

const todayInfo = () => {
  const t = new Date();
  const mesAno = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
  const iso = `${mesAno}-${String(t.getDate()).padStart(2, '0')}`;
  return { mesAno, dia: t.getDate(), iso };
};

const dayOf = (isoDate: string) => Number(isoDate.split('-')[2]);
const round2 = (n: number) => Math.round(n * 100) / 100;
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const labelMes = (mesAno: string) => {
  const [y, m] = mesAno.split('-').map(Number);
  return `${MESES[m - 1]}/${String(y).slice(-2)}`;
};

function parcelaAtiva(c: any, mesAno: string): boolean {
  const [sy, sm] = c.mes_ano_inicio.split('-').map(Number);
  const [cy, cm] = mesAno.split('-').map(Number);
  const diff = (cy - sy) * 12 + (cm - sm);
  if (diff < 0) return false;
  if (c.recorrente) return !c.mes_ano_fim || mesAno <= c.mes_ano_fim;
  return diff < c.num_parcelas;
}

const faturaDoMes = (raw: HzRaw, mesAno: string) =>
  raw.compras.filter(c => parcelaAtiva(c, mesAno)).reduce((s, c) => s + Number(c.valor_parcela), 0);

const salarioParaMes = (salarios: any[], mesAno: string) => {
  const exact = salarios.find(s => s.mes_ano === mesAno);
  if (exact) return exact;
  const inherited = [...salarios]
    .filter(s => s.mes_ano <= mesAno)
    .sort((a, b) => b.mes_ano.localeCompare(a.mes_ano))[0];
  if (inherited) return { ...inherited, mes_ano: mesAno, valor_real: null, data_real: null, id: '' };
  return null;
};

// --------------------------------------------------------------------------
// Dados brutos
// --------------------------------------------------------------------------
export interface HzRaw {
  entradas: any[];
  regEntradas: any[];
  fixos: any[];
  regFixos: any[];
  categorias: any[];
  diarios: any[];
  compras: any[];
  faturas: any[];
  movsReserva: any[];
  regsReserva: any[];
  salarios: any[];
}

export async function fetchHorizonteRaw(): Promise<HzRaw> {
  const r = await Promise.all([
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
  const [entradas, regEntradas, fixos, regFixos, categorias, diarios, compras, faturas, movsReserva, regsReserva, salarios] =
    r.map(x => x.data || []);
  return { entradas, regEntradas, fixos, regFixos, categorias, diarios, compras, faturas, movsReserva, regsReserva, salarios };
}

// --------------------------------------------------------------------------
// Saldo oficial de abertura (mesma regra do app para meses passados)
// --------------------------------------------------------------------------
function primeiroMesComDados(raw: HzRaw, fallback: string): string {
  const all: string[] = [];
  raw.entradas.forEach(e => all.push(e.data_entrada.substring(0, 7)));
  raw.regEntradas.forEach(r => all.push(r.mes_ano));
  raw.regFixos.forEach(r => all.push(r.mes_ano));
  raw.diarios.forEach(r => all.push(r.data.substring(0, 7)));
  raw.compras.forEach(p => all.push(p.mes_ano_inicio));
  raw.faturas.forEach(f => all.push(f.mes_ano));
  if (all.length === 0) return fallback;
  all.sort();
  return all[0] < fallback ? all[0] : fallback;
}

function saldoOficialAbertura(raw: HzRaw, target: string): number {
  const inicio = primeiroMesComDados(raw, addMonths(target, -12));
  let saldo = 0;

  for (let m = inicio; m < target; m = addMonths(m, 1)) {
    let inflows = 0;
    raw.entradas
      .filter(e => !e.projetar && e.data_entrada.substring(0, 7) === m)
      .forEach(e => (inflows += Number(e.valor_previsto_base)));
    raw.entradas
      .filter(e => e.projetar && e.data_entrada.substring(0, 7) <= m && (!e.mes_ano_fim || e.mes_ano_fim >= m))
      .forEach(e => {
        const reg = raw.regEntradas.find(r => r.id_entrada === e.id && r.mes_ano === m);
        if (reg && Number(reg.valor_real) > 0) inflows += Number(reg.valor_real);
        else if (e.ativo) inflows += Number(e.valor_previsto_base);
      });

    // salários depositados fisicamente em m (competências m-3..m+3 cobrem desvios usuais)
    for (let k = -3; k <= 3; k++) {
      const s = salarioParaMes(raw.salarios, addMonths(m, k));
      if (!s) continue;
      const fis = s.data_real ? s.data_real.substring(0, 7) : addMonths(s.mes_ano, s.desvio_mes_deposito ?? 0);
      if (fis !== m) continue;
      if (s.valor_real !== null && s.valor_real !== undefined) inflows += Number(s.valor_real);
      else if (s.valor_previsto > 0) inflows += Number(s.valor_previsto);
    }

    let fixed = 0;
    raw.fixos
      .filter(f => {
        const created = !f.created_at || getLocalYearMonth(f.created_at) <= m;
        return created && (f.ativo || raw.regFixos.some(r => r.id_gasto_fixo === f.id && r.mes_ano === m));
      })
      .forEach(f => {
        const reg = raw.regFixos.find(r => r.id_gasto_fixo === f.id && r.mes_ano === m);
        if (isGastoFixoPago(reg)) fixed += Number(reg!.valor_real ?? 0);
        else if (f.ativo)
          fixed += reg && reg.valor_previsto_ajustado !== null ? Number(reg.valor_previsto_ajustado) : Number(f.valor_previsto_base);
      });

    const daily = raw.diarios.filter(r => r.data.substring(0, 7) === m).reduce((s, r) => s + Number(r.valor_gasto), 0);

    let cc = 0;
    raw.faturas
      .filter(f => f.pago)
      .forEach(f => {
        const fis = f.data_pagamento_real ? f.data_pagamento_real.substring(0, 7) : addMonths(f.mes_ano, 1);
        if (fis === m) cc += Number(f.valor_pago) > 0 ? Number(f.valor_pago) : faturaDoMes(raw, f.mes_ano);
      });

    let resIn = 0;
    let resOut = 0;
    raw.movsReserva
      .filter(mv => !mv.projetar && mv.data_movimentacao.substring(0, 7) === m && mv.afeta_conta_geral)
      .forEach(mv => (mv.tipo === 'saida' ? (resIn += Number(mv.valor_previsto_base)) : (resOut += Number(mv.valor_previsto_base))));
    raw.regsReserva
      .filter(r => r.mes_ano === m && r.afeta_conta_geral)
      .forEach(r => {
        const p = raw.movsReserva.find(mv => mv.id === r.id_movimentacao);
        if (p) p.tipo === 'saida' ? (resIn += Number(r.valor_real)) : (resOut += Number(r.valor_real));
      });

    saldo += inflows + resIn - fixed - daily - cc - resOut;
  }
  return round2(saldo);
}

// --------------------------------------------------------------------------
// Base do mês: itens por célula (dia × coluna)
// --------------------------------------------------------------------------
type BaseCells = Record<string, HzItem[]>;

function buildMonthBase(raw: HzRaw, mesAno: string): BaseCells {
  const cells: BaseCells = {};
  const nDays = daysIn(mesAno);
  const hoje = todayInfo();
  const clampDay = (d: number) => Math.max(1, Math.min(nDays, d || 1));
  const push = (dia: number, col: HzColumn, item: Omit<HzItem, 'valorOriginal'>) => {
    if (!item.valor) return;
    const k = cellKey(clampDay(dia), col);
    const v = round2(item.valor);
    (cells[k] ||= []).push({
      ...item,
      valor: v,
      valorOriginal: v
    });
  };
  const statusPorData = (iso: string): HzItemStatus => (iso <= hoje.iso ? 'executado' : 'previsto');

  // a) Salários (competências próximas cujo depósito cai neste mês)
  for (let k = -3; k <= 3; k++) {
    const s = salarioParaMes(raw.salarios, addMonths(mesAno, k));
    if (!s) continue;
    const fis = s.data_real ? s.data_real.substring(0, 7) : addMonths(s.mes_ano, s.desvio_mes_deposito ?? 0);
    if (fis !== mesAno) continue;
    const exec = !!s.data_real;
    const valor = exec ? Number(s.valor_real) : Number(s.valor_previsto);
    push(exec ? dayOf(s.data_real) : s.dia_previsto || 5, 'entrada', {
      id: `salario_${s.mes_ano}`,
      descricao: `Salário ${labelMes(s.mes_ano)}`,
      valor,
      status: exec ? 'executado' : 'previsto'
    });
  }

  // b) Entradas pontuais
  raw.entradas
    .filter(e => !e.projetar && e.data_entrada.substring(0, 7) === mesAno)
    .forEach(e =>
      push(dayOf(e.data_entrada), 'entrada', {
        id: `entrada_pontual_${e.id}`,
        descricao: e.descricao,
        valor: Number(e.valor_previsto_base),
        status: statusPorData(e.data_entrada)
      })
    );

  // c) Entradas recorrentes
  raw.entradas
    .filter(e => e.projetar && e.data_entrada.substring(0, 7) <= mesAno && (!e.mes_ano_fim || e.mes_ano_fim >= mesAno))
    .forEach(e => {
      const reg = raw.regEntradas.find(r => r.id_entrada === e.id && r.mes_ano === mesAno);
      const exec = !!reg && Number(reg.valor_real) > 0;
      if (!exec && !e.ativo) return;
      push(dayOf(e.data_entrada), 'entrada', {
        id: `entrada_recorrente_${e.id}`,
        descricao: e.descricao,
        valor: exec ? Number(reg.valor_real) : Number(e.valor_previsto_base),
        status: exec ? 'executado' : 'previsto'
      });
    });

  // d) Gastos fixos
  raw.fixos
    .filter(f => !f.created_at || getLocalYearMonth(f.created_at) <= mesAno)
    .forEach(f => {
      const reg = raw.regFixos.find(r => r.id_gasto_fixo === f.id && r.mes_ano === mesAno);
      const pago = isGastoFixoPago(reg);
      if (!pago && !f.ativo) return;
      let dia = f.dia_pagamento_previsto || 10;
      if (pago) {
        if (reg.data_pagamento_real && reg.data_pagamento_real.substring(0, 7) === mesAno) dia = dayOf(reg.data_pagamento_real);
        else if (reg.dia_pagamento_real) dia = Number(reg.dia_pagamento_real);
      }
      const valor = pago
        ? Number(reg.valor_real ?? 0)
        : reg && reg.valor_previsto_ajustado !== null && reg.valor_previsto_ajustado !== undefined
          ? Number(reg.valor_previsto_ajustado)
          : Number(f.valor_previsto_base);
      push(dia, 'fixo', {
        id: `fixo_${f.id}`,
        descricao: f.nome,
        valor,
        status: pago ? 'executado' : 'previsto'
      });
    });

  // e) Cartão de crédito — faturas pagas neste mês
  raw.faturas
    .filter(f => f.pago)
    .forEach(f => {
      const fis = f.data_pagamento_real ? f.data_pagamento_real.substring(0, 7) : addMonths(f.mes_ano, 1);
      if (fis !== mesAno) return;
      const valor = Number(f.valor_pago) > 0 ? Number(f.valor_pago) : faturaDoMes(raw, f.mes_ano);
      const dia = f.data_pagamento_real ? dayOf(f.data_pagamento_real) : f.dia_pagamento_real || 10;
      push(dia, 'cartao', {
        id: `fatura_${f.mes_ano}`,
        descricao: `Fatura ${labelMes(f.mes_ano)}`,
        valor,
        status: 'executado'
      });
    });
  //    fatura do mês anterior ainda não paga → prevista para o dia 10
  const mesAnt = addMonths(mesAno, -1);
  const antPaga = raw.faturas.some(f => {
    if (f.mes_ano !== mesAnt || !f.pago) return false;
    const fis = f.data_pagamento_real ? f.data_pagamento_real.substring(0, 7) : addMonths(f.mes_ano, 1);
    return fis <= mesAno;
  });
  if (!antPaga) {
    push(10, 'cartao', {
      id: `fatura_${mesAnt}`,
      descricao: `Fatura ${labelMes(mesAnt)}`,
      valor: faturaDoMes(raw, mesAnt),
      status: 'previsto'
    });
  }

  // f) Reserva ↔ conta corrente
  raw.movsReserva.forEach(mv => {
    const ini = mv.data_movimentacao.substring(0, 7);
    const resgate = mv.tipo === 'saida'; // reserva → conta (entrada na conta)
    const col: HzColumn = resgate ? 'entrada' : 'fixo';
    const desc = resgate ? `Da reserva: ${mv.descricao}` : `Para a reserva: ${mv.descricao}`;

    if (!mv.projetar) {
      if (ini !== mesAno || !mv.afeta_conta_geral) return;
      push(dayOf(mv.data_movimentacao), col, {
        id: `reserva_${mv.id}`,
        descricao: desc,
        valor: Number(mv.valor_previsto_base),
        status: statusPorData(mv.data_movimentacao),
        reserva: true
      });
      return;
    }
    if (ini > mesAno || (mv.mes_ano_fim && mesAno > mv.mes_ano_fim)) return;
    const reg = raw.regsReserva.find(r => r.id_movimentacao === mv.id && r.mes_ano === mesAno);
    if (reg) {
      if (!reg.afeta_conta_geral) return;
      push(reg.dia_movimentacao_real || mv.dia_movimentacao_previsto || 15, col, {
        id: `reserva_${mv.id}`,
        descricao: desc,
        valor: Number(reg.valor_real),
        status: 'executado',
        reserva: true
      });
    } else if (mv.ativo && mv.afeta_conta_geral) {
      push(mv.dia_movimentacao_previsto || 15, col, {
        id: `reserva_${mv.id}`,
        descricao: desc,
        valor: Number(mv.valor_previsto_base),
        status: 'previsto',
        reserva: true
      });
    }
  });

  // g) Gastos diários — reais por dia; dias futuros sem registro recebem o limite diário projetado
  const catNome = new Map<string, string>();
  raw.categorias.forEach(c => catNome.set(c.id, c.nome));
  const limiteMensal = raw.categorias.reduce((s, c) => s + Number(c.limite_mensal), 0);
  const limiteDiario = nDays > 0 ? limiteMensal / nDays : 0;

  for (let d = 1; d <= nDays; d++) {
    const iso = `${mesAno}-${String(d).padStart(2, '0')}`;
    const recs = raw.diarios.filter(r => r.data === iso && Number(r.valor_gasto) > 0);
    if (recs.length > 0) {
      recs.forEach((r, idx) => {
        const cat = r.id_categoria ? catNome.get(r.id_categoria) || 'Categoria' : 'Gasto pontual';
        push(d, 'diario', {
          id: `diario_${r.id_registro || `${iso}_${idx}`}`,
          descricao: r.descricao && r.descricao !== 'Zerado' ? `${r.descricao} (${cat})` : cat,
          valor: Number(r.valor_gasto),
          status: 'executado'
        });
      });
    } else if (iso > hoje.iso && limiteDiario > 0) {
      push(d, 'diario', {
        id: `diario_proj_${iso}`,
        descricao: 'Limite diário projetado',
        valor: limiteDiario,
        status: 'previsto'
      });
    }
  }

  return cells;
}

// --------------------------------------------------------------------------
// Montagem da visão do mês
// --------------------------------------------------------------------------
function buildView(mesAno: string, base: BaseCells, ov: Record<string, HzCellOverride> | undefined, saldoInicial: number, saldoInicialBase: number): HzMonthView {
  const nDays = daysIn(mesAno);
  const [y, m] = mesAno.split('-').map(Number);
  const hoje = todayInfo();
  const totais: Record<HzColumn, number> = { entrada: 0, fixo: 0, diario: 0, cartao: 0 };
  const rows: HzRow[] = [];
  let saldo = saldoInicial;
  let saldoBase = saldoInicialBase;
  let numSimulacoes = 0;

  for (let d = 1; d <= nDays; d++) {
    const wd = new Date(y, m - 1, d).getDay();
    const cells = {} as Record<HzColumn, HzCell>;
    let deltaDia = 0;
    let deltaBase = 0;

    HZ_COLUMNS.forEach(col => {
      const k = cellKey(d, col);
      const rawItems = base[k] || [];
      const baseValor = round2(rawItems.reduce((s, i) => s + i.valorOriginal, 0));
      const cellOverride = ov?.[k];

      let effectiveItems: HzItem[] = [];
      let valor = baseValor;
      let simulado = false;
      let temItensSimulados = false;
      let novaSimulacao = false;

      if (cellOverride !== undefined) {
        if (typeof cellOverride === 'number') {
          // Override na célula inteira / montante total
          if (round2(cellOverride) !== baseValor) {
            simulado = true;
            valor = round2(cellOverride);
            numSimulacoes++;
            novaSimulacao = rawItems.length === 0;
            effectiveItems = rawItems.map(it => ({ ...it }));
          } else {
            effectiveItems = rawItems.map(it => ({ ...it }));
          }
        } else if (typeof cellOverride === 'object' && cellOverride !== null) {
          // Override por item individual
          const itemMap = cellOverride as Record<string, number>;
          let anyItemDiff = false;

          effectiveItems = rawItems.map(it => {
            const ovVal = itemMap[it.id];
            if (ovVal !== undefined && round2(ovVal) !== round2(it.valorOriginal)) {
              anyItemDiff = true;
              return {
                ...it,
                valor: round2(ovVal),
                simulado: true
              };
            }
            return {
              ...it,
              valor: it.valorOriginal,
              simulado: false
            };
          });

          if (anyItemDiff) {
            simulado = true;
            temItensSimulados = true;
            valor = round2(effectiveItems.reduce((s, it) => s + it.valor, 0));
            numSimulacoes++;
          }
        }
      } else {
        effectiveItems = rawItems.map(it => ({ ...it }));
      }

      let state: HzCellState = 'vazio';
      if (simulado) state = 'simulado';
      else if (effectiveItems.length > 0) {
        const exec = effectiveItems.filter(i => i.status === 'executado').length;
        state = exec === effectiveItems.length ? 'executado' : exec === 0 ? 'previsto' : 'misto';
      }

      cells[col] = {
        items: effectiveItems,
        baseValor,
        valor,
        simulado,
        temItensSimulados,
        novaSimulacao,
        state,
        temReserva: effectiveItems.some(i => i.reserva)
      };

      const sinal = col === 'entrada' ? 1 : -1;
      deltaDia += sinal * valor;
      deltaBase += sinal * baseValor;
      totais[col] += valor;
    });

    saldo = round2(saldo + deltaDia);
    saldoBase = round2(saldoBase + deltaBase);
    rows.push({
      dia: d,
      diaSemana: SEMANA[wd],
      isToday: mesAno === hoje.mesAno && d === hoje.dia,
      isWeekend: wd === 0 || wd === 6,
      cells,
      saldo,
      saldoBase
    });
  }

  HZ_COLUMNS.forEach(c => (totais[c] = round2(totais[c])));
  return {
    mesAno,
    saldoInicial: round2(saldoInicial),
    saldoInicialBase: round2(saldoInicialBase),
    rows,
    totais,
    saldoFinal: saldo,
    saldoFinalBase: saldoBase,
    numSimulacoes
  };
}

/**
 * Calcula a planilha de um mês, encadeando o saldo desde o mês corrente real
 * (ou desde o mês simulado mais antigo / mês alvo, o que vier primeiro).
 * As simulações de meses anteriores são levadas ao saldo de abertura do mês alvo.
 */
export function computeHorizonte(raw: HzRaw, target: string, overrides: HzOverrides): HzMonthView {
  const hoje = todayInfo();
  const mesesSimulados = Object.keys(overrides).filter(k => Object.keys(overrides[k] || {}).length > 0).sort();
  let inicio = target < hoje.mesAno ? target : hoje.mesAno;
  if (mesesSimulados.length > 0 && mesesSimulados[0] < inicio) inicio = mesesSimulados[0];

  const abertura = saldoOficialAbertura(raw, inicio);
  let saldo = abertura;
  let saldoBase = abertura;

  for (let m = inicio; m < target; m = addMonths(m, 1)) {
    const v = buildView(m, buildMonthBase(raw, m), overrides[m], saldo, saldoBase);
    saldo = v.saldoFinal;
    saldoBase = v.saldoFinalBase;
  }
  return buildView(target, buildMonthBase(raw, target), overrides[target], saldo, saldoBase);
}
