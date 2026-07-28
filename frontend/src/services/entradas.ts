import { supabase } from '../lib/supabase';
import type { Entrada, RegistroEntrada, EntradaMensal } from '../types/database.types';
import { salarioService } from './salario';

export const entradasService = {
  // Mescla entradas base com registros realizados do mês
  async fetchEntradasMensais(mesAno: string): Promise<EntradaMensal[]> {
    // 1. Busca todas as entradas ativas
    const { data: entradas, error: errEntradas } = await supabase
      .from('entradas')
      .select('*')
      .eq('ativo', true)
      .order('descricao', { ascending: true });

    if (errEntradas) throw errEntradas;

    const entradasBase = entradas || [];

    // 2. Filtra as entradas que pertencem ao mês especificado
    const entradasFiltradas = entradasBase.filter(entrada => {
      const startMonth = entrada.data_entrada.substring(0, 7);
      if (entrada.projetar) {
        const startsOnOrBefore = startMonth <= mesAno;
        const endsOnOrAfter = !entrada.mes_ano_fim || entrada.mes_ano_fim >= mesAno;
        return startsOnOrBefore && endsOnOrAfter;
      } else {
        return startMonth === mesAno;
      }
    });

    const entradasIds = entradasFiltradas.map(e => e.id);

    // 3. Busca registros dessas entradas para o mês específico
    let registros: any[] = [];
    if (entradasIds.length > 0) {
      const { data: regs, error: errRegistros } = await supabase
        .from('registros_entradas')
        .select('*')
        .in('id_entrada', entradasIds)
        .eq('mes_ano', mesAno);

      if (errRegistros) throw errRegistros;
      registros = regs || [];
    }

    // 4. Mescla os dados
    const result: EntradaMensal[] = entradasFiltradas.map(entrada => {
      const registro = registros.find(r => r.id_entrada === entrada.id) || null;
      return {
        ...entrada,
        registro_atual: registro
      };
    });

    // 5. Adiciona o salário como uma EntradaMensal virtual
    try {
      const salario = await salarioService.fetchSalario(mesAno);
      if (salario && (salario.valor_previsto > 0 || (salario.valor_real && salario.valor_real > 0))) {
        const salarioVirtual: EntradaMensal = {
          id: 'salario-virtual',
          descricao: 'Salário',
          valor_previsto_base: salario.valor_previsto,
          projetar: true,
          mes_ano_fim: null,
          data_entrada: `${mesAno}-${String(salario.dia_previsto || 5).padStart(2, '0')}`,
          ativo: true,
          created_at: salario.created_at || new Date().toISOString(),
          registro_atual: salario.valor_real !== null && salario.valor_real !== undefined ? {
            id_registro: 'salario-registro-virtual',
            id_entrada: 'salario-virtual',
            mes_ano: mesAno,
            valor_real: salario.valor_real,
            created_at: salario.created_at || new Date().toISOString()
          } : null
        };
        result.push(salarioVirtual);
      }
    } catch (e) {
      console.error("Erro ao buscar salário em fetchEntradasMensais:", e);
    }

    return result;
  },

  // Calcula os totais previstos e realizados de entradas no mês
  async fetchTotalsPorMes(mesAno: string): Promise<{ previsto: number; realizado: number }> {
    // 1. Busca todas as entradas ativas
    const { data: entradas, error: errEntradas } = await supabase
      .from('entradas')
      .select('*')
      .eq('ativo', true);

    if (errEntradas) throw errEntradas;
    const entradasBase = entradas || [];

    // 2. Filtra entradas vigentes no mês
    const entradasVigentes = entradasBase.filter(e => {
      const startMonth = e.data_entrada.substring(0, 7);
      if (e.projetar) {
        return startMonth <= mesAno && (!e.mes_ano_fim || e.mes_ano_fim >= mesAno);
      }
      return startMonth === mesAno;
    });

    // 3. Busca registros do mês
    let registros: any[] = [];
    if (entradasVigentes.length > 0) {
      const entradasIds = entradasVigentes.map(e => e.id);
      const { data: regs, error: errRegistros } = await supabase
        .from('registros_entradas')
        .select('*')
        .in('id_entrada', entradasIds)
        .eq('mes_ano', mesAno);

      if (errRegistros) throw errRegistros;
      registros = regs || [];
    }

    let previstoTotal = 0;
    let realizadoTotal = 0;

    for (const e of entradasVigentes) {
      if (e.projetar) {
        previstoTotal += Number(e.valor_previsto_base);
        const reg = registros.find(r => r.id_entrada === e.id);
        realizadoTotal += reg ? Number(reg.valor_real) : 0;
      } else {
        // Entrada pontual: usa valor_previsto_base como realizado
        realizadoTotal += Number(e.valor_previsto_base);
      }
    }

    // 4. Soma o salário previsto e real
    try {
      const salario = await salarioService.fetchSalario(mesAno);
      if (salario) {
        previstoTotal += Number(salario.valor_previsto);
        if (salario.valor_real !== null && salario.valor_real !== undefined) {
          realizadoTotal += Number(salario.valor_real);
        }
      }
    } catch (e) {
      console.error("Erro ao buscar salário em fetchTotalsPorMes:", e);
    }

    return {
      previsto: Number(previstoTotal.toFixed(2)),
      realizado: Number(realizadoTotal.toFixed(2))
    };
  },

  // Adiciona uma nova Entrada
  async addEntrada(entrada: Omit<Entrada, 'id' | 'ativo' | 'created_at' | 'desvio_competencia'>): Promise<Entrada> {
    const { data, error } = await supabase
      .from('entradas')
      .insert([{ ...entrada, desvio_competencia: 0 }])
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
      const { data, error } = await supabase
        .from('registros_entradas')
        .update({ valor_real })
        .eq('id_registro', existing.id_registro)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('registros_entradas')
        .insert([{ id_entrada, mes_ano, valor_real }])
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
      .update({ ...updates, desvio_competencia: 0 })
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

    const resultPromises = performanceMonths.map(async (m) => {
      let inflowsM = 0;
      const entradasVigentes = listEntradas.filter(e => {
        const startMonth = e.data_entrada.substring(0, 7);
        if (e.projetar) {
          return startMonth <= m && (!e.mes_ano_fim || e.mes_ano_fim >= m);
        }
        return startMonth === m;
      });

      entradasVigentes.forEach(e => {
        if (!e.projetar) {
          // Entrada pontual: conta sempre o valor_previsto_base
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

      // Busca salário correspondente a esse mês (seja específico ou herdado)
      try {
        const sal = await salarioService.fetchSalario(m);
        if (sal) {
          if (sal.valor_real !== null && sal.valor_real !== undefined) {
            inflowsM += Number(sal.valor_real);
          } else {
            inflowsM += Number(sal.valor_previsto);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar salário para evolução no mês " + m, err);
      }

      const [year, month] = m.split('-').map(Number);
      const mesAnoFormatado = `${mesesAbrev[month - 1]}/${String(year).slice(-2)}`;

      return {
        mesAno: m,
        mesAnoFormatado,
        total: Number(inflowsM.toFixed(2))
      };
    });

    return Promise.all(resultPromises);
  }
};
