import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const newStudent = {
    nombre_completo: "Alumno Prueba de IA",
    email: "ia@ejemplo.com",
    telefono: "600000000",
    plan_activo: "Bono 10 clases",
    clases_restantes: 10,
    estado: "Activo"
  };

  console.log("Intentando insertar alumno de prueba...");
  const { data, error } = await supabase.from('alumnos').insert([newStudent]).select();

  if (error) {
    console.error("Error al insertar alumno:", error);
  } else {
    console.log("Alumno insertado con éxito:", data);
  }
}

run();
