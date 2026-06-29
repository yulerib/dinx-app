import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log("Starting Webhook with Function Calling and Memory...");

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `
Você é o assistente financeiro pessoal do 'APP FINANCEIRO CASA'.
Seu objetivo é gerenciar os gastos do usuário com precisão.

REGRAS CRÍTICAS:
1. NUNCA invente ou adivinhe categorias. Se o usuário mandar registrar um gasto diário e não disser a categoria exata (ou se você não souber o ID da categoria), USE SEMPRE a ferramenta 'listar_categorias_diarias' para consultar e então pergunte ao usuário em qual delas registrar, ou infira se for óbvio (ex: 'gasolina' -> 'Transporte'). Mas você DEVE saber o ID real antes de chamar adicionar_gasto_diario.
2. Seja objetivo e profissional.
3. A data atual é ${new Date().toISOString().split('T')[0]}. Use esta data como referência para "hoje".

Você tem ferramentas para ler e escrever no banco de dados. Use-as!
`;

const geminiTools = [
  {
    functionDeclarations: [
      {
        name: "listar_categorias_diarias",
        description: "Retorna a lista de todas as categorias de gastos diários e seus respectivos IDs. Use isso para descobrir o ID correto antes de inserir um gasto.",
        parameters: { type: "OBJECT", properties: {} }
      },
      {
        name: "adicionar_gasto_diario",
        description: "Registra um novo gasto diário no banco de dados.",
        parameters: {
          type: "OBJECT",
          properties: {
            id_categoria: { type: "STRING", description: "O ID exato da categoria (buscado via listar_categorias_diarias)" },
            valor: { type: "NUMBER", description: "O valor do gasto" },
            descricao: { type: "STRING", description: "O que foi comprado/gasto" },
            data: { type: "STRING", description: "Data no formato YYYY-MM-DD" }
          },
          required: ["id_categoria", "valor", "descricao", "data"]
        }
      },
      {
        name: "pincar_dados_categoria_mes",
        description: "Busca os limites e todos os registros de uma categoria num mês específico, para você calcular saldos, dias zerados, etc.",
        parameters: {
          type: "OBJECT",
          properties: {
            id_categoria: { type: "STRING" },
            mes_ano: { type: "STRING", description: "Formato YYYY-MM" }
          },
          required: ["id_categoria", "mes_ano"]
        }
      }
    ]
  }
];

async function executeTool(name: string, args: any): Promise<any> {
  console.log(`Executing tool: ${name}`, args);
  try {
    if (name === "listar_categorias_diarias") {
      const { data, error } = await supabase.from('categorias_diarias').select('id, nome, limite_mensal');
      if (error) throw error;
      return { categorias: data };
    }
    
    if (name === "adicionar_gasto_diario") {
      const { data, error } = await supabase.from('registros_diarios').insert([{
        id_categoria: args.id_categoria,
        valor_gasto: args.valor,
        descricao: args.descricao,
        data: args.data
      }]).select();
      if (error) throw error;
      return { sucesso: true, registro: data[0] };
    }

    if (name === "pincar_dados_categoria_mes") {
      const { data: catData, error: catErr } = await supabase.from('categorias_diarias').select('*').eq('id', args.id_categoria).single();
      if (catErr) throw catErr;
      
      const startOfMonth = `${args.mes_ano}-01`;
      const endOfMonth = `${args.mes_ano}-31`; 
      
      const { data: gastosData, error: gastosErr } = await supabase
        .from('registros_diarios')
        .select('data, valor_gasto, descricao')
        .eq('id_categoria', args.id_categoria)
        .gte('data', startOfMonth)
        .lte('data', endOfMonth);
        
      if (gastosErr) throw gastosErr;
      
      return { 
        categoria: catData.nome, 
        limite_mensal: catData.limite_mensal, 
        gastos_registrados: gastosData 
      };
    }

    return { error: "Ferramenta não encontrada" };
  } catch (err: any) {
    console.error("Error in executeTool:", err);
    return { error: err.message || "Erro interno" };
  }
}

async function callGeminiMultiTurn(initialContents: any[]) {
  let currentContents = [...initialContents];
  let aiResponseText = "Não consegui formular uma resposta.";
  
  // Limite de turnos para evitar loop infinito
  for (let i = 0; i < 5; i++) {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: currentContents,
        tools: geminiTools
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return { text: "Erro na IA.", contents: currentContents };
    }

    const candidate = data.candidates[0];
    const parts = candidate.content.parts;
    
    // Adiciona a resposta da IA no histórico
    currentContents.push(candidate.content);

    const functionCallPart = parts.find((p: any) => p.functionCall);
    
    if (functionCallPart) {
      const call = functionCallPart.functionCall;
      // Executa a função
      const result = await executeTool(call.name, call.args);
      
      // Devolve o resultado para a IA continuar pensando
      currentContents.push({
        role: "user",
        parts: [{
          functionResponse: {
            name: call.name,
            response: { result }
          }
        }]
      });
      // Volta para o topo do loop para chamar a IA de novo com o resultado
    } else {
      // Se não tem functionCall, é a resposta final em texto
      const textPart = parts.find((p: any) => p.text);
      if (textPart) {
          aiResponseText = textPart.text;
      }
      break; // Sai do loop multi-turn
    }
  }
  return { text: aiResponseText, contents: currentContents };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response("Ok", { status: 200 });

  try {
    const body = await req.json();
    const message = body.message;
    if (!message) return new Response("Ignored", { status: 200 });

    const chatId = message.chat.id;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    
    // Validação de Whitelist de Segurança do Telegram (Bloqueio de acessos não autorizados)
    const allowedChatsRaw = Deno.env.get("ALLOWED_TELEGRAM_CHATS") || "";
    const allowedChats = allowedChatsRaw.split(",").map(id => id.trim()).filter(Boolean);
    
    if (allowedChats.length > 0 && !allowedChats.includes(String(chatId))) {
      console.warn(`Tentativa de acesso não autorizada no Telegram. Chat ID: ${chatId}`);
      if (botToken) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: "🔒 Acesso não autorizado. Este assistente financeiro pessoal é de uso privado." })
          });
        } catch (sendErr) {
          console.error("Erro ao enviar mensagem de restrição no Telegram:", sendErr);
        }
      }
      return new Response("Unauthorized", { status: 200 }); // Retorna 200 para evitar que o Telegram faça retentativas
    }
    
    let initialParts = [];

    if (message.text) {
      initialParts.push({ text: message.text });
    } else if (message.voice) {
      const fileId = message.voice.file_id;
      const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json();
      const filePath = fileData.result.file_path;
      
      const audioUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
      const audioRes = await fetch(audioUrl);
      const audioBlob = await audioRes.blob();
      
      const buffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.byteLength; i++) {
        binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64Audio = btoa(binaryString);
      
      initialParts.push({ inlineData: { mimeType: "audio/ogg", data: base64Audio } });
      initialParts.push({ text: "Analise este áudio e execute as ações necessárias." });
    } else {
      initialParts.push({ text: "Formato não suportado." });
    }

    // 1. Carrega o contexto (memória)
    let contents = [];
    const { data: session } = await supabase.from('bot_sessions').select('context').eq('chat_id', chatId).single();
    if (session && session.context && Array.isArray(session.context)) {
        contents = session.context;
    }
    
    // Adiciona a nova mensagem do usuário
    contents.push({ role: "user", parts: initialParts });

    // 2. Chama o Gemini
    const result = await callGeminiMultiTurn(contents);
    const aiResponseText = result.text;
    const finalContents = result.contents;

    // 3. Salva o contexto atualizado (Mantém as últimas 20 interações para economizar tokens)
    const contextToSave = finalContents.slice(-20);
    await supabase.from('bot_sessions').upsert({
        chat_id: chatId,
        context: contextToSave,
        updated_at: new Date().toISOString()
    });

    if (botToken && aiResponseText) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: aiResponseText })
      });
    }

    return new Response("Ok", { status: 200 });
  } catch (error) {
    console.error("Internal Error:", error);
    return new Response("Error", { status: 500 });
  }
});
