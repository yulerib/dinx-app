import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Faltam credenciais no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Buscando categorias...');
  const { data, error } = await supabase.from('categorias_diarias').select('*');
  console.log('Error:', error);
  console.log('Categorias:', data);
  
  console.log('\nTentando inserir uma de teste...');
  const { data: insertData, error: insertError } = await supabase.from('categorias_diarias').insert([{ nome: 'Teste Script', limite_mensal: 500 }]).select();
  console.log('Insert Error:', insertError);
  console.log('Inserted:', insertData);
}

test();
