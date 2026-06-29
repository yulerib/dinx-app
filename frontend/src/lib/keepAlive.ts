import { supabase } from './supabase';

/**
 * Executa uma query leve no Supabase para manter o projeto ativo.
 * O Supabase pausa projetos gratuitos após 7 dias de inatividade.
 * Esta função é chamada silenciosamente ao iniciar o app.
 */
export async function pingSupabase(): Promise<void> {
  try {
    // Query mínima: busca apenas 1 linha de uma tabela pequena
    const { error } = await supabase
      .from('Configuracoes')
      .select('limite_mensal_parcelas')
      .limit(1)
      .maybeSingle();

    if (error) {
      // Erro silencioso — não interrompe o app
      console.debug('[keep-alive] ping falhou:', error.message);
    } else {
      console.debug('[keep-alive] ping ok —', new Date().toLocaleString('pt-BR'));
    }
  } catch {
    // Falha de rede — ignora silenciosamente
    console.debug('[keep-alive] ping ignorado (sem conexão)');
  }
}
