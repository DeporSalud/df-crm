import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  let query = supabase.from("alumnos").select("*");
  // Simulating activeSede = "mostoles"
  query = query.eq("sede", "mostoles");
  query = query.order("creado_en", { ascending: false });
  
  const { data, error } = await query;
  
  if (error) {
    console.error("SUPABASE ERROR:", error);
  } else {
    console.log("SUCCESS, data count:", data.length);
  }
}
run();
