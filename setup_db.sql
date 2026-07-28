-- Habilitar a extensão UUID (boa prática no Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela: Gastos_Fixos
CREATE TABLE public.gastos_fixos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    valor_previsto_base NUMERIC NOT NULL DEFAULT 0,
    dia_pagamento_previsto INTEGER NOT NULL DEFAULT 10,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Registros_Gastos_Fixos
CREATE TABLE public.registros_gastos_fixos (
    id_registro UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_gasto_fixo UUID REFERENCES public.gastos_fixos(id) ON DELETE CASCADE,
    mes_ano TEXT NOT NULL, -- Ex: '2026-05'
    valor_previsto_ajustado NUMERIC,
    valor_real NUMERIC DEFAULT 0,
    dia_pagamento_real INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Categorias_Diarias
CREATE TABLE public.categorias_diarias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    limite_mensal NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Registros_Diarios
CREATE TABLE public.registros_diarios (
    id_registro UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data DATE NOT NULL,
    id_categoria UUID REFERENCES public.categorias_diarias(id) ON DELETE CASCADE,
    descricao TEXT, -- Novo campo adicionado para suportar múltiplos itens
    valor_gasto NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Compras_Parceladas
CREATE TABLE public.compras_parceladas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_compra TEXT NOT NULL,
    valor_total NUMERIC NOT NULL,
    num_parcelas INTEGER NOT NULL,
    valor_parcela NUMERIC NOT NULL,
    mes_ano_inicio TEXT NOT NULL, -- Ex: '2026-05'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Configuracoes
CREATE TABLE public.configuracoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    limite_mensal_parcelas NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Entradas
CREATE TABLE public.entradas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    descricao TEXT NOT NULL,
    valor_previsto_base NUMERIC NOT NULL DEFAULT 0,
    projetar BOOLEAN NOT NULL DEFAULT TRUE,
    mes_ano_fim TEXT, -- Formato YYYY-MM
    data_entrada DATE NOT NULL, -- Formato YYYY-MM-DD
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Registros_Entradas
CREATE TABLE public.registros_entradas (
    id_registro UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_entrada UUID REFERENCES public.entradas(id) ON DELETE CASCADE,
    mes_ano TEXT NOT NULL, -- Formato YYYY-MM
    valor_real NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Pagamentos_Faturas
CREATE TABLE public.pagamentos_faturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mes_ano TEXT NOT NULL, -- Formato YYYY-MM
    pago BOOLEAN NOT NULL DEFAULT FALSE,
    dia_pagamento_real INTEGER,
    valor_pago NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir uma linha padrão em Configuracoes para evitar que a tabela fique vazia
INSERT INTO public.configuracoes (limite_mensal_parcelas) VALUES (0);

-- Tabela: Movimentacoes_Reserva
CREATE TABLE public.movimentacoes_reserva (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    descricao TEXT NOT NULL,
    valor_previsto_base NUMERIC NOT NULL DEFAULT 0,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    projetar BOOLEAN NOT NULL DEFAULT FALSE,
    mes_ano_fim TEXT, -- Formato YYYY-MM
    data_movimentacao DATE NOT NULL, -- Formato YYYY-MM-DD
    dia_movimentacao_previsto INTEGER NOT NULL DEFAULT 10,
    afeta_conta_geral BOOLEAN NOT NULL DEFAULT TRUE,
    gerar_saldo_devedor BOOLEAN NOT NULL DEFAULT FALSE,
    quitar_saldo_devedor BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Registros_Movimentacoes_Reserva
CREATE TABLE public.registros_movimentacoes_reserva (
    id_registro UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_movimentacao UUID REFERENCES public.movimentacoes_reserva(id) ON DELETE CASCADE,
    mes_ano TEXT NOT NULL, -- Formato YYYY-MM
    valor_real NUMERIC NOT NULL DEFAULT 0,
    dia_movimentacao_real INTEGER,
    afeta_conta_geral BOOLEAN NOT NULL DEFAULT TRUE,
    gerar_saldo_devedor BOOLEAN NOT NULL DEFAULT FALSE,
    quitar_saldo_devedor BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela: Observacoes
CREATE TABLE public.observacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


