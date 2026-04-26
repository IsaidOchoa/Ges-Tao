const { app } = require('electron');
const path = require('node:path');
const Database = require('better-sqlite3');

let dbInstance = null;

/**
 * Obtiene la instancia única de la base de datos.
 * Si no existe, la crea, inicializa el esquema y carga datos semilla.
 */
function getDB() {
  if (dbInstance) return dbInstance;

  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'ges-tao.db');
    
    console.log(`💾 [DB] Ruta de la base de datos: ${dbPath}`);
    
    // Crear conexión
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL'); // Mejor rendimiento y concurrencia
    
    // Inicializar tablas y datos
    initSchema(dbInstance);
    seedData(dbInstance);
    
    console.log('✅ [DB] Sistema de base de datos listo.');
    return dbInstance;
  } catch (error) {
    console.error('❌ [DB] Error crítico al inicializar BD:', error);
    throw error;
  }
}

/**
 * Crea todas las tablas si no existen.
 * Define relaciones e índices para optimizar búsquedas.
 */
function initSchema(db) {
  console.log(' [DB] Verificando esquema de tablas...');

  // 1. USUARIOS DEL SISTEMA (Directora, Coordinadora, Admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, 
      nombre_completo TEXT NOT NULL,
      rol TEXT NOT NULL, -- 'directora', 'coordinadora', 'admin'
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. DOCENTES (Catálogo Principal)
  db.exec(`
    CREATE TABLE IF NOT EXISTS docentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      apellido_paterno TEXT NOT NULL,
      apellido_materno TEXT,
      nombres TEXT NOT NULL,
      correo_contacto TEXT,
      telefono_contacto TEXT,
      nivel_academico TEXT, -- 'Tiempo Completo', 'Asignatura', etc.
      estado TEXT DEFAULT 'activo', -- 'activo', 'inactivo', 'sabatico'
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Índice para búsqueda rápida por nombre o código
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docentes_codigo ON docentes(codigo)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docentes_nombre ON docentes(apellido_paterno, nombres)`);

  // 3. PERIODOS ESCOLARES (Catálogo de Tiempos)
  db.exec(`
    CREATE TABLE IF NOT EXISTS periodos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT UNIQUE NOT NULL, -- Ej: '2023-A', '2024-B'
      descripcion TEXT NOT NULL,  -- Ej: 'Agosto 2023 - Diciembre 2023'
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      estado TEXT DEFAULT 'abierto' -- 'abierto', 'cerrado', 'en_proceso'
    )
  `);

  // 4. EXPERIENCIAS EDUCATIVAS (Catálogo de Materias/Cursos)
  db.exec(`
    CREATE TABLE IF NOT EXISTS experiencias_educativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave_ee TEXT UNIQUE NOT NULL, -- Ej: 'SIST-101'
      nombre TEXT NOT NULL,
      tipo TEXT, -- 'Obligatoria', 'Optativa', 'Taller'
      creditos INTEGER DEFAULT 0,
      horas_teoria INTEGER DEFAULT 0,
      horas_practica INTEGER DEFAULT 0,
      programa_academico TEXT, -- 'Maestría', 'Doctorado'
      estado TEXT DEFAULT 'activa'
    )
  `);

  // 5. PROGRAMAS INSTITUCIONALES (Catálogo de Programas)
  db.exec(`
    CREATE TABLE IF NOT EXISTS programas_institucionales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL, -- Ej: 'PRODEP', 'CA-Estatutarios'
      descripcion TEXT,
      responsable TEXT,
      fecha_registro DATE,
      estado TEXT DEFAULT 'vigente'
    )
  `);

  // 6. CONSTANCIAS (Tabla Transaccional Principal)
  db.exec(`
    CREATE TABLE IF NOT EXISTS constancias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL, -- Folio único generado (ej: CONST-2023-001)
      docente_id INTEGER NOT NULL,
      periodo_id INTEGER,
      ee_id INTEGER, -- Opcional, si es por materia específica
      programa_id INTEGER, -- Opcional, si pertenece a un programa
      tipo_constancia TEXT NOT NULL, -- 'Participación', 'Dictaminador', 'Autoría'
      fecha_emision DATE DEFAULT (date('now')),
      ruta_archivo TEXT, -- Ruta relativa al PDF generado
      firma_digital TEXT, -- Hash o ruta de la firma
      estado TEXT DEFAULT 'emitida', -- 'emitida', 'cancelada', 'borrador'
      FOREIGN KEY (docente_id) REFERENCES docentes(id),
      FOREIGN KEY (periodo_id) REFERENCES periodos(id),
      FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id)
    )
  `);

  // 7. HISTORIAL DE AUDITORÍA (Logs del sistema)
  db.exec(`
    CREATE TABLE IF NOT EXISTS historial_auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      accion TEXT NOT NULL, -- 'LOGIN', 'EMITIR_CONSTANCIA', 'ELIMINAR_DOCENTE'
      tabla_afectada TEXT,
      registro_id INTEGER,
      detalles TEXT, -- JSON con los cambios o descripción
      ip_origen TEXT,
      fecha_sistema DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  console.log('✅ [DB] Esquema de tablas verificado correctamente.');
}

/**
 * Inserta datos iniciales (Semilla) si las tablas están vacías.
 * Útil para desarrollo y demostraciones.
 */
function seedData(db) {
  // 1. Usuarios
  const userCount = db.prepare('SELECT count(*) as count FROM usuarios').get();
  if (userCount.count === 0) {
    console.log('🌱 [DB] Sembrando usuarios...');
    const stmt = db.prepare(`
      INSERT INTO usuarios (username, password_hash, nombre_completo, rol) 
      VALUES (?, ?, ?, ?)
    `);
    stmt.run('directora', 'admin123', 'Dra. Directora MSICU', 'directora');
    stmt.run('coordinadora', 'admin123', 'Mtra. Coordinadora Académica', 'coordinadora');
  }

  // 2. Docentes
  const docCount = db.prepare('SELECT count(*) as count FROM docentes').get();
  if (docCount.count === 0) {
    console.log('🌱 [DB] Sembrando docentes...');
    const stmt = db.prepare(`
      INSERT INTO docentes (codigo, apellido_paterno, apellido_materno, nombres, correo_contacto, telefono_contacto, nivel_academico, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run('DOC-001', 'Pérez', 'Hernández', 'Juan Carlos', 'juan.perez@uv.mx', '2281234567', 'Tiempo Completo', 'activo');
    stmt.run('DOC-002', 'López', 'Gómez', 'María Fernanda', 'maria.lopez@uv.mx', '2289876543', 'Profesor de Asignatura', 'activo');
    stmt.run('DOC-003', 'Ramírez', 'Sánchez', 'Roberto Carlos', 'roberto.ramirez@uv.mx', '', 'Investigador', 'inactivo');
    stmt.run('DOC-004', 'González', 'Martínez', 'Ana Luisa', 'ana.gonzalez@uv.mx', '2285551234', 'Tiempo Completo', 'activo');
  }

  // 3. Periodos
  const perCount = db.prepare('SELECT count(*) as count FROM periodos').get();
  if (perCount.count === 0) {
    console.log('🌱 [DB] Sembrando periodos...');
    const stmt = db.prepare(`
      INSERT INTO periodos (clave, descripcion, fecha_inicio, fecha_fin, estado)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run('2023-A', 'Periodo Escolar Agosto-Diciembre 2023', '2023-08-01', '2023-12-15', 'cerrado');
    stmt.run('2024-A', 'Periodo Escolar Enero-Junio 2024', '2024-01-15', '2024-06-30', 'cerrado');
    stmt.run('2024-B', 'Periodo Escolar Agosto-Diciembre 2024', '2024-08-01', '2024-12-15', 'abierto');
  }

  // 4. Experiencias Educativas (EE)
  const eeCount = db.prepare('SELECT count(*) as count FROM experiencias_educativas').get();
  if (eeCount.count === 0) {
    console.log('🌱 [DB] Sembrando Experiencias Educativas...');
    const stmt = db.prepare(`
      INSERT INTO experiencias_educativas (clave_ee, nombre, tipo, creditos, horas_teoria, horas_practica, programa_academico, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run('MSC-101', 'Fundamentos de Sistemas Computacionales', 'Obligatoria', 8, 60, 30, 'Maestría', 'activa');
    stmt.run('MSC-102', 'Arquitectura de Software Avanzada', 'Obligatoria', 8, 60, 30, 'Maestría', 'activa');
    stmt.run('MSC-201', 'Tópicos Selectos de Inteligencia Artificial', 'Optativa', 6, 45, 15, 'Maestría', 'activa');
    stmt.run('DOC-500', 'Seminario de Tesis I', 'Taller', 10, 30, 60, 'Doctorado', 'activa');
  }

  // 5. Programas Institucionales
  const progCount = db.prepare('SELECT count(*) as count FROM programas_institucionales').get();
  if (progCount.count === 0) {
    console.log('🌱 [DB] Sembrando Programas Institucionales...');
    const stmt = db.prepare(`
      INSERT INTO programas_institucionales (nombre, descripcion, responsable, fecha_registro, estado)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run('PRODEP', 'Programa para el Desarrollo Profesional Docente', 'Dirección General', '2023-01-10', 'vigente');
    stmt.run('CA-ESTATUTARIOS', 'Cuerpo Académico Consolidado', 'Dr. Responsable CA', '2022-05-20', 'vigente');
  }

  // 6. Constancias de Ejemplo (Para que el historial no esté vacío)
  const consCount = db.prepare('SELECT count(*) as count FROM constancias').get();
  if (consCount.count === 0) {
    console.log('🌱 [DB] Sembrando constancias de ejemplo...');
    // Obtenemos IDs reales de las tablas anteriores para las llaves foráneas
    const doc1 = db.prepare('SELECT id FROM docentes WHERE codigo = ?').get('DOC-001');
    const per1 = db.prepare('SELECT id FROM periodos WHERE clave = ?').get('2024-A');
    const ee1 = db.prepare('SELECT id FROM experiencias_educativas WHERE clave_ee = ?').get('MSC-101');

    if (doc1 && per1) {
      const stmt = db.prepare(`
        INSERT INTO constancias (folio, docente_id, periodo_id, ee_id, tipo_constancia, fecha_emision, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run('FOLIO-2024-001', doc1.id, per1.id, ee1 ? ee1.id : null, 'Participación como Docente', '2024-06-15', 'emitida');
      stmt.run('FOLIO-2024-002', doc1.id, per1.id, null, 'Dictaminador de Proyectos', '2024-06-20', 'emitida');
    }
  }
}

module.exports = {
  getDB,
};