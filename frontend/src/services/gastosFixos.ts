import { supabase } from '../lib/supabase';
import type { GastoFixo, GastoFixoMensal, RegistroGastoFixo } from '../types/database.types';

export function getLocalYearMonth(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  if (dateStr.length <= 7) return dateStr;
  try {
    if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr.substring(0, 7);
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr.substring(0, 7);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  } catch {
    return dateStr.substring(0, 7);
  }
}

export function isGastoFixoPago(registro: RegistroGastoFixo | null | undefined): boolean {
  if (!registro) return false;
  return (
    registro.data_pagamento_real !== null ||
    registro.dia_pagamento_real !== null ||
    (registro.valor_real !== null && Number(registro.valor_real) > 0)
  );
}

export function getMesAnoAnteriorHelper(mesAnoStr: string): string {
  const [year, month] = mesAnoStr.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
}

export const gastosFixosService = {
  // Busca todas as despesas ativas e seus registros para o mês atual
  async fetchGastosMensais(mesAno: string): Promise<GastoFixoMensal[]> {
    // 1. Busca todos os gastos ativos
    const { data: gastos, error: errGastos } = await supabase
      .from('gastos_fixos')
      .select('*')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (errGastos) throw errGastos;

    if (!gastos || gastos.length === 0) return [];

    // Filter to only include expenses active in the requested month (mesAno)
    const activeGastos = gastos.filter(g => {
      const startsOnOrBefore = !g.created_at || getLocalYearMonth(g.created_at) <= mesAno;
      const endsOnOrAfter = !g.mes_ano_fim || g.mes_ano_fim >= mesAno;
      return startsOnOrBefore && endsOnOrAfter;
    });

    if (activeGastos.length === 0) return [];

    const gastosIds = activeGastos.map(g => g.id);

    // 2. Busca registros desses gastos para o mês específico
    const { data: registros, error: errRegistros } = await supabase
      .from('registros_gastos_fixos')
      .select('*')
      .in('id_gasto_fixo', gastosIds)
      .eq('mes_ano', mesAno);

    if (errRegistros) throw errRegistros;

    // 3. Mescla os dados
    const result: GastoFixoMensal[] = activeGastos.map(gasto => {
      const registro = registros?.find(r => r.id_gasto_fixo === gasto.id) || null;
      return {
        ...gasto,
        registro_atual: registro
      };
    });

    return result;
  },

  // Adiciona um novo Gasto Fixo base
  async addGastoFixo(nome: string, valorPrevisto: number, diaPagamentoPrevisto: number = 10, createdAt?: string): Promise<GastoFixo> {
    const payload: any = { nome, valor_previsto_base: valorPrevisto, dia_pagamento_previsto: diaPagamentoPrevisto };
    if (createdAt) {
      payload.created_at = createdAt;
    }
    const { data, error } = await supabase
      .from('gastos_fixos')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Salva ou atualiza um registro mensal (ex: valor real pago)
  async upsertRegistro(
    id_gasto_fixo: string, 
    mes_ano: string, 
    valor_real: number | null, 
    valor_previsto_ajustado?: number | null,
    dia_pagamento_real?: number | null,
    data_pagamento_real?: string | null
  ): Promise<RegistroGastoFixo> {
    
    // Verifica se já existe um registro
    const { data: existing } = await supabase
      .from('registros_gastos_fixos')
      .select('id_registro')
      .eq('id_gasto_fixo', id_gasto_fixo)
      .eq('mes_ano', mes_ano)
      .maybeSingle(); // Usando maybeSingle() para evitar erro no console se não existir

    if (existing) {
      // Atualiza
      const updateData: any = { valor_real };
      if (valor_previsto_ajustado !== undefined) {
        updateData.valor_previsto_ajustado = valor_previsto_ajustado;
      }
      if (dia_pagamento_real !== undefined) {
        updateData.dia_pagamento_real = dia_pagamento_real;
      }
      if (data_pagamento_real !== undefined) {
        updateData.data_pagamento_real = data_pagamento_real;
      }

      const { data, error } = await supabase
        .from('registros_gastos_fixos')
        .update(updateData)
        .eq('id_registro', existing.id_registro)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } else {
      // Cria novo registro
      const { data, error } = await supabase
        .from('registros_gastos_fixos')
        .insert([{
          id_gasto_fixo,
          mes_ano,
          valor_real,
          valor_previsto_ajustado: valor_previsto_ajustado || null,
          dia_pagamento_real: dia_pagamento_real || null,
          data_pagamento_real: data_pagamento_real || null
        }])
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
  },

  // Remove o pagamento do gasto fixo no mês
  async clearPagamento(id_gasto_fixo: string, mes_ano: string, valor_previsto_ajustado?: number | null): Promise<void> {
    if (valor_previsto_ajustado !== undefined && valor_previsto_ajustado !== null) {
      // Mantém a previsão ajustada, mas limpa os dados de pagamento
      const { error } = await supabase
        .from('registros_gastos_fixos')
        .update({
          valor_real: null,
          dia_pagamento_real: null,
          data_pagamento_real: null
        })
        .eq('id_gasto_fixo', id_gasto_fixo)
        .eq('mes_ano', mes_ano);
      if (error) throw error;
    } else {
      // Se não havia previsão ajustada, pode deletar o registro mensal
      const { error } = await supabase
        .from('registros_gastos_fixos')
        .delete()
        .eq('id_gasto_fixo', id_gasto_fixo)
        .eq('mes_ano', mes_ano);
      if (error) throw error;
    }
  },

  // Atualiza Gasto Fixo base
  async updateGastoFixo(id: string, nome: string, valorPrevisto: number, diaPagamentoPrevisto: number = 10): Promise<void> {
    const { error } = await supabase
      .from('gastos_fixos')
      .update({ nome, valor_previsto_base: valorPrevisto, dia_pagamento_previsto: diaPagamentoPrevisto })
      .eq('id', id);
    if (error) throw error;
  },

  // Encerra um Gasto Fixo a partir do mês informado (mantendo o histórico dos meses anteriores) ou exclui caso tenha iniciado no próprio mês
  async deleteGastoFixo(id: string, aPartirDeMesAno?: string): Promise<void> {
    if (aPartirDeMesAno) {
      const [{ data: gasto }, { data: regsAnteriores }] = await Promise.all([
        supabase.from('gastos_fixos').select('*').eq('id', id).maybeSingle(),
        supabase.from('registros_gastos_fixos').select('id_registro').eq('id_gasto_fixo', id).lt('mes_ano', aPartirDeMesAno).limit(1)
      ]);

      const startMonth = gasto?.created_at ? getLocalYearMonth(gasto.created_at) : '';
      const existedBefore = (startMonth && startMonth < aPartirDeMesAno) || (regsAnteriores && regsAnteriores.length > 0);

      if (existedBefore) {
        const mesFim = getMesAnoAnteriorHelper(aPartirDeMesAno);

        // Remove registros deste mês em diante para não deixar resíduos futuros
        const { error: errDelRegs } = await supabase
          .from('registros_gastos_fixos')
          .delete()
          .eq('id_gasto_fixo', id)
          .gte('mes_ano', aPartirDeMesAno);
        if (errDelRegs) throw errDelRegs;

        // Encerra a recorrência no mês imediatamente anterior
        const { error: errUpd } = await supabase
          .from('gastos_fixos')
          .update({ mes_ano_fim: mesFim, ativo: true })
          .eq('id', id);
        if (errUpd) throw errUpd;
        return;
      }
    }

    const { error } = await supabase
      .from('gastos_fixos')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

