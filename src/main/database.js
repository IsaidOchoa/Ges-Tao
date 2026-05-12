// src/database.js
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
    
    console.log(`[DB] Ruta de la base de datos: ${dbPath}`);
    
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    
    initSchema(dbInstance);
    seedData(dbInstance);
    
    console.log('[DB] Sistema de base de datos listo.');
    return dbInstance;
  } catch (error) {
    console.error('[DB] Error crítico al inicializar BD:', error);
    throw error;
  }
}

/**
 * Crea todas las tablas si no existen.
 * Define relaciones, índices y restricciones para optimizar búsquedas e integridad.
 */
function initSchema(db) {
  console.log('[DB] Verificando esquema de tablas...');

  // 1. USUARIOS (Autenticación del sistema)
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre_completo TEXT NOT NULL,
      rol TEXT NOT NULL CHECK(rol IN ('coordinadora', 'administrativo', 'administrador', 'invitado')),
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. DOCENTES (Catálogo de referencia para constancias)
  db.exec(`
    CREATE TABLE IF NOT EXISTS docentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT UNIQUE NOT NULL,
      apellido_paterno TEXT NOT NULL,
      apellido_materno TEXT,
      nombres TEXT NOT NULL,
      correo_contacto TEXT,
      telefono_contacto TEXT,
      tratamiento TEXT NOT NULL,
      articulo TEXT NOT NULL,
      nivel_academico TEXT,
      estado TEXT DEFAULT 'activo',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docentes_codigo ON docentes(codigo)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docentes_nombre ON docentes(apellido_paterno, nombres)`);

  // 3. PERIODOS ESCOLARES (Catálogo de tiempos) - ✅ ACTUALIZADO
  db.exec(`
    CREATE TABLE IF NOT EXISTS periodos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      
      -- Clave dinámica: ENE24-JUN24, AGO23-ENE24, etc.
      clave TEXT UNIQUE NOT NULL,
      
      -- Descripción legible para humanos
      descripcion TEXT NOT NULL,
      
      -- Fechas reales para cálculos y validaciones
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      
      -- Estado del periodo
      estado TEXT DEFAULT 'abierto' CHECK(estado IN ('abierto', 'cerrado', 'en_progreso')),
      
      -- Campos virtuales para ordenamiento/filtros por año
      ano_inicio INTEGER GENERATED ALWAYS AS (CAST(strftime('%Y', fecha_inicio) AS INTEGER)) VIRTUAL,
      mes_inicio INTEGER GENERATED ALWAYS AS (CAST(strftime('%m', fecha_inicio) AS INTEGER)) VIRTUAL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_periodos_fechas ON periodos(fecha_inicio, fecha_fin)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_periodos_estado ON periodos(estado)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_periodos_ano ON periodos(ano_inicio)`);

  // 4. EXPERIENCIAS EDUCATIVAS (EE)
  db.exec(`
    CREATE TABLE IF NOT EXISTS experiencias_educativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave_ee TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      tipo TEXT,
      creditos INTEGER DEFAULT 0,
      creditos_teoria INTEGER DEFAULT 0,
      creditos_practica INTEGER DEFAULT 0,
      creditos_otros INTEGER DEFAULT 0,
      area TEXT,
      linea_investigacion TEXT,
      horas_teoria INTEGER DEFAULT 0,
      horas_practica INTEGER DEFAULT 0,
      programa_academico TEXT,
      estado TEXT DEFAULT 'activa' CHECK(estado IN ('activa', 'inactiva', 'archivada')),
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. PROGRAMAS INSTITUCIONALES
  db.exec(`
    CREATE TABLE IF NOT EXISTS programas_institucionales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      responsable TEXT,
      fecha_registro DATE,
      estado TEXT DEFAULT 'vigente'
    )
  `);

  // 6. TIPOS DE CONSTANCIA
  db.exec(`
    CREATE TABLE IF NOT EXISTS tipos_constancia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      requiere_ee INTEGER DEFAULT 0,
      requiere_periodo INTEGER DEFAULT 0,
      estado TEXT DEFAULT 'activo',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tipos_estado ON tipos_constancia(estado)`);

  // 7. CONSTANCIAS (Tabla transaccional principal)
  db.exec(`
    CREATE TABLE IF NOT EXISTS constancias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT UNIQUE NOT NULL,
      docente_id INTEGER NOT NULL,
      periodo_id INTEGER,
      ee_id INTEGER,
      programa_id INTEGER,
      tipo_constancia_id INTEGER NOT NULL,
      fecha_emision DATE DEFAULT (date('now')),
      ruta_archivo TEXT,
      firma_digital TEXT,
      estado TEXT DEFAULT 'emitida',
      FOREIGN KEY (docente_id) REFERENCES docentes(id),
      FOREIGN KEY (periodo_id) REFERENCES periodos(id),
      FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id),
      FOREIGN KEY (tipo_constancia_id) REFERENCES tipos_constancia(id)
    )
  `);

  // 8. HISTORIAL DE AUDITORÍA
  db.exec(`
    CREATE TABLE IF NOT EXISTS historial_auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER,
      accion TEXT NOT NULL,
      tabla_afectada TEXT,
      registro_id INTEGER,
      detalles TEXT,
      ip_origen TEXT,
      fecha_sistema DATETIME DEFAULT CURRENT_TIMESTAMP,
      archivado INTEGER DEFAULT 0,
      fecha_archivo DATETIME,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_auditoria(fecha_sistema)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_historial_archivado ON historial_auditoria(archivado)`);

  // 9. ALUMNOS (Actualizado con periodo_ingreso, tratamiento, articulo)
  db.exec(`
    CREATE TABLE IF NOT EXISTS alumnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricula TEXT UNIQUE NOT NULL,
      apellido_paterno TEXT NOT NULL,
      apellido_materno TEXT,
      nombres TEXT NOT NULL,
      correo_contacto TEXT,
      telefono_contacto TEXT,
      programa_academico TEXT,
      periodo_ingreso TEXT,
      tratamiento TEXT DEFAULT 'Est.',
      articulo TEXT DEFAULT 'El',
      estado TEXT DEFAULT 'activo',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alumnos_matricula ON alumnos(matricula)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alumnos_nombre ON alumnos(apellido_paterno, nombres)`);

  // 10. TUTOR_ALUMNO
  db.exec(`
    CREATE TABLE IF NOT EXISTS tutor_alumno (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      docente_id INTEGER NOT NULL,
      alumno_id INTEGER NOT NULL,
      fecha_asignacion DATE DEFAULT (date('now')),
      estado TEXT DEFAULT 'activo',
      FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE CASCADE,
      FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tutor_alumno_docente ON tutor_alumno(docente_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tutor_alumno_alumno ON tutor_alumno(alumno_id)`);

  // 11. DOCENTE_EE_ASIGNACION
  db.exec(`
    CREATE TABLE IF NOT EXISTS docente_ee_asignacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      docente_id INTEGER NOT NULL,
      ee_id INTEGER NOT NULL,
      periodo_id INTEGER NOT NULL,
      carga_horaria INTEGER DEFAULT 0,
      fecha_asignacion DATE DEFAULT (date('now')),
      estado TEXT DEFAULT 'activo',
      FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE CASCADE,
      FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE CASCADE,
      FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE CASCADE,
      UNIQUE(docente_id, periodo_id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docente_ee_docente ON docente_ee_asignacion(docente_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docente_ee_ee ON docente_ee_asignacion(ee_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docente_ee_periodo ON docente_ee_asignacion(periodo_id)`);

  console.log('[DB] Esquema de tablas verificado correctamente.');
}

/**
 * Inserta datos iniciales (Semilla) si las tablas están vacías.
 */
function seedData(db) {
  // 1. Usuarios
  const userCount = db.prepare('SELECT count(*) as count FROM usuarios').get();
  if (userCount.count === 0) {
    console.log('[DB] Sembrando usuarios...');
    const stmt = db.prepare(`INSERT INTO usuarios (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)`);
    stmt.run('administrativo', 'admin123', 'Personal Administrativo', 'administrativo');
    stmt.run('coordinadora', 'coord123', 'Coordinadora del Programa', 'coordinadora');
    stmt.run('admin', 'admin', 'Administrador del Sistema', 'administrador');
  }

  // 2. Docentes
  const docCount = db.prepare('SELECT count(*) as count FROM docentes').get();
  if (docCount.count === 0) {
    console.log('[DB] Sembrando docentes...');
    const stmt = db.prepare(`INSERT INTO docentes (codigo, apellido_paterno, apellido_materno, nombres, correo_contacto, telefono_contacto, tratamiento, articulo, nivel_academico, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run('DOC-001', 'Perez', 'Hernandez', 'Juan Carlos', 'juan.perez@uv.mx', '2281234567', 'Dr.', 'El', 'base', 'activo');
    stmt.run('DOC-002', 'Lopez', 'Gomez', 'Maria Fernanda', 'maria.lopez@uv.mx', '2289876543', 'Dra.', 'La', 'base', 'activo');
    stmt.run('DOC-003', 'Ramirez', 'Sanchez', 'Roberto Carlos', 'roberto.ramirez@uv.mx', '', 'Mtro.', 'El', 'temporal', 'inactivo');
    stmt.run('DOC-004', 'Gonzalez', 'Martinez', 'Ana Luisa', 'ana.gonzalez@uv.mx', '2285551234', 'Mtra.', 'La', 'base', 'activo');
  }

  // 3. PERIODOS - Con claves dinámicas y duración máxima 6 meses
  const perCount = db.prepare('SELECT count(*) as count FROM periodos').get();
  if (perCount.count === 0) {
    console.log('[DB] Sembrando periodos escolares...');
    const stmt = db.prepare(`INSERT INTO periodos (clave, descripcion, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?, ?)`);
    
    // Plantilla: Semestre A (Feb-Jul) - mismo año
    stmt.run('FEB-JUL24', 'Periodo Escolar Febrero - Julio 2024', '2024-02-15', '2024-07-31', 'cerrado');
    
    // Plantilla: Semestre B (Ago-Dic) - mismo año
    stmt.run('AGO-DIC24', 'Periodo Escolar Agosto - Diciembre 2024', '2024-08-01', '2024-12-15', 'abierto');
    
    // Ejemplo que cruza años ( Ago 2023 - Ene 2024 ) - 5 meses, válido
    stmt.run('AGO23-ENE24', 'Periodo Escolar Agosto 2023 - Enero 2024', '2023-08-16', '2024-01-15', 'cerrado');
    
    // Periodo futuro de ejemplo
    stmt.run('FEB-JUL25', 'Periodo Escolar Febrero - Julio 2025', '2025-02-15', '2025-07-31', 'abierto');
    
    console.log('[DB] Periodos sembrados con claves dinámicas (max 6 meses)');
  }

  // 4. Experiencias Educativas
  const eeCount = db.prepare('SELECT count(*) as count FROM experiencias_educativas').get();
  if (eeCount.count === 0) {
    console.log('[DB] Sembrando Experiencias Educativas...');
    const stmt = db.prepare(`INSERT INTO experiencias_educativas (clave_ee, nombre, tipo, creditos, creditos_teoria, creditos_practica, creditos_otros, area, linea_investigacion, horas_teoria, horas_practica, programa_academico, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run('MSC-101', 'Fundamentos de Sistemas Computacionales', 'Obligatoria', 8, 5, 2, 1, 'disciplinar', 'Ingenieria de Software y Sistemas Distribuidos', 60, 30, 'Maestria', 'activa');
    stmt.run('MSC-102', 'Arquitectura de Software Avanzada', 'Obligatoria', 8, 5, 2, 1, 'disciplinar', 'Ingenieria de Software y Sistemas Distribuidos', 60, 30, 'Maestria', 'activa');
    stmt.run('MSC-201', 'Topicos Selectos de Inteligencia Artificial', 'Optativa', 6, 4, 2, 0, 'optativa', 'Inteligencia Artificial y Ciencia de Datos', 45, 15, 'Maestria', 'activa');
    stmt.run('DOC-500', 'Seminario de Tesis I', 'Taller', 10, 2, 8, 0, 'integradora', 'Ingenieria de Software y Sistemas Distribuidos', 30, 60, 'Doctorado', 'activa');
  }

  // 5. Programas Institucionales
  const progCount = db.prepare('SELECT count(*) as count FROM programas_institucionales').get();
  if (progCount.count === 0) {
    console.log('[DB] Sembrando Programas Institucionales...');
    const stmt = db.prepare(`INSERT INTO programas_institucionales (nombre, descripcion, responsable, fecha_registro, estado) VALUES (?, ?, ?, ?, ?)`);
    stmt.run('PRODEP', 'Programa para el Desarrollo Profesional Docente', 'Direccion General', '2023-01-10', 'vigente');
    stmt.run('CA-ESTATUTARIOS', 'Cuerpo Academico Consolidado', 'Dr. Responsable CA', '2022-05-20', 'vigente');
  }

  // 6. Tipos de Constancia
  const tiposCount = db.prepare('SELECT count(*) as count FROM tipos_constancia').get();
  if (tiposCount.count === 0) {
    console.log('[DB] Sembrando Tipos de Constancia...');
    const stmt = db.prepare(`INSERT INTO tipos_constancia (clave, nombre, descripcion, requiere_ee, requiere_periodo, estado) VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run('PART-DOC', 'Participacion como Docente', 'Para docentes que imparten catedra.', 1, 1, 'activo');
    stmt.run('PART-ALU', 'Participacion como Alumno', 'Para asistentes a cursos.', 1, 1, 'activo');
    stmt.run('DICTAM', 'Dictaminador de Proyectos', 'Para evaluacion de tesis.', 0, 0, 'activo');
    stmt.run('AUT-ACA', 'Autoridad Academica', 'Para directores y coordinadores.', 0, 0, 'activo');
    stmt.run('RECON', 'Reconocimiento Especial', 'Constancias genericas.', 0, 0, 'activo');
  }

  // 7. Alumnos (con periodo_ingreso, tratamiento, articulo)
  const alumnoCount = db.prepare('SELECT count(*) as count FROM alumnos').get();
  if (alumnoCount.count === 0) {
    console.log('[DB] Sembrando alumnos...');
    const stmt = db.prepare(`INSERT INTO alumnos (matricula, apellido_paterno, apellido_materno, nombres, correo_contacto, telefono_contacto, programa_academico, periodo_ingreso, tratamiento, articulo, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    stmt.run('MAT-2024-001', 'Garcia', 'Lopez', 'Carlos Alberto', 'carlos.garcia@alumno.uv.mx', '2281112233', 'Maestria', 'FEB-JUL24', 'Est.', 'El', 'activo');
    stmt.run('MAT-2024-002', 'Martinez', 'Ruiz', 'Laura Sofia', 'laura.martinez@alumno.uv.mx', '2284445566', 'Maestria', 'AGO-DIC24', 'Est.', 'La', 'activo');
    stmt.run('MAT-2023-015', 'Hernandez', 'Castro', 'Miguel Angel', 'miguel.hernandez@alumno.uv.mx', '', 'Doctorado', 'AGO23-ENE24', 'Est.', 'El', 'activo');
  }

  // 8. Relaciones Tutor-Alumno
  const tutorCount = db.prepare('SELECT count(*) as count FROM tutor_alumno').get();
  if (tutorCount.count === 0) {
    console.log('[DB] Sembrando relaciones tutor-alumno...');
    const doc1 = db.prepare('SELECT id FROM docentes WHERE codigo = ?').get('DOC-001');
    const doc2 = db.prepare('SELECT id FROM docentes WHERE codigo = ?').get('DOC-002');
    const alum1 = db.prepare('SELECT id FROM alumnos WHERE matricula = ?').get('MAT-2024-001');
    const alum2 = db.prepare('SELECT id FROM alumnos WHERE matricula = ?').get('MAT-2024-002');
    const alum3 = db.prepare('SELECT id FROM alumnos WHERE matricula = ?').get('MAT-2023-015');

    if (doc1 && doc2 && alum1 && alum2 && alum3) {
      const stmt = db.prepare(`INSERT INTO tutor_alumno (docente_id, alumno_id, fecha_asignacion, estado) VALUES (?, ?, ?, ?)`);
      stmt.run(doc1.id, alum1.id, '2024-01-20', 'activo');
      stmt.run(doc1.id, alum2.id, '2024-01-20', 'activo');
      stmt.run(doc2.id, alum3.id, '2023-08-10', 'activo');
    }
  }

  // 9. Asignaciones Docente-EE
  const asignacionCount = db.prepare('SELECT count(*) as count FROM docente_ee_asignacion').get();
  if (asignacionCount.count === 0) {
    console.log('[DB] Sembrando asignaciones docente-EE...');
    const doc1 = db.prepare('SELECT id FROM docentes WHERE codigo = ?').get('DOC-001');
    const doc2 = db.prepare('SELECT id FROM docentes WHERE codigo = ?').get('DOC-002');
    const ee1 = db.prepare('SELECT id FROM experiencias_educativas WHERE clave_ee = ?').get('MSC-101');
    const ee2 = db.prepare('SELECT id FROM experiencias_educativas WHERE clave_ee = ?').get('MSC-102');
    const per1 = db.prepare('SELECT id FROM periodos WHERE clave = ?').get('FEB-JUL24');
    const per2 = db.prepare('SELECT id FROM periodos WHERE clave = ?').get('AGO-DIC24');

    if (doc1 && doc2 && ee1 && ee2 && per1 && per2) {
      const stmt = db.prepare(`INSERT INTO docente_ee_asignacion (docente_id, ee_id, periodo_id, carga_horaria, estado) VALUES (?, ?, ?, ?, ?)`);
      stmt.run(doc1.id, ee1.id, per1.id, 60, 'activo');
      stmt.run(doc2.id, ee2.id, per2.id, 60, 'activo');
    }
  }

  // 10. Constancias de Ejemplo
  const consCount = db.prepare('SELECT count(*) as count FROM constancias').get();
  if (consCount.count === 0) {
    console.log('[DB] Sembrando constancias de ejemplo...');
    const doc1 = db.prepare('SELECT id FROM docentes WHERE codigo = ?').get('DOC-001');
    const per1 = db.prepare('SELECT id FROM periodos WHERE clave = ?').get('FEB-JUL24');
    const ee1 = db.prepare('SELECT id FROM experiencias_educativas WHERE clave_ee = ?').get('MSC-101');
    const tipo1 = db.prepare('SELECT id FROM tipos_constancia WHERE clave = ?').get('PART-DOC');

    if (doc1 && per1 && tipo1) {
      const stmt = db.prepare(`INSERT INTO constancias (folio, docente_id, periodo_id, ee_id, tipo_constancia_id, fecha_emision, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      stmt.run('FOLIO-2024-001', doc1.id, per1.id, ee1 ? ee1.id : null, tipo1.id, '2024-07-10', 'emitida');
    }
  }
}

module.exports = {
  getDB
};