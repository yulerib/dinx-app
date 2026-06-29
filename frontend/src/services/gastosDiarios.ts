import { supabase } from '../lib/supabase';
import type { CategoriaDiaria, RegistroDiario, CategoriaComRegistroDiario } from '../types/database.types';

export const gastosDiariosService = {
  // Busca as categorias e seus respectivos registros para uma data específica (YYYY-MM-DD)
  async fetchCategoriasComRegistroDia(dataIso: string): Promise<CategoriaComRegistroDiario[]> {
    const { data: categorias, error: errCat } = await supabase
      .from('categorias_diarias')
      .select('*')
      .order('nome', { ascending: true });

    if (errCat) throw errCat;
    if (!categorias || categorias.length === 0) return [];

    const { data: registros, error: errReg } = await supabase
      .from('registros_diarios')
      .select('*')
      .in('id_categoria', categorias.map(c => c.id))
      .eq('data', dataIso);

    if (errReg) throw errReg;

    return categorias.map(cat => ({
      ...cat,
      registros_hoje: registros?.filter(r => r.id_categoria === cat.id) || []
    }));
  },

  // Busca APENAS as categorias sem os registros (útil para checagem geral)
  async fetchCategorias(): Promise<CategoriaDiaria[]> {
    const { data: categorias, error } = await supabase
      .from('categorias_diarias')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    return categorias || [];
  },

  // Busca todos os registros de todas as categorias de um determinado ano
  async fetchRegistrosDoAno(year: number): Promise<RegistroDiario[]> {
    const { data, error } = await supabase
      .from('registros_diarios')
      .select('*')
      .gte('data', `${year}-01-01`)
      .lte('data', `${year}-12-31`);

    if (error) throw error;
    return data || [];
  },

  // Busca TODOS os registros de todas as categorias do mês (ex: 2026-05)
  async fetchRegistrosDoMes(mesAno: string): Promise<RegistroDiario[]> {
    const [year, month] = mesAno.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    
    const start = `${mesAno}-01`;
    const end = `${mesAno}-${String(lastDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('registros_diarios')
      .select('*')
      .gte('data', start)
      .lte('data', end);

    if (error) throw error;
    return data || [];
  },

  // Cria uma nova Categoria
  async addCategoria(nome: string, limite_mensal: number): Promise<CategoriaDiaria> {
    const { data, error } = await supabase
      .from('categorias_diarias')
      .insert([{ nome, limite_mensal }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Edita uma Categoria
  async updateCategoria(id: string, nome: string, limite_mensal: number): Promise<void> {
    const { error } = await supabase
      .from('categorias_diarias')
      .update({ nome, limite_mensal })
      .eq('id', id);
    if (error) throw error;
  },

  // Deleta uma Categoria (CASCADE apagará os registros diários dela)
  async deleteCategoria(id: string): Promise<void> {
    const { error } = await supabase
      .from('categorias_diarias')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Adiciona um lançamento individual no dia para a categoria (ou pontual sem categoria se for null)
  async addRegistroDiario(id_categoria: string | null, dataIso: string, valor_gasto: number, descricao: string): Promise<RegistroDiario> {
    const { data, error } = await supabase
      .from('registros_diarios')
      .insert([{ id_categoria, data: dataIso, valor_gasto, descricao }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Busca lançamentos pontuais sem categoria para o dia
  async fetchRegistrosPontuaisDia(dataIso: string): Promise<RegistroDiario[]> {
    const { data, error } = await supabase
      .from('registros_diarios')
      .select('*')
      .is('id_categoria', null)
      .eq('data', dataIso);

    if (error) throw error;
    return data || [];
  },

  // Edita um lançamento individual
  async updateRegistroDiario(id_registro: string, valor_gasto: number, descricao: string): Promise<void> {
    const { error } = await supabase
      .from('registros_diarios')
      .update({ valor_gasto, descricao })
      .eq('id_registro', id_registro);
    if (error) throw error;
  },

  // Remove um lançamento individual do dia
  async deleteRegistroDiario(id_registro: string): Promise<void> {
    const { error } = await supabase
      .from('registros_diarios')
      .delete()
      .eq('id_registro', id_registro);
    if (error) throw error;
  },

  // Botão Pânico: Zera todas as categorias que ainda não têm NENHUM registro naquele dia
  async zerarDiaInteiro(categorias: CategoriaComRegistroDiario[], dataIso: string): Promise<void> {
    const inserts = categorias
      .filter(c => c.registros_hoje.length === 0)
      .map(c => ({
        id_categoria: c.id,
        data: dataIso,
        valor_gasto: 0,
        descricao: 'Zerado'
      }));

    if (inserts.length === 0) return;

    const { error } = await supabase
      .from('registros_diarios')
      .insert(inserts);

    if (error) throw error;
  },

  // Insere um lote de registros com valor 0 para preencher lacunas passadas
  async zerarLacunasBatch(inserts: {id_categoria: string, data: string, valor_gasto: number, descricao: string}[]): Promise<void> {
    if (inserts.length === 0) return;
    const { error } = await supabase
      .from('registros_diarios')
      .insert(inserts);
    if (error) throw error;
  }
};
