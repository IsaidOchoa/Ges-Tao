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
      rol TEXT NOT NULL,
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
      
      -- Campos para tratamiento en constancias (captura única, reuso infinito)
      tratamiento TEXT NOT NULL,      -- 'Dr.', 'Dra.', 'Mtro.', 'Mtra.', 'Lic.', 'Ing.'
      articulo TEXT NOT NULL,         -- 'El', 'La'
      
      -- Solo para filtro interno (no afecta constancias)
      nivel_academico TEXT,           -- 'base', 'temporal'
      estado TEXT DEFAULT 'activo',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docentes_codigo ON docentes(codigo)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docentes_nombre ON docentes(apellido_paterno, nombres)`);

  // 3. PERIODOS ESCOLARES (Catálogo de tiempos)
  db.exec(`
    CREATE TABLE IF NOT EXISTS periodos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT UNIQUE NOT NULL,
      descripcion TEXT NOT NULL,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      estado TEXT DEFAULT 'abierto'
    )
  `);

  // 4. EXPERIENCIAS EDUCATIVAS (EE) - Propias del programa
  db.exec(`
    CREATE TABLE IF NOT EXISTS experiencias_educativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave_ee TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      tipo TEXT,                    -- 'Obligatoria', 'Optativa', 'Taller'
      
      -- Créditos desglosados (requisito académico)
      creditos INTEGER DEFAULT 0,   -- Total (informativo)
      creditos_teoria INTEGER DEFAULT 0,
      creditos_practica INTEGER DEFAULT 0,
      creditos_otros INTEGER DEFAULT 0,
      
      -- Área académica
      area TEXT,                    -- 'disciplinar', 'integradora', 'optativa', 'complementaria'
      
      -- Línea de investigación (texto por ahora, solo 2 opciones)
      linea_investigacion TEXT,     -- 'Ingeniería de Software...', 'Inteligencia Artificial...'
      
      horas_teoria INTEGER DEFAULT 0,
      horas_practica INTEGER DEFAULT 0,
      programa_academico TEXT,
      estado TEXT DEFAULT 'activa'
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

  // 6. TIPOS DE CONSTANCIA (Catálogo dinámico)
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

  // 8. HISTORIAL DE AUDITORÍA (Con gestión de ciclo de vida)
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
      
      -- Campos para gestión del ciclo de vida de auditoría
      archivado INTEGER DEFAULT 0,        -- 0=activo, 1=exportado/archivado
      fecha_archivo DATETIME,             -- Cuándo se exportó el registro
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_auditoria(fecha_sistema)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_historial_archivado ON historial_auditoria(archivado)`);

  // 9. ALUMNOS (Catálogo de referencia para tutorías)
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
      fecha_ingreso DATE,
      estado TEXT DEFAULT 'activo',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alumnos_matricula ON alumnos(matricula)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alumnos_nombre ON alumnos(apellido_paterno, nombres)`);

  // 10. TUTOR_ALUMNO (Relación 1:N: Un tutor tiene muchos alumnos, un alumno tiene 1 tutor ACTIVO)
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

  // 11. DOCENTE_EE_ASIGNACION (Regla: 1 Docente = 1 EE por Periodo)
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
 * Útil para desarrollo y demostraciones.
 */
function seedData(db) {
  // 1. Usuarios (2 por defecto, mismos permisos)
  const userCount = db.prepare('SELECT count(*) as count FROM usuarios').get();
  if (userCount.count === 0) {
    console.log('[DB] Sembrando usuarios...');
    const stmt = db.prepare(`INSERT INTO usuarios (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)`);
    stmt.run('administrativo', 'admin123', 'Personal Administrativo', 'administrativo');
    stmt.run('coordinadora', 'coord123', 'Coordinadora del Programa', 'coordinadora');
  }

  // 2. Docentes (con tratamiento y artículo para constancias)
  const docCount = db.prepare('SELECT count(*) as count FROM docentes').get();
  if (docCount.count === 0) {
    console.log('[DB] Sembrando docentes...');
    const stmt = db.prepare(`INSERT INTO docentes (codigo, apellido_paterno, apellido_materno, nombres, correo_contacto, telefono_contacto, tratamiento, articulo, nivel_academico, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run('DOC-001', 'Pérez', 'Hernández', 'Juan Carlos', 'juan.perez@uv.mx', '2281234567', 'Dr.', 'El', 'base', 'activo');
    stmt.run('DOC-002', 'López', 'Gómez', 'María Fernanda', 'maria.lopez@uv.mx', '2289876543', 'Dra.', 'La', 'base', 'activo');
    stmt.run('DOC-003', 'Ramírez', 'Sánchez', 'Roberto Carlos', 'roberto.ramirez@uv.mx', '', 'Mtro.', 'El', 'temporal', 'inactivo');
    stmt.run('DOC-004', 'González', 'Martínez', 'Ana Luisa', 'ana.gonzalez@uv.mx', '2285551234', 'Mtra.', 'La', 'base', 'activo');
  }

  // 3. Periodos
  const perCount = db.prepare('SELECT count(*) as count FROM periodos').get();
  if (perCount.count === 0) {
    console.log('[DB] Sembrando periodos...');
    const stmt = db.prepare(`INSERT INTO periodos (clave, descripcion, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?, ?)`);
    stmt.run('2023-A', 'Periodo Escolar Agosto-Diciembre 2023', '2023-08-01', '2023-12-15', 'cerrado');
    stmt.run('2024-A', 'Periodo Escolar Enero-Junio 2024', '2024-01-15', '2024-06-30', 'cerrado');
    stmt.run('2024-B', 'Periodo Escolar Agosto-Diciembre 2024', '2024-08-01', '2024-12-15', 'abierto');
  }

  // 4. Experiencias Educativas (con créditos desglosados, área y línea de investigación)
  const eeCount = db.prepare('SELECT count(*) as count FROM experiencias_educativas').get();
  if (eeCount.count === 0) {
    console.log('[DB] Sembrando Experiencias Educativas...');
    const stmt = db.prepare(`INSERT INTO experiencias_educativas (clave_ee, nombre, tipo, creditos, creditos_teoria, creditos_practica, creditos_otros, area, linea_investigacion, horas_teoria, horas_practica, programa_academico, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run('MSC-101', 'Fundamentos de Sistemas Computacionales', 'Obligatoria', 8, 5, 2, 1, 'disciplinar', 'Ingeniería de Software y Sistemas Distribuidos', 60, 30, 'Maestría', 'activa');
    stmt.run('MSC-102', 'Arquitectura de Software Avanzada', 'Obligatoria', 8, 5, 2, 1, 'disciplinar', 'Ingeniería de Software y Sistemas Distribuidos', 60, 30, 'Maestría', 'activa');
    stmt.run('MSC-201', 'Tópicos Selectos de Inteligencia Artificial', 'Optativa', 6, 4, 2, 0, 'optativa', 'Inteligencia Artificial y Ciencia de Datos', 45, 15, 'Maestría', 'activa');
    stmt.run('DOC-500', 'Seminario de Tesis I', 'Taller', 10, 2, 8, 0, 'integradora', 'Ingeniería de Software y Sistemas Distribuidos', 30, 60, 'Doctorado', 'activa');
  }

  // 5. Programas Institucionales
  const progCount = db.prepare('SELECT count(*) as count FROM programas_institucionales').get();
  if (progCount.count === 0) {
    console.log('[DB] Sembrando Programas Institucionales...');
    const stmt = db.prepare(`INSERT INTO programas_institucionales (nombre, descripcion, responsable, fecha_registro, estado) VALUES (?, ?, ?, ?, ?)`);
    stmt.run('PRODEP', 'Programa para el Desarrollo Profesional Docente', 'Dirección General', '2023-01-10', 'vigente');
    stmt.run('CA-ESTATUTARIOS', 'Cuerpo Académico Consolidado', 'Dr. Responsable CA', '2022-05-20', 'vigente');
  }

  // 6. Tipos de Constancia (Base para el programa)
  const tiposCount = db.prepare('SELECT count(*) as count FROM tipos_constancia').get();
  if (tiposCount.count === 0) {
    console.log('[DB] Sembrando Tipos de Constancia...');
    const stmt = db.prepare(`INSERT INTO tipos_constancia (clave, nombre, descripcion, requiere_ee, requiere_periodo, estado) VALUES (?, ?, ?, ?, ?, ?)`);
    stmt.run('PART-DOC', 'Participación como Docente', 'Para docentes que imparten cátedra.', 1, 1, 'activo');
    stmt.run('PART-ALU', 'Participación como Alumno', 'Para asistentes a cursos.', 1, 1, 'activo');
    stmt.run('DICTAM', 'Dictaminador de Proyectos', 'Para evaluación de tesis.', 0, 0, 'activo');
    stmt.run('AUT-ACA', 'Autoridad Académica', 'Para directores y coordinadores.', 0, 0, 'activo');
    stmt.run('RECON', 'Reconocimiento Especial', 'Constancias genéricas.', 0, 0, 'activo');
  }

  // 7. Alumnos
  const alumnoCount = db.prepare('SELECT count(*) as count FROM alumnos').get();
  if (alumnoCount.count === 0) {
    console.log('[DB] Sembrando alumnos...');
    const stmt = db.prepare(`INSERT INTO alumnos (matricula, apellido_paterno, apellido_materno, nombres, correo_contacto, telefono_contacto, programa_academico, fecha_ingreso, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run('MAT-2024-001', 'García', 'López', 'Carlos Alberto', 'carlos.garcia@alumno.uv.mx', '2281112233', 'Maestría', '2024-01-15', 'activo');
    stmt.run('MAT-2024-002', 'Martínez', 'Ruiz', 'Laura Sofía', 'laura.martinez@alumno.uv.mx', '2284445566', 'Maestría', '2024-01-15', 'activo');
    stmt.run('MAT-2023-015', 'Hernández', 'Castro', 'Miguel Ángel', 'miguel.hernandez@alumno.uv.mx', '', 'Doctorado', '2023-08-01', 'activo');
  }

  // 8. Relaciones Tutor-Alumno (1 tutor activo por alumno)
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

  // 9. Asignaciones Docente-EE (1 docente = 1 EE por periodo)
  const asignacionCount = db.prepare('SELECT count(*) as count FROM docente_ee_asignacion').get();
  if (asignacionCount.count === 0) {
    console.log('[DB] Sembrando asignaciones docente-EE...');
    const doc1 = db.prepare('SELECT id FROM docentes WHERE codigo = ?').get('DOC-001');
    const doc2 = db.prepare('SELECT id FROM docentes WHERE codigo = ?').get('DOC-002');
    const ee1 = db.prepare('SELECT id FROM experiencias_educativas WHERE clave_ee = ?').get('MSC-101');
    const ee2 = db.prepare('SELECT id FROM experiencias_educativas WHERE clave_ee = ?').get('MSC-102');
    const per1 = db.prepare('SELECT id FROM periodos WHERE clave = ?').get('2024-A');
    const per2 = db.prepare('SELECT id FROM periodos WHERE clave = ?').get('2024-B');

    if (doc1 && doc2 && ee1 && ee2 && per1 && per2) {
      const stmt = db.prepare(`INSERT INTO docente_ee_asignacion (docente_id, ee_id, periodo_id, carga_horaria, estado) VALUES (?, ?, ?, ?, ?)`);
      stmt.run(doc1.id, ee1.id, per1.id, 60, 'activo');
      stmt.run(doc2.id, ee2.id, per1.id, 60, 'activo');
    }
  }

  // 10. Constancias de Ejemplo
  const consCount = db.prepare('SELECT count(*) as count FROM constancias').get();
  if (consCount.count === 0) {
    console.log('[DB] Sembrando constancias de ejemplo...');
    const doc1 = db.prepare('SELECT id FROM docentes WHERE codigo = ?').get('DOC-001');
    const per1 = db.prepare('SELECT id FROM periodos WHERE clave = ?').get('2024-A');
    const ee1 = db.prepare('SELECT id FROM experiencias_educativas WHERE clave_ee = ?').get('MSC-101');
    const tipo1 = db.prepare('SELECT id FROM tipos_constancia WHERE clave = ?').get('PART-DOC');

    if (doc1 && per1 && tipo1) {
      const stmt = db.prepare(`INSERT INTO constancias (folio, docente_id, periodo_id, ee_id, tipo_constancia_id, fecha_emision, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      stmt.run('FOLIO-2024-001', doc1.id, per1.id, ee1 ? ee1.id : null, tipo1.id, '2024-06-15', 'emitida');
    }
  }
}

module.exports = {
  getDB,
};