import { supabase } from '../lib/supabase';
import type { Entrada, RegistroEntrada, EntradaMensal } from '../types/database.types';

function addMonths(mesAno: string, count: number): string {
  const [y, m] = mesAno.split('-').map(Number);
  const date = new Date(y, m - 1 + count, 1);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, '0');
  return `${newY}-${newM}`;
}

export const entradasService = {
  // Meshes base/projected entries and monthly realized entries (registros_entradas)
  async fetchEntradasMensais(mesAno: string): Promise<EntradaMensal[]> {
    // 1. Busca todas as entradas ativas
    const { data: entradas, error: errEntradas } = await supabase
      .from('entradas')
      .select('*')
      .eq('ativo', true)
      .order('descricao', { ascending: true });

    if (errEntradas) throw errEntradas;

    if (!entradas || entradas.length === 0) return [];

    // 2. Filtra as entradas que pertencem ao mês especificado (competência)
    const entradasFiltradas = entradas.filter(entrada => {
      const startMonth = entrada.data_entrada.substring(0, 7);
      if (entrada.projetar) {
        const competenciaInicio = addMonths(startMonth, entrada.desvio_competencia || 0);
        const startsOnOrBefore = competenciaInicio <= mesAno;
        const endsOnOrAfter = !entrada.mes_ano_fim || entrada.mes_ano_fim >= mesAno;
        return startsOnOrBefore && endsOnOrAfter;
      } else {
        return startMonth === mesAno;
      }
    });

    if (entradasFiltradas.length === 0) return [];

    const entradasIds = entradasFiltradas.map(e => e.id);

    // 3. Busca registros dessas entradas para o mês específico
    const { data: registros, error: errRegistros } = await supabase
      .from('registros_entradas')
      .select('*')
      .in('id_entrada', entradasIds)
      .eq('mes_ano', mesAno);

    if (errRegistros) throw errRegistros;

    // 4. Mescla os dados
    const result: EntradaMensal[] = entradasFiltradas.map(entrada => {
      const registro = registros?.find(r => r.id_entrada === entrada.id) || null;
      return {
        ...entrada,
        registro_atual: registro
      };
    });

    return result;
  },

  // Adiciona uma nova Entrada
  async addEntrada(entrada: Omit<Entrada, 'id' | 'ativo' | 'created_at'>): Promise<Entrada> {
    const { data, error } = await supabase
      .from('entradas')
      .insert([entrada])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Salva ou atualiza o registro manual (valor real recebido) no mês
  async upsertRegistroEntrada(
    id_entrada: string,
    mes_ano: string,
    valor_real: number
  ): Promise<RegistroEntrada> {
    const { data: existing, error: errExist } = await supabase
      .from('registros_entradas')
      .select('id_registro')
      .eq('id_entrada', id_entrada)
      .eq('mes_ano', mes_ano)
      .maybeSingle();

    if (errExist) throw errExist;

    if (existing) {
      // Atualiza o registro existente
      const { data, error } = await supabase
        .from('registros_entradas')
        .update({ valor_real })
        .eq('id_registro', existing.id_registro)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Cria um novo registro
      const { data, error } = await supabase
        .from('registros_entradas')
        .insert([{
          id_entrada,
          mes_ano,
          valor_real
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Atualiza uma Entrada base existente
  async updateEntrada(
    id: string,
    updates: Partial<Omit<Entrada, 'id' | 'created_at'>>
  ): Promise<Entrada> {
    const { data, error } = await supabase
      .from('entradas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Remove uma entrada base (deleta registros por CASCADE configurado no banco de dados)
  async deleteEntrada(id: string): Promise<void> {
    const { error } = await supabase
      .from('entradas')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Calcula a evolução de entradas dos últimos 6 meses (incluindo o mês atual)
  async fetchEvolucaoEntradas(currentMonthDate: Date): Promise<{ mesAno: string; mesAnoFormatado: string; total: number }[]> {
    const targetYear = currentMonthDate.getFullYear();
    const targetMonth = currentMonthDate.getMonth();

    const [
      { data: dbEntradas, error: errEntradas },
      { data: dbRegEntradas, error: errRegEntradas }
    ] = await Promise.all([
      supabase.from('entradas').select('*'),
      supabase.from('registros_entradas').select('*')
    ]);

    if (errEntradas) throw errEntradas;
    if (errRegEntradas) throw errRegEntradas;

    const listEntradas = dbEntradas || [];
    const listRegEntradas = dbRegEntradas || [];

    // Monta o intervalo dos últimos 6 meses até o mês atual
    const performanceMonths: string[] = [];
    const tempPerfDate = new Date(targetYear, targetMonth - 5, 1);
    const endPerfDate = new Date(targetYear, targetMonth + 1, 1);

    while (tempPerfDate < endPerfDate) {
      const y = tempPerfDate.getFullYear();
      const mStr = String(tempPerfDate.getMonth() + 1).padStart(2, '0');
      performanceMonths.push(`${y}-${mStr}`);
      tempPerfDate.setMonth(tempPerfDate.getMonth() + 1);
    }

    const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return performanceMonths.map(m => {
      let inflowsM = 0;
      const entradasVigentes = listEntradas.filter(e => {
        const mesAnoInicio = e.data_entrada.substring(0, 7);
        if (!e.projetar) {
          return mesAnoInicio === m;
        }
        const competenciaInicio = addMonths(mesAnoInicio, e.desvio_competencia || 0);
        if (competenciaInicio > m) return false;
        if (e.mes_ano_fim && m > e.mes_ano_fim) return false;
        return true;
      });

      entradasVigentes.forEach(e => {
        if (!e.projetar) {
          // Entrada pontual (única): sempre conta o valor_previsto_base, independente de haver registro
          inflowsM += Number(e.valor_previsto_base);
        } else {
          // Entrada recorrente: usa valor_real se houver registro, senão o valor projetado base
          const reg = listRegEntradas.find(r => r.id_entrada === e.id && r.mes_ano === m);
          if (reg) {
            inflowsM += Number(reg.valor_real);
          } else if (e.ativo) {
            inflowsM += Number(e.valor_previsto_base);
          }
        }
      });

      const [year, month] = m.split('-').map(Number);
      const mesAnoFormatado = `${mesesAbrev[month - 1]}/${String(year).slice(-2)}`;

      return {
        mesAno: m,
        mesAnoFormatado,
        total: Number(inflowsM.toFixed(2))
      };
    });
  }
};
