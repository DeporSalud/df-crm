import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  host: '2a05:d018:65a:e201:606d:5ffb:fb1c:3ed4',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'fKbUxbL9AcDbvs7s',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log("Conectado a la base de datos PostgreSQL.");

    const query = `
      -- 1. Tabla de Alumnos
      CREATE TABLE IF NOT EXISTS alumnos (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        nombre_completo TEXT NOT NULL,
        email TEXT,
        telefono TEXT NOT NULL,
        plan_activo TEXT,
        clases_restantes INTEGER DEFAULT 0,
        estado TEXT DEFAULT 'Activo',
        nfc_token TEXT UNIQUE,
        creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 2. Tabla de Clases / Cuadrante
      CREATE TABLE IF NOT EXISTS clases_cuadrante (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        sede TEXT NOT NULL,
        dia_semana TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fin TEXT NOT NULL,
        nombre_clase TEXT NOT NULL,
        profesor TEXT NOT NULL,
        aforo_maximo INTEGER NOT NULL
      );

      -- 3. Tabla de Asistencias (Check-ins)
      CREATE TABLE IF NOT EXISTS asistencias (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        alumno_id UUID REFERENCES alumnos(id) ON DELETE CASCADE,
        clase_id UUID REFERENCES clases_cuadrante(id) ON DELETE CASCADE,
        fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 4. Opcional: Insertar datos de prueba iniciales para no ver la tabla vacía
      -- Insertar algunas clases de ejemplo para Móstoles si la tabla está vacía
      INSERT INTO clases_cuadrante (sede, dia_semana, hora_inicio, hora_fin, nombre_clase, profesor, aforo_maximo)
      SELECT 'mostoles', 'LUNES', '17:00', '18:00', 'COMERCIAL JUNIOR INI.', 'ANDREA SOTO', 15
      WHERE NOT EXISTS (SELECT 1 FROM clases_cuadrante LIMIT 1);
      
      INSERT INTO clases_cuadrante (sede, dia_semana, hora_inicio, hora_fin, nombre_clase, profesor, aforo_maximo)
      SELECT 'mostoles', 'LUNES', '18:00', '19:00', 'COMERCIAL JUNIOR PRO', 'ANDREA SOTO', 15
      WHERE (SELECT count(*) FROM clases_cuadrante) = 1;

      -- Insertar alumnos de prueba
      INSERT INTO alumnos (nombre_completo, email, telefono, plan_activo, clases_restantes, estado)
      SELECT 'Sofía García', 'sofia@example.com', '600123456', 'Bono 10 clases', 8, 'Activo'
      WHERE NOT EXISTS (SELECT 1 FROM alumnos LIMIT 1);
      
      INSERT INTO alumnos (nombre_completo, email, telefono, plan_activo, clases_restantes, estado)
      SELECT 'Marcos López', 'marcos@example.com', '600987654', 'Mensualidad Ilimitada', 999, 'Activo'
      WHERE (SELECT count(*) FROM alumnos) = 1;

    `;
    
    await client.query(query);
    console.log("Migración exitosa: tablas creadas y pobladas con datos de prueba.");
  } catch (err) {
    console.error("Error ejecutando migración:", err);
  } finally {
    await client.end();
  }
}

run();
