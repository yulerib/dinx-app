import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleGenerativeAI, SchemaType } from "npm:@google/generative-ai";

// Chaves de API que deverão ser configuradas no Supabase Secrets:
// GEMINI_API_KEY
// WHATSAPP_TOKEN
// WHATSAPP_VERIFY_TOKEN (Ex: minha_senha_secreta_whatsapp)

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// LÓGICA DO ASSISTENTE (FUNCTION CALLING)
// ==========================================
const SYSTEM_PROMPT = `Você é o assistente financeiro pessoal de uma família, interagindo pelo WhatsApp.

PERSONALIDADE:
- Seja simpático, descontraído e direto. Fale como um amigo que entende bem de finanças.
- Use linguagem simples e informal. Nada de termos técnicos.
- Seja encorajador quando o saldo estiver bom, e cuidadoso quando estiver no limite.

REGRAS INEGOCIÁVEIS:
1. NUNCA mencione IDs, códigos técnicos, nomes de tabelas ou qualquer coisa do banco de dados. Use apenas os NOMES das coisas (ex: "Uber", "Mercado", "Energia").
2. Quando uma tarefa precisar de informações que o usuário não deu, pergunte TUDO de uma vez só numa mensagem. Não faça perguntas em sequência.
3. Sempre responda em português brasileiro e de forma concisa, ideal para ler no celular.
4. Use emojis para deixar as mensagens mais amigáveis.
5. Quando confirmar uma ação realizada, mostre um resumo do impacto (ex: "Pronto! Lancei R$ 50 no Uber. Seu saldo de transporte agora é de R$ X").
6. Para análises, seja preciso e mostre os números claramente.
7. O usuário não tem interface gráfica aqui, então se quiser listar categorias, escreva os nomes.`;

const aiTools = [
  // Gastos Fixos
  {
    name: "adicionarGastoFixo",
    description: "Cria uma nova conta ou despesa fixa.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        nome: { type: SchemaType.STRING, description: "Nome da despesa fixa" },
        valor_previsto: { type: SchemaType.NUMBER, description: "Valor previsto" }
      },
      required: ["nome", "valor_previsto"]
    }
  },
  {
    name: "pagarGastoFixo",
    description: "Registra o pagamento real de uma conta fixa no mês atual.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "ID da conta fixa" },
        valor_real: { type: SchemaType.NUMBER, description: "Valor efetivamente pago" }
      },
      required: ["id", "valor_real"]
    }
  },
  // Categorias Diárias
  {
    name: "adicionarCategoriaDiaria",
    description: "Cria uma nova categoria de gastos diários.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        nome: { type: SchemaType.STRING, description: "Nome da categoria" },
        limite_mensal: { type: SchemaType.NUMBER, description: "Limite de gasto mensal" }
      },
      required: ["nome", "limite_mensal"]
    }
  },
  {
    name: "lancarGastoDiario",
    description: "Insere uma compra ou gasto diário numa categoria específica para hoje.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id_categoria: { type: SchemaType.STRING, description: "ID da categoria" },
        valor: { type: SchemaType.NUMBER, description: "Valor gasto" },
        descricao: { type: SchemaType.STRING, description: "Descrição curta (ex: 'Almoço')" }
      },
      required: ["id_categoria", "valor", "descricao"]
    }
  },
  // Parcelas
  {
    name: "adicionarParcela",
    description: "Cadastra uma nova compra parcelada.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        nome_compra: { type: SchemaType.STRING, description: "Nome da compra" },
        valor_total: { type: SchemaType.NUMBER, description: "Valor total da compra" },
        num_parcelas: { type: SchemaType.NUMBER, description: "Número de parcelas" },
        valor_parcela: { type: SchemaType.NUMBER, description: "Valor de cada parcela" }
      },
      required: ["nome_compra", "valor_total", "num_parcelas", "valor_parcela"]
    }
  }
];

async function executeTool(name: string, args: any) {
  const today = new Date();
  const mesAno = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const dataIso = today.toISOString().split('T')[0];

  try {
    switch (name) {
      case "adicionarGastoFixo": {
        const { data } = await supabase.from('gastos_fixos').insert([{ nome: args.nome, valor_previsto_base: args.valor_previsto }]).select().single();
        return data;
      }
      case "pagarGastoFixo": {
        const { data } = await supabase.from('registros_gastos_fixos').upsert({ id_gasto_fixo: args.id, mes_ano: mesAno, valor_real: args.valor_real }, { onConflict: 'id_gasto_fixo,mes_ano' }).select().single();
        return data;
      }
      case "adicionarCategoriaDiaria": {
        const { data } = await supabase.from('categorias_diarias').insert([{ nome: args.nome, limite_mensal: args.limite_mensal }]).select().single();
        return data;
      }
      case "lancarGastoDiario": {
        const { data } = await supabase.from('registros_diarios').insert([{ id_categoria: args.id_categoria, data: dataIso, valor_gasto: args.valor, descricao: args.descricao }]).select().single();
        return data;
      }
      case "adicionarParcela": {
        const { data } = await supabase.from('compras_parceladas').insert([{ 
          nome_compra: args.nome_compra, valor_total: args.valor_total, num_parcelas: args.num_parcelas, valor_parcela: args.valor_parcela, mes_ano_inicio: mesAno 
        }]).select().single();
        return data;
      }
      default:
        return { error: `Function ${name} not found` };
    }
  } catch (error: any) {
    return { error: error.message };
  }
}

async function getContextSnapshot() {
  const today = new Date();
  const mesAno = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const { data: fixos } = await supabase.from('gastos_fixos').select('*');
  const { data: cats } = await supabase.from('categorias_diarias').select('*');
  
  return JSON.stringify({
    data_hoje: today.toISOString().split('T')[0],
    mes_atual: mesAno,
    categorias_diarias: cats || [],
    gastos_fixos: fixos || []
  }, null, 2);
}

async function processAiMessage(userText: string, audioData?: { base64: string, mimeType: string }) {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("GEMINI_API_KEY não configurada.");
  
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // 1.5-flash suporta áudio nativamente
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: aiTools }],
  });

  const snapshot = await getContextSnapshot();
  const contextMessage = `Contexto Financeiro Atual:\n${snapshot}\n\nMensagem do Usuário: ${userText || "Usuário enviou um áudio. Transcreva e processe o comando adequadamente."}`;

  let contentParts: any[] = [{ text: contextMessage }];
  if (audioData) {
    contentParts.push({
      inlineData: {
        data: audioData.base64,
        mimeType: audioData.mimeType
      }
    });
  }

  const chat = model.startChat({ history: [] });
  let result = await chat.sendMessage(contentParts);
  let response = result.response;
  
  let functionCalls = response.functionCalls();
  
  while (functionCalls && functionCalls.length > 0) {
    const functionResponses = [];
    for (const call of functionCalls) {
      const apiResponse = await executeTool(call.name, call.args);
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

  return response.text();
}

// ==========================================
// INTEGRAÇÃO COM WHATSAPP
// ==========================================
async function downloadWhatsAppMedia(mediaId: string) {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  if (!token) throw new Error("O token do WhatsApp não foi configurado no servidor.");

  // 1. Obter a URL da mídia
  const urlRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}/`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!urlRes.ok) throw new Error("Erro ao obter metadados da mídia da Meta");
  const urlData = await urlRes.json();
  const mediaUrl = urlData.url;
  const mimeType = urlData.mime_type;

  // 2. Baixar o arquivo binário autenticado
  const mediaRes = await fetch(mediaUrl, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!mediaRes.ok) throw new Error("Erro ao baixar o arquivo binário da Meta");
  
  const arrayBuffer = await mediaRes.arrayBuffer();
  
  // Converter ArrayBuffer para Base64 usando uint8 loop
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return { base64, mimeType };
}

async function sendWhatsAppMessage(to: string, text: string) {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = "1132767353252080"; // Configurado via input do usuário

  if (!token) {
    console.error("ERRO CRÍTICO: WHATSAPP_TOKEN não encontrado nos secrets do Supabase.");
    throw new Error("O token do WhatsApp não foi configurado no servidor.");
  }

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text }
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("Erro na API do WhatsApp:", response.status, errorData);
    throw new Error(`WhatsApp API Error: ${errorData}`);
  } else {
    console.log("Mensagem enviada com sucesso para", to);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Verificação do Webhook pela Meta
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "casa2501"; // Default se não setado

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      } else {
        return new Response("Forbidden", { status: 403 });
      }
    }
    return new Response("OK", { status: 200 });
  }

  // 2. Recebimento de mensagens
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      
      // WhatsApp payload parsing
      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.value && change.value.messages && change.value.messages[0]) {
              const message = change.value.messages[0];
              const phoneFrom = message.from; // Número de quem enviou
              
              // Validação de Whitelist de Segurança (Restrição a apenas números cadastrados)
              const allowedPhonesRaw = Deno.env.get("ALLOWED_PHONES") || "";
              const allowedPhones = allowedPhonesRaw.split(",").map(p => p.trim()).filter(Boolean);
              
              if (allowedPhones.length > 0 && !allowedPhones.includes(phoneFrom)) {
                console.warn(`Tentativa de acesso não autorizada do número: ${phoneFrom}`);
                try {
                  await sendWhatsAppMessage(phoneFrom, "🔒 Acesso não autorizado. Este assistente financeiro pessoal é de uso privado.");
                } catch (sendErr) {
                  console.error("Erro ao enviar mensagem de restrição:", sendErr);
                }
                continue;
              }
              
              if (message.type === "text") {
                const userText = message.text.body;
                
                let aiResponseText = "";
                try {
                  aiResponseText = await processAiMessage(userText);
                } catch (err: any) {
                  aiResponseText = "⚠️ Ops, erro no cérebro do bot: " + err.message;
                }
                
                await sendWhatsAppMessage(phoneFrom, aiResponseText);
              } else if (message.type === "audio") {
                const mediaId = message.audio.id;
                
                let aiResponseText = "";
                try {
                  const audioData = await downloadWhatsAppMedia(mediaId);
                  aiResponseText = await processAiMessage("", audioData);
                } catch (err: any) {
                  aiResponseText = "⚠️ Ops, não consegui processar seu áudio: " + err.message;
                }
                
                await sendWhatsAppMessage(phoneFrom, aiResponseText);
              }
            }
          }
        }
      }
      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (error: any) {
      console.error(error);
      return new Response(error.message || "Internal Server Error", { status: 500 });
    }
  }

  return new Response("Not Found", { status: 404 });
});
