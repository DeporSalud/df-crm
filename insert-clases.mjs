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

const classesToInsert = [
  // MÓSTOLES - LUNES
  { sede: "mostoles", dia_semana: "LUNES", hora_inicio: "17:00", hora_fin: "18:00", profesor: "ANDREA SOTO", nombre_clase: "COMERCIAL JUNIOR INI.", aforo_maximo: 15 },
  { sede: "mostoles", dia_semana: "LUNES", hora_inicio: "18:00", hora_fin: "19:00", profesor: "ANDREA SOTO", nombre_clase: "COMERCIAL JUNIOR PRO", aforo_maximo: 15 },
  { sede: "mostoles", dia_semana: "LUNES", hora_inicio: "19:00", hora_fin: "20:00", profesor: "ANDREA SOTO", nombre_clase: "OPEN CLASS COMERCIAL", aforo_maximo: 20 },
  { sede: "mostoles", dia_semana: "LUNES", hora_inicio: "20:00", hora_fin: "21:00", profesor: "NIL BARBERÁ", nombre_clase: "OPEN CLASS COMERCIAL", aforo_maximo: 20 },
  { sede: "mostoles", dia_semana: "LUNES", hora_inicio: "21:00", hora_fin: "22:00", profesor: "NIL BARBERÁ", nombre_clase: "COMERCIAL PRO", aforo_maximo: 18 },
  
  // MÓSTOLES - MARTES
  { sede: "mostoles", dia_semana: "MARTES", hora_inicio: "17:30", hora_fin: "18:30", profesor: "DARIO HUMBERTO", nombre_clase: "URBAN PRO", aforo_maximo: 18 },
  { sede: "mostoles", dia_semana: "MARTES", hora_inicio: "18:30", hora_fin: "19:30", profesor: "DARIO HUMBERTO", nombre_clase: "URBAN INI.", aforo_maximo: 18 },
  { sede: "mostoles", dia_semana: "MARTES", hora_inicio: "19:30", hora_fin: "20:45", profesor: "NEREA OLIVARES", nombre_clase: "OPEN CLASS HEELS", aforo_maximo: 20 },
  
  // MÓSTOLES - MIÉRCOLES
  { sede: "mostoles", dia_semana: "MIÉRCOLES", hora_inicio: "17:00", hora_fin: "18:00", profesor: "ANDREA SOTO", nombre_clase: "COMERCIAL JUNIOR INI.", aforo_maximo: 15 },
  { sede: "mostoles", dia_semana: "MIÉRCOLES", hora_inicio: "18:00", hora_fin: "19:00", profesor: "ANDREA SOTO", nombre_clase: "COMERCIAL JUNIOR PRO", aforo_maximo: 15 },
  { sede: "mostoles", dia_semana: "MIÉRCOLES", hora_inicio: "19:00", hora_fin: "20:00", profesor: "ALEJANDRO ROVINA", nombre_clase: "OPEN CLASS URBAN", aforo_maximo: 20 },
  { sede: "mostoles", dia_semana: "MIÉRCOLES", hora_inicio: "20:00", hora_fin: "21:00", profesor: "MARIO GADEA", nombre_clase: "OPEN CLASS COMERCIAL", aforo_maximo: 20 },
  { sede: "mostoles", dia_semana: "MIÉRCOLES", hora_inicio: "21:00", hora_fin: "22:00", profesor: "MARIO GADEA", nombre_clase: "COMERCIAL PRO", aforo_maximo: 18 },
  
  // MÓSTOLES - JUEVES
  { sede: "mostoles", dia_semana: "JUEVES", hora_inicio: "17:30", hora_fin: "18:30", profesor: "DARIO HUMBERTO", nombre_clase: "URBAN PRO", aforo_maximo: 18 },
  { sede: "mostoles", dia_semana: "JUEVES", hora_inicio: "19:00", hora_fin: "20:30", profesor: "FALTA PROFESOR", nombre_clase: "DANCEHALL ADULTOS", aforo_maximo: 18 },
  { sede: "mostoles", dia_semana: "JUEVES", hora_inicio: "20:30", hora_fin: "21:45", profesor: "ROTATIVO", nombre_clase: "FORMACIÓN ROTATIVA", aforo_maximo: 20 },

  // MÓSTOLES - VIERNES
  { sede: "mostoles", dia_semana: "VIERNES", hora_inicio: "17:30", hora_fin: "19:00", profesor: "ANDREA SOTO", nombre_clase: "COMERCIAL YOUTH PRO", aforo_maximo: 15 },
  { sede: "mostoles", dia_semana: "VIERNES", hora_inicio: "19:00", hora_fin: "21:00", profesor: "ANDREA SOTO", nombre_clase: "COMPETICION WILDNESS CREW JUNIOR", aforo_maximo: 20 },


  // ALCORCÓN - LUNES
  { sede: "alcorcon", dia_semana: "LUNES", hora_inicio: "17:30", hora_fin: "18:30", profesor: "LUCIA ZAMORANO", nombre_clase: "URBAN INFANTIL", aforo_maximo: 15 },
  { sede: "alcorcon", dia_semana: "LUNES", hora_inicio: "18:00", hora_fin: "19:00", profesor: "LUCIA MUÑOZ", nombre_clase: "COMERCIAL KIDS INT.", aforo_maximo: 15 },
  { sede: "alcorcon", dia_semana: "LUNES", hora_inicio: "18:30", hora_fin: "19:30", profesor: "LUCIA ZAMORANO", nombre_clase: "URBAN KIDS PRO", aforo_maximo: 15 },

  // ALCORCÓN - MARTES
  { sede: "alcorcon", dia_semana: "MARTES", hora_inicio: "17:00", hora_fin: "18:00", profesor: "EVA LEIVA", nombre_clase: "URBAN BABY I", aforo_maximo: 12 },
  { sede: "alcorcon", dia_semana: "MARTES", hora_inicio: "18:00", hora_fin: "19:00", profesor: "LUCIA ZAMORANO", nombre_clase: "URBAN BABY II", aforo_maximo: 12 },
  { sede: "alcorcon", dia_semana: "MARTES", hora_inicio: "19:00", hora_fin: "20:00", profesor: "LUCAS LÓPEZ", nombre_clase: "COMERCIAL KIDS INT.", aforo_maximo: 15 },
  { sede: "alcorcon", dia_semana: "MARTES", hora_inicio: "20:00", hora_fin: "21:00", profesor: "ABEL Y NAYARA", nombre_clase: "BACHATA", aforo_maximo: 20 },
  { sede: "alcorcon", dia_semana: "MARTES", hora_inicio: "21:00", hora_fin: "22:00", profesor: "ABEL Y NAYARA", nombre_clase: "SALSA", aforo_maximo: 20 },

  // ALCORCÓN - MIÉRCOLES
  { sede: "alcorcon", dia_semana: "MIÉRCOLES", hora_inicio: "17:30", hora_fin: "18:30", profesor: "LUCIA ZAMORANO", nombre_clase: "URBAN INFANTIL", aforo_maximo: 15 },
  { sede: "alcorcon", dia_semana: "MIÉRCOLES", hora_inicio: "18:00", hora_fin: "19:00", profesor: "LUCIA MUÑOZ", nombre_clase: "COMERCIAL KIDS INT.", aforo_maximo: 15 },
  { sede: "alcorcon", dia_semana: "MIÉRCOLES", hora_inicio: "18:30", hora_fin: "19:30", profesor: "LUCIA ZAMORANO", nombre_clase: "URBAN KIDS PRO", aforo_maximo: 15 },

  // ALCORCÓN - JUEVES
  { sede: "alcorcon", dia_semana: "JUEVES", hora_inicio: "17:00", hora_fin: "18:00", profesor: "EVA LEIVA", nombre_clase: "URBAN BABY I", aforo_maximo: 12 },
  { sede: "alcorcon", dia_semana: "JUEVES", hora_inicio: "18:00", hora_fin: "19:00", profesor: "PAULA JIMÉNEZ", nombre_clase: "URBAN BABY II", aforo_maximo: 12 },
  { sede: "alcorcon", dia_semana: "JUEVES", hora_inicio: "19:00", hora_fin: "20:00", profesor: "LUCAS LÓPEZ", nombre_clase: "COMERCIAL KIDS INT.", aforo_maximo: 15 },

  // ALCORCÓN - VIERNES
  { sede: "alcorcon", dia_semana: "VIERNES", hora_inicio: "17:15", hora_fin: "18:45", profesor: "LUCÍA MUÑOZ", nombre_clase: "COMERCIAL JUNIOR INI.", aforo_maximo: 15 },
  { sede: "alcorcon", dia_semana: "VIERNES", hora_inicio: "18:45", hora_fin: "20:15", profesor: "LUCÍA MUÑOZ", nombre_clase: "COMERCIAL JUNIOR INI./INT.", aforo_maximo: 15 },
];

async function run() {
  console.log("Limpiando todas las clases existentes...");
  await supabase.from('clases_cuadrante').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log("Insertando", classesToInsert.length, "clases en la base de datos...");
  const { data, error } = await supabase.from('clases_cuadrante').insert(classesToInsert).select();

  if (error) {
    console.error("Error al insertar clases:", error);
  } else {
    console.log("Clases insertadas con éxito:", data.length);
  }
}

run();
