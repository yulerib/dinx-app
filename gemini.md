# Constituição do Projeto (gemini.md)

## Regras Comportamentais
1. Foco em estabilidade e determinismo (Protocolo V.L.A.E.G.).
2. Priorizar a lógica de negócios através de POPs (Procedimentos Operacionais Padrão) na Camada 1.
3. Nenhuma linha de código em `tools/` pode ser escrita antes do schema de dados estar definido, testado e aprovado.
4. O visual deve ser sempre "extremamente profissional, sóbrio e clean" (conforme briefing).

## Invariantes Arquiteturais
- Arquitetura de 3 camadas (A.N.T.: Arquitetura, Navegação, Ferramentas).
- Dados primários ficarão em um banco/solução sem custos (Supabase).
- Haverá controle e registro de entradas/receitas financeiras e cálculo do saldo em conta corrente com histórico acumulativo.
- App de uso pessoal, escalabilidade restrita a apenas 2 usuários de forma segura.

## Esquemas de Dados (Schemas)

A fonte da verdade será o **Supabase**.

**Tabela: `Gastos_Fixos`**
- `id` (UUID): Identificador único.
- `nome` (String): Nome da despesa (ex: Aluguel, Internet).
- `valor_previsto_base` (Number): Valor planejado por padrão.
- `dia_pagamento_previsto` (Number): Dia projetado para o pagamento (1-31).
- `ativo` (Boolean): Se a despesa ainda existe.

**Tabela: `Registros_Gastos_Fixos`**
- `id_registro` (UUID)
- `id_gasto_fixo` (UUID REFERENCES Gastos_Fixos)
- `mes_ano` (String): Formato YYYY-MM.
- `valor_previsto_ajustado` (Number): Caso haja ajuste específico para este mês.
- `valor_real` (Number): Valor efetivamente gasto.
- `dia_pagamento_real` (Number): Dia em que foi paga (1-31) (opcional).

**Tabela: `Categorias_Diarias`**
- `id` (UUID)
- `nome` (String): Ex: Alimentação, Transporte.
- `limite_mensal` (Number): Orçamento mensal para a categoria. (Cálculo diário = limite_mensal / 31).

**Tabela: `Registros_Diarios`**
- `id_registro` (UUID)
- `data` (String): Formato YYYY-MM-DD.
- `id_categoria` (UUID REFERENCES Categorias_Diarias)
- `descricao` (String): Detalhes do gasto (opcional).
- `valor_gasto` (Number)
- *Regra*: Dias em que o gasto superar o limite diário continuarão registrando o valor excedente para aquele dia, sem subtrair ou alterar o limite diário previsto dos dias seguintes.

**Tabela: `Compras_Parceladas`** (Referenciada na UI como "Cartão de Crédito")
- `id` (UUID)
- `nome_compra` (String)
- `valor_total` (Number)
- `num_parcelas` (Number)
- `valor_parcela` (Number)
- `mes_ano_inicio` (String): Formato YYYY-MM.

**Tabela: `Configuracoes`**
- `limite_mensal_parcelas` (Number): Limite global estipulado pelo usuário para comprometer com parcelas por mês.

**Tabela: `Entradas`**
- `id` (UUID)
- `descricao` (String): Descrição da entrada (ex: Salário, Freelance).
- `valor_previsto_base` (Number): Valor indicado como projetado base.
- `projetar` (Boolean): Se a entrada será projetada mensalmente.
- `mes_ano_fim` (String): Formato YYYY-MM. Até que mês deve projetar (opcional).
- `data_entrada` (String): Formato YYYY-MM-DD. Data da entrada pontual ou início da projeção.
- `ativo` (Boolean): Se o registro de entrada base está ativo.

**Tabela: `Registros_Entradas`**
- `id_registro` (UUID)
- `id_entrada` (UUID REFERENCES Entradas)
- `mes_ano` (String): Formato YYYY-MM.
- `valor_real` (Number): Valor efetivamente recebido no mês.

**Tabela: `Observacoes`**
- `id` (UUID): Identificador único.
- `titulo` (String): Título da anotação.
- `conteudo` (String): Conteúdo em texto.
- `created_at` (String): Data de criação.
- `updated_at` (String): Data de última atualização.

