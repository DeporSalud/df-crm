import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Añadiendo columna 'sede' a tabla alumnos...");
  // Truco: como no podemos ejecutar DDL fácilmente sin admin desde supabase-js (a menos que estemos usando query sql directa)
  // Pero wait, supabase.rpc() podría servir, pero no tenemos rpc para ejecutar DDL de normal.
  // La mejor forma es decirle al usuario que la añada, o como tenemos RLS desactivado, puede que no podamos alterar la tabla desde el JS.
}
run();
