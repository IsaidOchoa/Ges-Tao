// src/database.js
const { app } = require('electron');
const path = require('node:path');
const Database = require('better-sqlite3');

let dbInstance = null;

function getDB() {
  if (dbInstance) return dbInstance;
  try {
    const dbPath = path.join(app.getPath('userData'), 'ges-tao.db');
    console.log(`[DB] Ruta: ${dbPath}`);
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    initSchema(dbInstance);
    seedData(dbInstance);
    console.log('[DB] Sistema listo.');
    return dbInstance;
  } catch (error) {
    console.error('[DB] Error crítico:', error);
    throw error;
  }
}

function initSchema(db) {
  console.log('[DB] Verificando esquema...');

  // 1. USUARIOS
  db.exec(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    rol TEXT NOT NULL CHECK(rol IN ('coordinadora','administrativo','administrador','invitado')),
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. DOCENTES
  db.exec(`CREATE TABLE IF NOT EXISTS docentes (
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
    estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','inactivo','archivado')),
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docentes_codigo ON docentes(codigo)`);

  // 3. PERIODOS
  db.exec(`CREATE TABLE IF NOT EXISTS periodos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado TEXT DEFAULT 'abierto' CHECK(estado IN ('abierto','cerrado','en_progreso')),
    ano_inicio INTEGER GENERATED ALWAYS AS (CAST(strftime('%Y',fecha_inicio) AS INTEGER)) VIRTUAL
  )`);

  // 4. SEMESTRES
  db.exec(`CREATE TABLE IF NOT EXISTS semestres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    orden INTEGER UNIQUE CHECK(orden BETWEEN 1 AND 14),
    estado TEXT DEFAULT 'activo'
  )`);

  // 5. PLANES
  db.exec(`CREATE TABLE IF NOT EXISTS planes_estudio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    nivel TEXT CHECK(nivel IN ('licenciatura','maestria','doctorado','especialidad')),
    estado TEXT DEFAULT 'activo',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 6. EXPERIENCIAS EDUCATIVAS
  db.exec(`CREATE TABLE IF NOT EXISTS experiencias_educativas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave_ee TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    tipo TEXT,
    creditos INTEGER DEFAULT 0,
    area TEXT,
    nrc TEXT UNIQUE,
    estado TEXT DEFAULT 'activa',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 7. MALLA CURRICULAR
  db.exec(`CREATE TABLE IF NOT EXISTS malla_curricular (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER,
    ee_id INTEGER NOT NULL,
    semestre_id INTEGER,
    creditos_asignados INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'activo',
    FOREIGN KEY (plan_id) REFERENCES planes_estudio(id) ON DELETE RESTRICT,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE RESTRICT,
    FOREIGN KEY (semestre_id) REFERENCES semestres(id) ON DELETE RESTRICT,
    UNIQUE(ee_id, plan_id)
  )`);

  // 8. PROGRAMAS
  db.exec(`CREATE TABLE IF NOT EXISTS programas_institucionales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    responsable TEXT,
    estado TEXT DEFAULT 'vigente'
  )`);

  // 9. TIPOS CONSTANCIA
  db.exec(`CREATE TABLE IF NOT EXISTS tipos_constancia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    requiere_ee INTEGER DEFAULT 0,
    requiere_periodo INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'activo'
  )`);

  // 10. CONSTANCIAS
  db.exec(`CREATE TABLE IF NOT EXISTS constancias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE NOT NULL,
    docente_id INTEGER NOT NULL,
    periodo_id INTEGER,
    ee_id INTEGER,
    programa_id INTEGER,
    tipo_constancia_id INTEGER NOT NULL,
    fecha_emision DATE DEFAULT (date('now')),
    ruta_archivo TEXT,
    estado TEXT DEFAULT 'emitida',
    FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE RESTRICT,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE RESTRICT,
    FOREIGN KEY (tipo_constancia_id) REFERENCES tipos_constancia(id) ON DELETE RESTRICT
  )`);

  // 11. HISTORIAL
  db.exec(`CREATE TABLE IF NOT EXISTS historial_auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    accion TEXT NOT NULL,
    tabla_afectada TEXT,
    registro_id INTEGER,
    detalles TEXT,
    fecha_sistema DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
  )`);

  // 12. ALUMNOS
  db.exec(`CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matricula TEXT UNIQUE NOT NULL,
    apellido_paterno TEXT NOT NULL,
    apellido_materno TEXT,
    nombres TEXT NOT NULL,
    telefono_contacto TEXT,
    correo_contacto TEXT,
    programa_academico TEXT,
    periodo_ingreso TEXT,
    generacion_id INTEGER,
    tratamiento TEXT DEFAULT 'Est.',
    articulo TEXT DEFAULT 'El',
    estado TEXT DEFAULT 'activo',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generacion_id) REFERENCES generaciones(id) ON DELETE RESTRICT
  )`);

  // 13. GENERACIONES
  db.exec(`CREATE TABLE IF NOT EXISTS generaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER,
    periodo_ingreso_id INTEGER,
    clave TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    estado TEXT DEFAULT 'activa',
    FOREIGN KEY (plan_id) REFERENCES planes_estudio(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_ingreso_id) REFERENCES periodos(id) ON DELETE RESTRICT
  )`);

  // 14. TUTOR_ALUMNO ✅ CORREGIDO: SIN "WHERE" EN UNIQUE
  db.exec(`CREATE TABLE IF NOT EXISTS tutor_alumno (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    docente_id INTEGER NOT NULL,
    alumno_id INTEGER NOT NULL,
    periodo_id INTEGER,
    fecha_asignacion DATE DEFAULT (date('now')),
    estado TEXT DEFAULT 'activo',
    FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE RESTRICT,
    FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE SET NULL
    -- ✅ El índice parcial va DESPUÉS, no aquí
  )`);
  // ✅ ÍNDICE PARCIAL SEPARADO (esto SÍ permite WHERE)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_unique ON tutor_alumno(docente_id, alumno_id) WHERE estado='activo'`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tutor_docente ON tutor_alumno(docente_id)`);

  // 15. DOCENTE_EE_ASIGNACION
  db.exec(`CREATE TABLE IF NOT EXISTS docente_ee_asignacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    docente_id INTEGER NOT NULL,
    ee_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    carga_horaria INTEGER DEFAULT 0,
    fecha_asignacion DATE DEFAULT (date('now')),
    estado TEXT DEFAULT 'activo',
    FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE RESTRICT,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE RESTRICT,
    UNIQUE(docente_id, ee_id, periodo_id)
  )`);

  // 16. INSCRIPCIONES
  db.exec(`CREATE TABLE IF NOT EXISTS inscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alumno_id INTEGER NOT NULL,
    ee_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    fecha_asignacion DATE DEFAULT (date('now')),
    fecha_baja DATE,
    activo INTEGER DEFAULT 1,
    asignado_por INTEGER,
    FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE RESTRICT,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE RESTRICT,
    FOREIGN KEY (asignado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    UNIQUE(alumno_id, ee_id, periodo_id)
  )`);

  // 17. ESTADÍSTICAS (Contador automático)
  db.exec(`CREATE TABLE IF NOT EXISTS estadisticas_ee_periodo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ee_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    total_alumnos INTEGER DEFAULT 0,
    ultima_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE CASCADE,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE CASCADE,
    UNIQUE(ee_id, periodo_id)
  )`);

  // 18. TRIGGERS para contador automático
  db.exec(`CREATE TRIGGER IF NOT EXISTS trg_ins_insert AFTER INSERT ON inscripciones BEGIN
    INSERT INTO estadisticas_ee_periodo(ee_id,periodo_id,total_alumnos,ultima_actualizacion)
    VALUES(NEW.ee_id,NEW.periodo_id,1,CURRENT_TIMESTAMP)
    ON CONFLICT(ee_id,periodo_id) DO UPDATE SET total_alumnos=total_alumnos+1, ultima_actualizacion=CURRENT_TIMESTAMP;
  END`);

  db.exec(`CREATE TRIGGER IF NOT EXISTS trg_ins_delete AFTER DELETE ON inscripciones BEGIN
    UPDATE estadisticas_ee_periodo SET total_alumnos=MAX(0,total_alumnos-1), ultima_actualizacion=CURRENT_TIMESTAMP
    WHERE ee_id=OLD.ee_id AND periodo_id=OLD.periodo_id;
  END`);

  db.exec(`CREATE TRIGGER IF NOT EXISTS trg_ins_update AFTER UPDATE ON inscripciones BEGIN
    UPDATE estadisticas_ee_periodo SET 
      total_alumnos=total_alumnos+CASE WHEN NEW.activo=1 AND OLD.activo=0 THEN 1 WHEN NEW.activo=0 AND OLD.activo=1 THEN -1 ELSE 0 END,
      ultima_actualizacion=CURRENT_TIMESTAMP
    WHERE ee_id=NEW.ee_id AND periodo_id=NEW.periodo_id;
  END`);

  // 19. PLAN_PERIODO
  db.exec(`CREATE TABLE IF NOT EXISTS plan_periodo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    estado TEXT DEFAULT 'activo',
    FOREIGN KEY (plan_id) REFERENCES planes_estudio(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE RESTRICT,
    UNIQUE(plan_id, periodo_id)
  )`);

  // 20. AUDITORÍA RELACIONES
  db.exec(`CREATE TABLE IF NOT EXISTS auditoria_relaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    accion TEXT NOT NULL CHECK(accion IN ('crear','actualizar','eliminar')),
    tipo_relacion TEXT NOT NULL,
    entidad_a_id INTEGER,
    entidad_b_id INTEGER,
    periodo_id INTEGER,
    motivo TEXT,
    fecha_sistema DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
  )`);

  // 21. HORARIOS
  db.exec(`CREATE TABLE IF NOT EXISTS horarios_ee (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ee_id INTEGER NOT NULL,
    dia TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    aula TEXT,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE RESTRICT,
    UNIQUE(ee_id, dia, hora_inicio)
  )`);

  console.log('[DB] Esquema verificado ✅');
}

function seedData(db) {
  // Solo catálogos base, relaciones vacías para testing manual
  
  if (db.prepare('SELECT count(*) FROM usuarios').get()['count(*)'] === 0) {
    const s = db.prepare('INSERT INTO usuarios(username,password_hash,nombre_completo,rol)VALUES(?,?,?,?)');
    s.run('admin','admin','Administrador','administrador');
  }
  
  if (db.prepare('SELECT count(*) FROM docentes').get()['count(*)'] === 0) {
    const s = db.prepare('INSERT INTO docentes(codigo,apellido_paterno,nombres,tratamiento,articulo,estado)VALUES(?,?,?,?,?,?)');
    s.run('DOC-001','Perez','Juan','Dr.','El','activo');
    s.run('DOC-002','Lopez','Maria','Dra.','La','activo');
  }
  
  if (db.prepare('SELECT count(*) FROM periodos').get()['count(*)'] === 0) {
    const s = db.prepare('INSERT INTO periodos(clave,descripcion,fecha_inicio,fecha_fin,estado)VALUES(?,?,?,?,?)');
    s.run('FEB-JUL24','Feb-Jul 2024','2024-02-15','2024-07-31','cerrado');
    s.run('AGO-DIC24','Ago-Dic 2024','2024-08-01','2024-12-15','abierto');
  }
  
  if (db.prepare('SELECT count(*) FROM experiencias_educativas').get()['count(*)'] === 0) {
    const s = db.prepare('INSERT INTO experiencias_educativas(clave_ee,nombre,tipo,creditos,estado)VALUES(?,?,?,?,?)');
    s.run('EE-101','Programación I','Obligatoria',8,'activa');
    s.run('EE-102','Base de Datos','Obligatoria',8,'activa');
  }
  
  if (db.prepare('SELECT count(*) FROM alumnos').get()['count(*)'] === 0) {
    const s = db.prepare('INSERT INTO alumnos(matricula,apellido_paterno,nombres,estado)VALUES(?,?,?,?)');
    s.run('MAT-001','Garcia','Carlos','activo');
    s.run('MAT-002','Ruiz','Laura','activo');
  }
  
  console.log('[DB] Seed cargado (relaciones vacías para testing) ✅');
}

module.exports = { getDB };