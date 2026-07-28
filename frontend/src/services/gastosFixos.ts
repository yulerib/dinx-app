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

    // Filter to only include expenses created in or before the requested month (mesAno)
    const activeGastos = gastos.filter(g => !g.created_at || getLocalYearMonth(g.created_at) <= mesAno);

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
    valor_real: number, 
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

  // Atualiza Gasto Fixo base
  async updateGastoFixo(id: string, nome: string, valorPrevisto: number, diaPagamentoPrevisto: number = 10): Promise<void> {
    const { error } = await supabase
      .from('gastos_fixos')
      .update({ nome, valor_previsto_base: valorPrevisto, dia_pagamento_previsto: diaPagamentoPrevisto })
      .eq('id', id);
    if (error) throw error;
  },

  // Exclui um Gasto Fixo e seus registros
  async deleteGastoFixo(id: string): Promise<void> {
    const { error } = await supabase
      .from('gastos_fixos')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

