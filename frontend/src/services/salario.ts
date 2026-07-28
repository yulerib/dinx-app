import { supabase } from '../lib/supabase';
import type { Salario } from '../types/database.types';

// Retorna o mês anterior ou posterior em YYYY-MM
function shiftMesAno(mesAno: string, meses: number): string {
  const [y, m] = mesAno.split('-').map(Number);
  const date = new Date(y, m - 1 + meses, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export const salarioService = {
  /**
   * Busca o registro de salário de um mês.
   * Se não houver registro, retorna a configuração herdada do mês mais recente configurado.
   * Assim, meses futuros sem registro sempre mostram os valores corretos da config vigente.
   */
  async fetchSalario(mesAno: string): Promise<Salario | null> {
    // Tenta buscar o registro exato do mês
    const { data: exact, error: errExact } = await supabase
      .from('salario')
      .select('*')
      .eq('mes_ano', mesAno)
      .maybeSingle();

    if (errExact) throw errExact;
    if (exact) return exact;

    // Não há registro: busca o mais recente com mes_ano <= mesAno (configuração herdada)
    const { data: inherited, error: errInherited } = await supabase
      .from('salario')
      .select('*')
      .lte('mes_ano', mesAno)
      .order('mes_ano', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errInherited) throw errInherited;

    if (inherited) {
      // Retorna a config herdada "virtualizada" para este mês (sem id real)
      return {
        ...inherited,
        mes_ano: mesAno,      // mês virtual
        valor_real: null,     // nunca herdado
        data_real: null,      // nunca herdado
        id: ''                // sem id — ainda não foi criado no banco
      };
    }

    return null;
  },

  /**
   * Configura o salário para um mês e propaga para todos os meses futuros
   * que ainda não foram recebidos (valor_real IS NULL ou valor_real = 0).
   */
  async configureSalario(
    mesAno: string,
    valorPrevisto: number,
    diaPrevisto: number | null,
    desvioMesDeposito: number
  ): Promise<void> {
    const payload = {
      valor_previsto: valorPrevisto,
      dia_previsto: diaPrevisto,
      desvio_mes_deposito: desvioMesDeposito
    };

    // 1. Upsert do mês atual (apenas se não tiver valor_real)
    const { data: existingAtual } = await supabase
      .from('salario')
      .select('id, valor_real')
      .eq('mes_ano', mesAno)
      .maybeSingle();

    if (existingAtual) {
      // Só atualiza a previsão se ainda não foi recebido
      if (!existingAtual.valor_real) {
        await supabase
          .from('salario')
          .update(payload)
          .eq('mes_ano', mesAno);
      }
    } else {
      await supabase
        .from('salario')
        .insert([{ mes_ano: mesAno, ...payload }]);
    }

    // 2. Propaga para todos os registros futuros sem recebimento
    await supabase
      .from('salario')
      .update(payload)
      .gt('mes_ano', mesAno)
      .or('valor_real.is.null,valor_real.eq.0');
  },

  /**
   * Registra o recebimento real do salário.
   * Cria o registro se não existir (usando a config herdada como base).
   */
  async registrarRecebimento(
    mesAno: string,
    valorReal: number,
    dataReal: string // YYYY-MM-DD
  ): Promise<Salario> {
    const { data: existing } = await supabase
      .from('salario')
      .select('*')
      .eq('mes_ano', mesAno)
      .maybeSingle();

    if (existing && existing.id) {
      const { data, error } = await supabase
        .from('salario')
        .update({ valor_real: valorReal, data_real: dataReal })
        .eq('mes_ano', mesAno)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Busca a config herdada mais recente para usar como base
      const { data: inherited } = await supabase
        .from('salario')
        .select('*')
        .lte('mes_ano', mesAno)
        .order('mes_ano', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase
        .from('salario')
        .insert([{
          mes_ano: mesAno,
          valor_previsto: inherited?.valor_previsto ?? valorReal,
          dia_previsto: inherited?.dia_previsto ?? null,
          desvio_mes_deposito: inherited?.desvio_mes_deposito ?? 0,
          valor_real: valorReal,
          data_real: dataReal
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Busca todos os registros de salário (para uso em cálculos de histórico)
  async fetchTodosSalarios(): Promise<Salario[]> {
    const { data, error } = await supabase
      .from('salario')
      .select('*')
      .order('mes_ano', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Remove o recebimento registrado (volta ao estado "previsto")
  async estornarRecebimento(mesAno: string): Promise<Salario> {
    const { data, error } = await supabase
      .from('salario')
      .update({ valor_real: null, data_real: null })
      .eq('mes_ano', mesAno)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Helper: calcula o mês físico de depósito dado o mês de referência e o desvio
  getMesDeposito(mesAno: string, desvioMesDeposito: number): string {
    return shiftMesAno(mesAno, desvioMesDeposito);
  }
};
