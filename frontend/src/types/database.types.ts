export interface GastoFixo {
  id: string;
  nome: string;
  valor_previsto_base: number;
  dia_pagamento_previsto: number;
  ativo: boolean;
  created_at: string;
}

export interface RegistroGastoFixo {
  id_registro: string;
  id_gasto_fixo: string;
  mes_ano: string;
  valor_previsto_ajustado: number | null;
  valor_real: number;
  dia_pagamento_real: number | null;
  data_pagamento_real: string | null;
  created_at: string;
}

// Tipo customizado para facilitar a view no Frontend
export interface GastoFixoMensal extends GastoFixo {
  registro_atual: RegistroGastoFixo | null;
}

// --- Gastos Diários ---

export interface CategoriaDiaria {
  id: string;
  nome: string;
  limite_mensal: number;
  created_at: string;
}

export interface RegistroDiario {
  id_registro: string;
  data: string; // YYYY-MM-DD
  id_categoria: string | null;
  descricao?: string;
  valor_gasto: number;
  created_at: string;
}

export interface CategoriaComRegistroDiario extends CategoriaDiaria {
  registros_hoje: RegistroDiario[];
}

// --- Compras Parceladas ---

export interface CategoriaCartao {
  id: string;
  nome: string;
  created_at: string;
}

export interface CompraParcelada {
  id: string;
  nome_compra: string;
  valor_total: number;
  num_parcelas: number;
  valor_parcela: number;
  mes_ano_inicio: string; // YYYY-MM
  descricao?: string | null;
  data_compra: string; // YYYY-MM-DD
  id_categoria?: string | null;
  created_at: string;
}

export interface Configuracao {
  id: string;
  limite_mensal_parcelas: number;
  gemini_api_key?: string;
  updated_at: string;
}

// --- Entradas / Receitas ---

export interface Entrada {
  id: string;
  descricao: string;
  valor_previsto_base: number;
  projetar: boolean;
  mes_ano_fim: string | null;
  data_entrada: string; // YYYY-MM-DD
  ativo: boolean;
  desvio_competencia?: number; // Mantido para compatibilidade com o banco, não usado na UI
  created_at: string;
}

export interface RegistroEntrada {
  id_registro: string;
  id_entrada: string;
  mes_ano: string; // YYYY-MM
  valor_real: number;
  created_at: string;
}

export interface EntradaMensal extends Entrada {
  registro_atual: RegistroEntrada | null;
}

// --- Salário ---

export interface Salario {
  id: string;
  mes_ano: string;              // YYYY-MM — mês de referência/competência do salário
  valor_previsto: number;
  dia_previsto: number | null;  // Dia do depósito previsto
  desvio_mes_deposito: number;  // 0 = mesmo mês, 1 = mês seguinte, -1 = mês anterior, etc.
  valor_real: number | null;    // Valor real recebido
  data_real: string | null;     // Data real do recebimento (YYYY-MM-DD)
  created_at: string;
}

// --- Pagamento de Faturas ---

export interface PagamentoFatura {
  id: string;
  mes_ano: string; // YYYY-MM
  pago: boolean;
  dia_pagamento_real: number | null;
  valor_pago: number;
  created_at: string;
}

// --- Reserva Financeira ---

export interface MovimentacaoReserva {
  id: string;
  descricao: string;
  valor_previsto_base: number;
  tipo: 'entrada' | 'saida';
  projetar: boolean;
  mes_ano_fim: string | null;
  data_movimentacao: string; // YYYY-MM-DD
  dia_movimentacao_previsto: number;
  afeta_conta_geral: boolean;
  gerar_saldo_devedor: boolean;
  quitar_saldo_devedor: boolean;
  ativo: boolean;
  reposto?: boolean;
  created_at: string;
}

export interface RegistroMovimentacaoReserva {
  id_registro: string;
  id_movimentacao: string | null;
  mes_ano: string; // YYYY-MM
  valor_real: number;
  dia_movimentacao_real: number | null;
  afeta_conta_geral: boolean;
  gerar_saldo_devedor: boolean;
  quitar_saldo_devedor: boolean;
  reposto?: boolean;
  created_at: string;
}

export interface MovimentacaoReservaMensal extends MovimentacaoReserva {
  registro_atual: RegistroMovimentacaoReserva | null;
}

// --- Observações / Anotações ---
export interface Observacao {
  id: string;
  titulo: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
}


