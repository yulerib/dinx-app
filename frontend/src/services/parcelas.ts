import { supabase } from '../lib/supabase';
import type { CompraParcelada, Configuracao, PagamentoFatura, CategoriaCartao } from '../types/database.types';

export const parcelasService = {
  // Configurações Globais
  async fetchConfiguracao(): Promise<Configuracao | null> {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .limit(1)
      .single();
    
    // Se não existir, podemos tratar na UI, mas o DB já deve ter criado
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async updateLimiteParcelas(limite: number): Promise<void> {
    // Busca o ID atual
    const config = await this.fetchConfiguracao();
    if (config) {
      const { error } = await supabase
        .from('configuracoes')
        .update({ limite_mensal_parcelas: limite })
        .eq('id', config.id);
      if (error) throw error;
    } else {
      // Cria se não existir (fallback)
      const { error } = await supabase
        .from('configuracoes')
        .insert([{ limite_mensal_parcelas: limite }]);
      if (error) throw error;
    }
  },

  async updateGeminiApiKey(key: string): Promise<void> {
    const config = await this.fetchConfiguracao();
    if (config) {
      const { error } = await supabase
        .from('configuracoes')
        .update({ gemini_api_key: key })
        .eq('id', config.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('configuracoes')
        .insert([{ gemini_api_key: key }]);
      if (error) throw error;
    }
  },

  // Compras Parceladas
  async fetchTodasParcelas(): Promise<CompraParcelada[]> {
    // Busca todas as parcelas cadastradas. O frontend fará o filtro para saber quais afetam o mês atual
    const { data, error } = await supabase
      .from('compras_parceladas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addParcela(
    nome_compra: string, 
    valor_total: number, 
    num_parcelas: number, 
    valor_parcela: number, 
    mes_ano_inicio: string,
    descricao: string | null = null,
    data_compra: string = `${mes_ano_inicio}-01`,
    id_categoria: string | null = null
  ): Promise<CompraParcelada> {
    const { data, error } = await supabase
      .from('compras_parceladas')
      .insert([{ nome_compra, valor_total, num_parcelas, valor_parcela, mes_ano_inicio, descricao, data_compra, id_categoria }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateParcela(
    id: string, 
    nome_compra: string, 
    valor_total: number, 
    num_parcelas: number, 
    valor_parcela: number, 
    mes_ano_inicio: string,
    descricao: string | null = null,
    data_compra: string = `${mes_ano_inicio}-01`,
    id_categoria: string | null = null
  ): Promise<void> {
    const { error } = await supabase
      .from('compras_parceladas')
      .update({ nome_compra, valor_total, num_parcelas, valor_parcela, mes_ano_inicio, descricao, data_compra, id_categoria })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteParcela(id: string): Promise<void> {
    const { error } = await supabase
      .from('compras_parceladas')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Categorias de Cartão de Crédito
  async fetchCategoriasCartao(): Promise<CategoriaCartao[]> {
    const { data, error } = await supabase
      .from('categorias_cartao')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async addCategoriaCartao(nome: string): Promise<CategoriaCartao> {
    const { data, error } = await supabase
      .from('categorias_cartao')
      .insert([{ nome }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCategoriaCartao(id: string): Promise<void> {
    const { error } = await supabase
      .from('categorias_cartao')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Pagamento de Faturas
  async fetchPagamentoFatura(mesAno: string): Promise<PagamentoFatura | null> {
    const { data, error } = await supabase
      .from('pagamentos_faturas')
      .select('*')
      .eq('mes_ano', mesAno)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async upsertPagamentoFatura(mesAno: string, pago: boolean, diaPagamentoReal: number | null, valorPago: number): Promise<void> {
    const existing = await this.fetchPagamentoFatura(mesAno);
    if (existing) {
      const { error } = await supabase
        .from('pagamentos_faturas')
        .update({
          pago,
          dia_pagamento_real: diaPagamentoReal,
          valor_pago: valorPago
        })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('pagamentos_faturas')
        .insert([{
          mes_ano: mesAno,
          pago,
          dia_pagamento_real: diaPagamentoReal,
          valor_pago: valorPago
        }]);
      if (error) throw error;
    }
  }
};
