import { supabase } from '../lib/supabase';
import type { Observacao } from '../types/database.types';

export const observacoesService = {
  // Busca todas as observações ordenadas pelas mais recentes
  async fetchAll(): Promise<Observacao[]> {
    const { data, error } = await supabase
      .from('observacoes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Cria uma nova observação
  async add(titulo: string, conteudo: string): Promise<Observacao> {
    const { data, error } = await supabase
      .from('observacoes')
      .insert([{ titulo, conteudo }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Atualiza uma observação existente
  async update(id: string, titulo: string, conteudo: string): Promise<Observacao> {
    const { data, error } = await supabase
      .from('observacoes')
      .update({ titulo, conteudo, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Exclui uma observação
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('observacoes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
