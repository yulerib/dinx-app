# POP 01: Banco de Dados e Esquemas (Supabase)

## Objetivo
Definir a estrutura determinística do banco de dados relacional (PostgreSQL no Supabase) para refletir fielmente a Constituição (`gemini.md`).

## Regras e Invariantes
1. **Identificadores:** Toda tabela utilizará `UUID` como chave primária (`id`) para evitar colisões e prever sincronizações offline no futuro.
2. **Rastreabilidade:** Toda tabela deve conter uma coluna `created_at`.
3. **Cascatas:** A exclusão de um registro mestre (ex: uma Categoria Diária) deve apagar os registros filhos em cascata (`ON DELETE CASCADE`) para não sujar o banco de dados.

## Metodologia de Deploy (Tabelas)
A API REST do Supabase (com `anon_key` e `service_role_key`) é construída para a Manipulação de Dados (Ler, Inserir, Atualizar, Apagar linhas). Ela **não** suporta a Definição de Dados (Criar Tabelas ou Alterar Colunas) por padrão, a menos que tenhamos a senha raiz do banco (Database Password). 

Portanto, o procedimento operacional para a criação estrutural é rodar o script determinístico gerado (`setup_db.sql`) diretamente no "SQL Editor" do painel do Supabase.

## Schemas Relacionais
- `gastos_fixos` (1) -> (N) `registros_gastos_fixos`
- `categorias_diarias` (1) -> (N) `registros_diarios`
- `compras_parceladas` (Independente)
- `configuracoes` (Linha única global)
