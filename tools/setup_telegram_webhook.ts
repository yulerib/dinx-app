const botToken = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const functionName = 'telegram-webhook';

if (!botToken || !supabaseUrl) {
    console.error('ERRO: TELEGRAM_BOT_TOKEN ou VITE_SUPABASE_URL ausentes no .env');
    process.exit(1);
}

const webhookUrl = `${supabaseUrl}/functions/v1/${functionName}`;
const telegramApiUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;

console.log(`Configurando Webhook do Telegram para: ${webhookUrl}...`);

async function setupWebhook() {
    try {
        const response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: webhookUrl,
                allowed_updates: ['message', 'callback_query']
            }),
        });

        const data = await response.json();

        if (data.ok) {
            console.log('✅ Webhook configurado com sucesso!');
            console.log('Resposta do Telegram:', data.description);
        } else {
            console.error('❌ Falha ao configurar webhook:', data.description);
        }
    } catch (error) {
        console.error('❌ Erro na requisição:', error);
    }
}

setupWebhook();
