import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { FunctionDeclaration } from "@google/generative-ai";
import { gastosFixosService } from "./gastosFixos";
import { gastosDiariosService } from "./gastosDiarios";
import { parcelasService } from "./parcelas";
import { entradasService } from "./entradas";

// Cache em memória da chave para evitar requisições repetidas ao Supabase
let cachedDbApiKey: string | null = null;

export async function getGeminiApiKey(): Promise<string> {
  // 1. Variável de ambiente (Desenvolvimento / Build time)
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey) return envKey;

  // 2. Cache em memória (Performance)
  if (cachedDbApiKey) return cachedDbApiKey;

  // 3. Banco de Dados (Supabase - Configuração Dinâmica Compartilhada)
  try {
    const config = await parcelasService.fetchConfiguracao();
    if (config && config.gemini_api_key) {
      cachedDbApiKey = config.gemini_api_key;
      return config.gemini_api_key;
    }
  } catch (err) {
    console.warn("Erro ao buscar a chave do Gemini no Supabase:", err);
  }

  // 4. LocalStorage (Configuração específica do dispositivo)
  return localStorage.getItem('VITE_GEMINI_API_KEY') || '';
}

export async function saveGeminiApiKey(key: string): Promise<void> {
  const cleanKey = key.trim();
  if (!cleanKey) return;

  // Salva localmente
  localStorage.setItem('VITE_GEMINI_API_KEY', cleanKey);
  cachedDbApiKey = cleanKey;

  // Sincroniza com o Supabase para funcionar em todos os outros aparelhos
  try {
    await parcelasService.updateGeminiApiKey(cleanKey);
  } catch (err) {
    console.warn("Erro ao sincronizar chave com o Supabase:", err);
  }
}

// Cascata de modelos: tenta do mais capaz ao mais leve
const MODEL_CASCADE = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

export const SYSTEM_PROMPT = `Você é o assistente financeiro pessoal de uma família, integrado diretamente ao app de finanças deles.

PERSONALIDADE:
- Seja simpático, descontraído e direto. Fale como um amigo que entende bem de finanças.
- Use linguagem simples e informal. Nada de termos técnicos.
- Seja encorajador quando o saldo estiver bom, e cuidadoso (mas sem drama) quando estiver no limite.

REGRAS INEGOCIÁVEIS:
1. NUNCA mencione IDs, códigos técnicos, nomes de tabelas ou qualquer coisa do banco de dados. Use apenas os NOMES das coisas (ex: "Uber", "Mercado", "Energia").
2. Quando uma tarefa precisar de informações que o usuário não deu, pergunte TUDO de uma vez só numa mensagem. Não faça perguntas em sequência.
3. Antes de executar qualquer ação destrutiva (deletar algo), confirme com o usuário.
4. Sempre responda em português brasileiro.
5. Use emojis com moderação para deixar as mensagens mais amigáveis.
6. Quando confirmar uma ação realizada, mostre um resumo do impacto (ex: "Pronto! Lancei R$ 50 no Uber. Seu saldo diário de transporte agora é de R$ X").
7. Para análises e cálculos, seja preciso e mostre os números claramente.
8. Quando não tiver uma informação necessária no contexto recebido, use a ferramenta de consulta de histórico antes de responder — NUNCA invente dados.`;

// --- FERRAMENTAS (FUNCTION DECLARATIONS) ---
export const aiTools: FunctionDeclaration[] = [
  // Gastos Fixos
  {
    name: "adicionarGastoFixo",
    description: "Cria uma nova conta ou despesa fixa no painel.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        nome: { type: SchemaType.STRING, description: "Nome da despesa fixa (ex: Aluguel)" },
        valor_previsto: { type: SchemaType.NUMBER, description: "Valor previsto da despesa" },
        dia_pagamento_previsto: { type: SchemaType.NUMBER, description: "Dia projetado para o pagamento (1-31). Padrão é 10." }
      },
      required: ["nome", "valor_previsto"]
    }
  },
  {
    name: "editarGastoFixo",
    description: "Altera o nome e/ou valor previsto de uma conta fixa já existente.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da conta fixa" },
        nome: { type: SchemaType.STRING, description: "Novo nome" },
        valor_previsto: { type: SchemaType.NUMBER, description: "Novo valor previsto" },
        dia_pagamento_previsto: { type: SchemaType.NUMBER, description: "Novo dia de pagamento projetado (1-31)" },
        ativo: { type: SchemaType.BOOLEAN, description: "Se está ativa (use true)" }
      },
      required: ["id", "nome", "valor_previsto", "ativo"]
    }
  },
  {
    name: "apagarGastoFixo",
    description: "Remove uma conta fixa do painel permanentemente.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da conta fixa" }
      },
      required: ["id"]
    }
  },
  {
    name: "pagarGastoFixo",
    description: "Registra o pagamento real de uma conta fixa num determinado mês.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da conta fixa" },
        mes_ano: { type: SchemaType.STRING, description: "Mês e ano no formato YYYY-MM" },
        valor_real: { type: SchemaType.NUMBER, description: "Valor efetivamente pago" }
      },
      required: ["id", "mes_ano", "valor_real"]
    }
  },

  // Categorias Diárias
  {
    name: "adicionarCategoriaDiaria",
    description: "Cria uma nova categoria de gastos diários (ex: Lazer, Farmácia, Mercado).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        nome: { type: SchemaType.STRING, description: "Nome da categoria" },
        limite_mensal: { type: SchemaType.NUMBER, description: "Limite de gasto para o mês inteiro" }
      },
      required: ["nome", "limite_mensal"]
    }
  },
  {
    name: "editarCategoriaDiaria",
    description: "Altera o nome e/ou o limite mensal de uma categoria de gastos diários.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da categoria" },
        nome: { type: SchemaType.STRING, description: "Novo nome" },
        limite_mensal: { type: SchemaType.NUMBER, description: "Novo limite mensal" }
      },
      required: ["id", "nome", "limite_mensal"]
    }
  },
  {
    name: "apagarCategoriaDiaria",
    description: "Remove uma categoria de gastos diários e todo o seu histórico.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da categoria" }
      },
      required: ["id"]
    }
  },
  {
    name: "lancarGastoDiario",
    description: "Insere uma compra ou gasto num dia específico dentro de uma categoria.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id_categoria: { type: SchemaType.STRING, description: "ID da categoria" },
        data: { type: SchemaType.STRING, description: "Data no formato YYYY-MM-DD" },
        valor: { type: SchemaType.NUMBER, description: "Valor gasto" },
        descricao: { type: SchemaType.STRING, description: "Uma descrição curta do gasto (ex: 'iFood - Pizza')" }
      },
      required: ["id_categoria", "data", "valor", "descricao"]
    }
  },
  {
    name: "zerarCategoriaDiaria",
    description: "Marca um dia como zerado (sem gastos) para uma categoria.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id_categoria: { type: SchemaType.STRING, description: "ID da categoria" },
        data: { type: SchemaType.STRING, description: "Data no formato YYYY-MM-DD" }
      },
      required: ["id_categoria", "data"]
    }
  },

  // Parcelas e Configuração Global
  {
    name: "adicionarParcela",
    description: "Cadastra uma nova compra parcelada (cartão de crédito, carnê, etc.).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        nome_compra: { type: SchemaType.STRING, description: "Nome do que foi comprado" },
        valor_total: { type: SchemaType.NUMBER, description: "Valor total da compra" },
        num_parcelas: { type: SchemaType.NUMBER, description: "Número de parcelas" },
        valor_parcela: { type: SchemaType.NUMBER, description: "Valor de cada parcela" },
        mes_ano_inicio: { type: SchemaType.STRING, description: "Mês da primeira parcela (YYYY-MM)" }
      },
      required: ["nome_compra", "valor_total", "num_parcelas", "valor_parcela", "mes_ano_inicio"]
    }
  },
  {
    name: "editarParcela",
    description: "Edita os dados de uma compra parcelada existente.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da parcela" },
        nome_compra: { type: SchemaType.STRING, description: "Nome do produto" },
        valor_total: { type: SchemaType.NUMBER, description: "Valor total" },
        num_parcelas: { type: SchemaType.NUMBER, description: "Total de parcelas" },
        valor_parcela: { type: SchemaType.NUMBER, description: "Valor mensal" },
        mes_ano_inicio: { type: SchemaType.STRING, description: "Início das parcelas YYYY-MM" }
      },
      required: ["id", "nome_compra", "valor_total", "num_parcelas", "valor_parcela", "mes_ano_inicio"]
    }
  },
  {
    name: "apagarParcela",
    description: "Remove uma compra parcelada do sistema.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da parcela" }
      },
      required: ["id"]
    }
  },
  {
    name: "atualizarLimiteParcelas",
    description: "Altera o limite mensal global de comprometimento com parcelas.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        novo_limite: { type: SchemaType.NUMBER, description: "Novo valor do limite em reais" }
      },
      required: ["novo_limite"]
    }
  },

  // Ferramentas de Leitura (Lazy Loading — só usa quando precisa de histórico)
  {
    name: "consultarHistoricoDiario",
    description: "Busca o histórico completo de compras de uma (ou todas as) categoria diária para responder perguntas analíticas sobre o passado.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id_categoria: { type: SchemaType.STRING, description: "ID da categoria. Omita para buscar de todas." }
      }
    }
  },
  {
    name: "consultarFaturasPassadas",
    description: "Busca todas as compras parceladas cadastradas para análise histórica.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {}
    }
  },
  
  // Entradas (Incomes)
  {
    name: "adicionarEntrada",
    description: "Cadastra uma nova entrada de receita pontual ou recorrente (freelance, aluguel recebido, etc.). Não use para salário — o salário tem gestão própria no app.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        descricao: { type: SchemaType.STRING, description: "Descrição ou nome da receita (ex: 'Freelance', 'Aluguel recebido')" },
        valor_previsto_base: { type: SchemaType.NUMBER, description: "Valor previsto base" },
        projetar: { type: SchemaType.BOOLEAN, description: "Se a receita se repetirá mensalmente (true) ou se é pontual/única (false)" },
        data_entrada: { type: SchemaType.STRING, description: "Data de recebimento ou início da recorrência no formato YYYY-MM-DD" },
        mes_ano_fim: { type: SchemaType.STRING, description: "Mês final de recorrência no formato YYYY-MM (opcional, só se projetar=true)" }
      },
      required: ["descricao", "valor_previsto_base", "projetar", "data_entrada"]
    }
  },
  {
    name: "editarEntrada",
    description: "Modifica uma receita cadastrada.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da receita" },
        descricao: { type: SchemaType.STRING, description: "Nova descrição (opcional)" },
        valor_previsto_base: { type: SchemaType.NUMBER, description: "Novo valor previsto base (opcional)" },
        projetar: { type: SchemaType.BOOLEAN, description: "Nova configuração de projeção (opcional)" },
        data_entrada: { type: SchemaType.STRING, description: "Nova data de recebimento/início (YYYY-MM-DD) (opcional)" },
        mes_ano_fim: { type: SchemaType.STRING, description: "Novo mês final (YYYY-MM) (opcional/pode ser null)" },
        ativo: { type: SchemaType.BOOLEAN, description: "Status ativo/inativo (opcional)" }
      },
      required: ["id"]
    }
  },
  {
    name: "apagarEntrada",
    description: "Remove permanentemente uma receita cadastrada.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da receita" }
      },
      required: ["id"]
    }
  },
  {
    name: "receberEntrada",
    description: "Registra o valor real de receita efetivamente recebido em um mês específico.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id_entrada: { type: SchemaType.STRING, description: "ID da receita" },
        mes_ano: { type: SchemaType.STRING, description: "Mês e ano no formato YYYY-MM" },
        valor_real: { type: SchemaType.NUMBER, description: "Valor real recebido" }
      },
      required: ["id_entrada", "mes_ano", "valor_real"]
    }
  },
  {
    name: "consultarEntradasMensais",
    description: "Busca as receitas previstas e reais de um mês específico para responder perguntas analíticas sobre o histórico de entradas.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        mes_ano: { type: SchemaType.STRING, description: "Mês e ano no formato YYYY-MM" }
      },
      required: ["mes_ano"]
    }
  }
];

// --- EXECUÇÃO DE FERRAMENTAS ---
export async function executeAiTool(name: string, args: any) {
  try {
    switch (name) {
      case "adicionarGastoFixo": return await gastosFixosService.addGastoFixo(args.nome, args.valor_previsto, args.dia_pagamento_previsto || 10);
      case "editarGastoFixo": return await gastosFixosService.updateGastoFixo(args.id, args.nome, args.valor_previsto, args.dia_pagamento_previsto || 10);
      case "apagarGastoFixo": await gastosFixosService.deleteGastoFixo(args.id); return { success: true };
      case "pagarGastoFixo": return await gastosFixosService.upsertRegistro(args.id, args.mes_ano, args.valor_real);
      case "adicionarCategoriaDiaria": return await gastosDiariosService.addCategoria(args.nome, args.limite_mensal);
      case "editarCategoriaDiaria": return await gastosDiariosService.updateCategoria(args.id, args.nome, args.limite_mensal);
      case "apagarCategoriaDiaria": await gastosDiariosService.deleteCategoria(args.id); return { success: true };
      case "lancarGastoDiario": return await gastosDiariosService.addRegistroDiario(args.id_categoria, args.data, args.valor, args.descricao);
      case "zerarCategoriaDiaria": return await gastosDiariosService.addRegistroDiario(args.id_categoria, args.data, 0, "Zerado");
      case "adicionarParcela": return await parcelasService.addParcela(args.nome_compra, args.valor_total, args.num_parcelas, args.valor_parcela, args.mes_ano_inicio);
      case "editarParcela": await parcelasService.updateParcela(args.id, args.nome_compra, args.valor_total, args.num_parcelas, args.valor_parcela, args.mes_ano_inicio); return { success: true };
      case "apagarParcela": await parcelasService.deleteParcela(args.id); return { success: true };
      case "atualizarLimiteParcelas": await parcelasService.updateLimiteParcelas(args.novo_limite); return { success: true };
      case "consultarHistoricoDiario": {
        // Busca os últimos 12 meses de registros
        const results: any[] = [];
        const today = new Date();
        for (let i = 0; i < 12; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const mesAnoLoop = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const regs = await gastosDiariosService.fetchRegistrosDoMes(mesAnoLoop);
          results.push(...regs);
        }
        if (args.id_categoria) return results.filter((r: any) => r.id_categoria === args.id_categoria);
        return results;
      }
      case "consultarFaturasPassadas": return await parcelasService.fetchTodasParcelas();
      case "adicionarEntrada": return await entradasService.addEntrada({
        descricao: args.descricao,
        valor_previsto_base: args.valor_previsto_base,
        projetar: args.projetar,
        data_entrada: args.data_entrada,
        mes_ano_fim: args.mes_ano_fim || null
      });
      case "editarEntrada": {
        const { id, ...updates } = args;
        return await entradasService.updateEntrada(id, updates);
      }
      case "apagarEntrada": await entradasService.deleteEntrada(args.id); return { success: true };
      case "receberEntrada": return await entradasService.upsertRegistroEntrada(args.id_entrada, args.mes_ano, args.valor_real);
      case "consultarEntradasMensais": return await entradasService.fetchEntradasMensais(args.mes_ano);
      default: throw new Error(`Ferramenta "${name}" não encontrada.`);
    }
  } catch (err: any) {
    return { error: err.message || JSON.stringify(err) };
  }
}

// --- ENVIO DE MENSAGEM COM FALLBACK AUTOMÁTICO ---
export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export async function sendMessageWithFallback(
  history: ChatMessage[],
  userMessage: string,
  systemInstruction: string
): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error("Chave da API do Gemini não configurada.");

  const genAI = new GoogleGenerativeAI(apiKey);

  let lastError: any = null;

  for (const modelName of MODEL_CASCADE) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: [{ functionDeclarations: aiTools }],
      });

      const chat = model.startChat({ history });
      let result = await chat.sendMessage(userMessage);
      let response = result.response;

      // Loop de Function Calling
      let functionCalls = response.functionCalls();
      const toolResults: any[] = [];

      while (functionCalls && functionCalls.length > 0) {
        const functionResponses = [];
        for (const call of functionCalls) {
          const apiResponse = await executeAiTool(call.name, call.args);
          // Rastreia se houve mudança (para o chamador saber se deve recarregar dados)
          if (!call.name.startsWith('consultar')) {
            toolResults.push({ name: call.name, changed: true });
          }
          // O Gemini exige que a resposta da função seja um objeto JSON (Struct), não um array ou primitivo.
          // Se for array, null ou primitivo, envelopamos em um objeto { result: ... }
          const wrappedResponse = (apiResponse && typeof apiResponse === 'object' && !Array.isArray(apiResponse))
            ? apiResponse
            : { result: apiResponse };

          functionResponses.push({
            functionResponse: { name: call.name, response: wrappedResponse }
          });
        }
        const nextResult = await chat.sendMessage(functionResponses as any);
        response = nextResult.response;
        functionCalls = response.functionCalls();
      }

      // Armazena os resultados de tools como efeito colateral acessível ao chamador
      (sendMessageWithFallback as any)._lastToolResults = toolResults;
      return response.text();

    } catch (err: any) {
      lastError = err;
      const is429 = err.message?.includes('429') || err.status === 429;
      if (is429) {
        console.warn(`Modelo ${modelName} com quota esgotada. Tentando próximo...`);
        continue; // Tenta o próximo modelo da cascata
      }
      throw err; // Erros que não são de quota devem ser propagados imediatamente
    }
  }

  throw lastError || new Error("Todos os modelos disponíveis estão com quota esgotada. Tente novamente em alguns instantes.");
}

// Contexto Snapshot (enriquecido com gastos de hoje e do mês)
export async function getCurrentContextSnapshot(mesAno: string, dataIso: string) {
  const fixos = await gastosFixosService.fetchGastosMensais(mesAno);
  const config = await parcelasService.fetchConfiguracao();
  const cats = await gastosDiariosService.fetchCategoriasComRegistroDia(dataIso);
  const parcelas = await parcelasService.fetchTodasParcelas();
  const registrosMes = await gastosDiariosService.fetchRegistrosDoMes(mesAno);
  const entradas = await entradasService.fetchEntradasMensais(mesAno);

  // Agrupa gastos do mês por categoria
  const gastosMesPorCategoria: Record<string, number> = {};
  const gastosHojePorCategoria: Record<string, number> = {};
  for (const reg of registrosMes) {
    const catId = reg.id_categoria || 'pontual';
    gastosMesPorCategoria[catId] = (gastosMesPorCategoria[catId] || 0) + reg.valor_gasto;
    if (reg.data === dataIso) {
      gastosHojePorCategoria[catId] = (gastosHojePorCategoria[catId] || 0) + reg.valor_gasto;
    }
  }

  return JSON.stringify({
    info_temporal: {
      mes_ativo_na_tela: mesAno,
      data_hoje_real: new Date().toISOString().split('T')[0],
      data_selecionada_na_tela: dataIso
    },
    gastos_fixos_ativos: fixos.map((f: any) => ({
      id: f.id,
      nome: f.nome,
      valor_previsto: f.valor_previsto_base,
      ja_pago_neste_mes: !!f.registro_mes,
      valor_pago: f.registro_mes?.valor_real || 0
    })),
    configuracao_global: config,
    compras_parceladas: parcelas,
    entradas_do_mes: entradas.map((e: any) => ({
      id: e.id,
      descricao: e.descricao,
      valor_previsto: e.valor_previsto_base,
      projetar: e.projetar,
      data_entrada: e.data_entrada,
      mes_ano_fim: e.mes_ano_fim,
      ativo: e.ativo,
      valor_real: e.registro_atual?.valor_real || 0,
      recebido: !!e.registro_atual
    })),
    categorias_diarias: cats.map((c: any) => ({
      id: c.id,
      nome: c.nome,
      limite_mensal: c.limite_mensal,
      meta_diaria: parseFloat((c.limite_mensal / 31).toFixed(2)),
      gasto_hoje: parseFloat((gastosHojePorCategoria[c.id] || 0).toFixed(2)),
      saldo_hoje: parseFloat(((c.limite_mensal / 31) - (gastosHojePorCategoria[c.id] || 0)).toFixed(2)),
      gasto_mes_acumulado: parseFloat((gastosMesPorCategoria[c.id] || 0).toFixed(2)),
      saldo_mes: parseFloat((c.limite_mensal - (gastosMesPorCategoria[c.id] || 0)).toFixed(2))
    }))
  }, null, 2);
}
