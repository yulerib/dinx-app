import { supabase } from '../lib/supabase';
import type { MovimentacaoReserva, RegistroMovimentacaoReserva, MovimentacaoReservaMensal } from '../types/database.types';

export const reservaService = {
  // Busca as movimentações do mês (mescla as recorrentes ativas com seus registros e as pontuais do mês)
  async fetchMovimentacoesMensais(mesAno: string): Promise<MovimentacaoReservaMensal[]> {
    // 1. Busca todas as movimentações ativas
    const { data: movimentacoes, error: errMovs } = await supabase
      .from('movimentacoes_reserva')
      .select('*')
      .eq('ativo', true)
      .order('dia_movimentacao_previsto', { ascending: true })
      .order('descricao', { ascending: true });

    if (errMovs) throw errMovs;

    if (!movimentacoes || movimentacoes.length === 0) return [];

    // 2. Filtra as que pertencem ao mês especificado
    // - Recorrente (projetar = true): inicia em ou antes de mesAno e termina em ou depois de mesAno (ou sem fim)
    // - Pontual (projetar = false): a data da movimentação cai no mês mesAno
    const filtradas = movimentacoes.filter(mov => {
      const startMonth = mov.data_movimentacao.substring(0, 7);
      if (mov.projetar) {
        const startsOnOrBefore = startMonth <= mesAno;
        const endsOnOrAfter = !mov.mes_ano_fim || mov.mes_ano_fim >= mesAno;
        return startsOnOrBefore && endsOnOrAfter;
      } else {
        return startMonth === mesAno;
      }
    });

    if (filtradas.length === 0) return [];

    const ids = filtradas.map(m => m.id);

    // 3. Busca registros confirmados dessas movimentações para o mês específico
    const { data: registros, error: errRegs } = await supabase
      .from('registros_movimentacoes_reserva')
      .select('*')
      .in('id_movimentacao', ids)
      .eq('mes_ano', mesAno);

    if (errRegs) throw errRegs;

    // 4. Mescla os dados
    const result: MovimentacaoReservaMensal[] = filtradas.map(mov => {
      const registro = registros?.find(r => r.id_movimentacao === mov.id) || null;
      return {
        ...mov,
        registro_atual: registro
      };
    });

    return result;
  },

  // Adiciona uma nova movimentação base
  async addMovimentacao(mov: Omit<MovimentacaoReserva, 'id' | 'ativo' | 'created_at'>): Promise<MovimentacaoReserva> {
    const { data, error } = await supabase
      .from('movimentacoes_reserva')
      .insert([mov])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Salva ou atualiza o registro de realização mensal (valor real movimentado)
  async upsertRegistroMovimentacao(
    id_movimentacao: string,
    mes_ano: string,
    valor_real: number,
    dia_movimentacao_real: number | null,
    options: { afeta_conta_geral: boolean; gerar_saldo_devedor: boolean; quitar_saldo_devedor: boolean }
  ): Promise<RegistroMovimentacaoReserva> {
    const { data: existing, error: errExist } = await supabase
      .from('registros_movimentacoes_reserva')
      .select('id_registro')
      .eq('id_movimentacao', id_movimentacao)
      .eq('mes_ano', mes_ano)
      .maybeSingle();

    if (errExist) throw errExist;

    const payload = {
      id_movimentacao,
      mes_ano,
      valor_real,
      dia_movimentacao_real,
      afeta_conta_geral: options.afeta_conta_geral,
      gerar_saldo_devedor: options.gerar_saldo_devedor,
      quitar_saldo_devedor: options.quitar_saldo_devedor
    };

    if (existing) {
      // Atualiza o registro existente
      const { data, error } = await supabase
        .from('registros_movimentacoes_reserva')
        .update(payload)
        .eq('id_registro', existing.id_registro)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Cria um novo registro
      const { data, error } = await supabase
        .from('registros_movimentacoes_reserva')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  // Atualiza uma movimentação base existente
  async updateMovimentacao(
    id: string,
    updates: Partial<Omit<MovimentacaoReserva, 'id' | 'created_at'>>
  ): Promise<MovimentacaoReserva> {
    const { data, error } = await supabase
      .from('movimentacoes_reserva')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Remove uma movimentação base (deleta registros por CASCADE no banco de dados)
  async deleteMovimentacao(id: string): Promise<void> {
    const { error } = await supabase
      .from('movimentacoes_reserva')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Retorna todas as movimentações reais históricas realizadas (reais das recorrentes + todas as pontuais)
  async fetchHistoricoReserva(): Promise<{
    id: string;
    data: string; // YYYY-MM-DD
    descricao: string;
    tipo: 'entrada' | 'saida';
    valor: number;
    afeta_conta_geral: boolean;
    gerar_saldo_devedor: boolean;
    quitar_saldo_devedor: boolean;
    recorrente: boolean;
    mes_ano?: string;
  }[]> {
    const [
      { data: dbMovs, error: errMovs },
      { data: dbRegs, error: errRegs }
    ] = await Promise.all([
      supabase.from('movimentacoes_reserva').select('*'),
      supabase.from('registros_movimentacoes_reserva').select('*')
    ]);

    if (errMovs) throw errMovs;
    if (errRegs) throw errRegs;

    const listMovs = dbMovs || [];
    const listRegs = dbRegs || [];

    const historico: any[] = [];

    // 1. Processar movimentações pontuais (elas já são a realização por si só)
    listMovs
      .filter(m => !m.projetar)
      .forEach(m => {
        historico.push({
          id: `pontual-${m.id}`,
          data: m.data_movimentacao,
          descricao: m.descricao,
          tipo: m.tipo,
          valor: Number(m.valor_previsto_base),
          afeta_conta_geral: m.afeta_conta_geral,
          gerar_saldo_devedor: m.tipo === 'saida' && m.gerar_saldo_devedor,
          quitar_saldo_devedor: m.tipo === 'entrada' && m.quitar_saldo_devedor,
          recorrente: false,
          reposto: m.reposto,
          created_at: m.created_at
        });
      });

    // 2. Processar registros de movimentações recorrentes
    listRegs.forEach(r => {
      const parentMov = listMovs.find(m => m.id === r.id_movimentacao);
      const desc = parentMov ? parentMov.descricao : 'Movimentação Recorrente';
      const tipo = parentMov ? parentMov.tipo : 'entrada';
      const dia = r.dia_movimentacao_real || (parentMov ? parentMov.dia_movimentacao_previsto : 10);
      const dataMov = `${r.mes_ano}-${String(dia).padStart(2, '0')}`;

      historico.push({
        id: `registro-${r.id_registro}`,
        data: dataMov,
        descricao: `${desc} (Confirmada)`,
        tipo: tipo,
        valor: Number(r.valor_real),
        afeta_conta_geral: r.afeta_conta_geral,
        gerar_saldo_devedor: tipo === 'saida' && r.gerar_saldo_devedor,
        quitar_saldo_devedor: tipo === 'entrada' && r.quitar_saldo_devedor,
        recorrente: true,
        mes_ano: r.mes_ano,
        reposto: r.reposto,
        created_at: r.created_at
      });
    });

    // Ordenar por data cronologicamente
    historico.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.created_at.localeCompare(b.created_at);
    });

    return historico;
  },

  // Zera manualmente as movimentações a repor (marca reposto = true)
  async resetValoresARepor(): Promise<void> {
    // 1. Atualizar movimentações pontuais
    const { error: err1 } = await supabase
      .from('movimentacoes_reserva')
      .update({ reposto: true })
      .eq('projetar', false)
      .or('gerar_saldo_devedor.eq.true,quitar_saldo_devedor.eq.true');

    if (err1) throw err1;

    // 2. Atualizar registros de recorrentes
    const { error: err2 } = await supabase
      .from('registros_movimentacoes_reserva')
      .update({ reposto: true })
      .or('gerar_saldo_devedor.eq.true,quitar_saldo_devedor.eq.true');

    if (err2) throw err2;
  }
};
