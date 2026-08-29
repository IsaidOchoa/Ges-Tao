const { app } = require("electron");
const path = require("node:path");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");

let dbInstance = null;

// ============================================================
// VERSIONADO (punto 12: identificadores que no deben confundirse)
// ============================================================
const SCHEMA_VERSION = 1;          // versión de la estructura de la BD
const SYNC_PROTOCOL_VERSION = 1;   // versión del protocolo de sincronización

// ============================================================
// UTILIDADES
// ============================================================

/**
 * Genera un ID global único compuesto:
 * prefijo (8 chars del hash SHA-256 de installation_id) + UUID v4
 */
function generarIdGlobal(installationId) {
  const prefijo = crypto
    .createHash("sha256")
    .update(installationId)
    .digest("hex")
    .slice(0, 8);
  return `${prefijo}-${crypto.randomUUID()}`;
}

/**
 * Obtiene o crea la identidad única de esta instalación.
 * IMPORTANTE: actualizar Gestao NO regenera el installation_id.
 */
function obtenerOCrearInstallation(db) {
  const row = db
    .prepare("SELECT installation_id FROM installation WHERE id = 1")
    .get();
  if (row) return row.installation_id;

  const newId = crypto.randomUUID();
  db.prepare(`INSERT INTO installation
    (id, installation_id, nombre, app_version, schema_version, sync_protocol_version)
    VALUES (1, ?, ?, ?, ?, ?)`)
    .run(newId, "Instalación Ges-TAO", app.getVersion(), SCHEMA_VERSION, SYNC_PROTOCOL_VERSION);

  console.log(`[DB] Installation creada: ${newId}`);
  return newId;
}

/**
 * Actualiza versiones sin tocar installation_id (identidad permanente).
 */
function actualizarVersionesInstallation(db) {
  db.prepare(`UPDATE installation
    SET app_version = ?, schema_version = ?, sync_protocol_version = ?
    WHERE id = 1`)
    .run(app.getVersion(), SCHEMA_VERSION, SYNC_PROTOCOL_VERSION);
}

// ============================================================
// INICIALIZACIÓN
// ============================================================

function getDB() {
  if (dbInstance) return dbInstance;
  try {
    const dbPath = path.join(app.getPath("userData"), "ges-tao.db");
    console.log(`[DB] Ruta: ${dbPath}`);
    dbInstance = new Database(dbPath);
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.pragma("foreign_keys = ON");

    initSchema(dbInstance);
    obtenerOCrearInstallation(dbInstance);
    actualizarVersionesInstallation(dbInstance);
    instalarTriggersCaptura(dbInstance);
    seedData(dbInstance);

    console.log("[DB] Sistema listo.");
    return dbInstance;
  } catch (error) {
    console.error("[DB] Error crítico:", error);
    throw error;
  }
}

// ============================================================
// ESQUEMA - CAPA FUNCIONAL
// ============================================================

function initSchema(db) {
  console.log("[DB] Verificando esquema...");

  // 1. USUARIOS (local, NO sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    rol TEXT NOT NULL CHECK(rol IN ('coordinadora','administrativo','administrador','invitado')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 2. DOCENTES (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS docentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
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
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docentes_id_global ON docentes(id_global)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docentes_codigo ON docentes(codigo)`);

  // 3. PERIODOS (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS periodos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    clave TEXT UNIQUE NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','inactivo')),
    es_vigente_forzado INTEGER DEFAULT 0 CHECK(es_vigente_forzado IN (0,1)),
    ano_inicio INTEGER GENERATED ALWAYS AS (CAST(strftime('%Y',fecha_inicio) AS INTEGER)) VIRTUAL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_periodos_id_global ON periodos(id_global)`);

  // 4. SEMESTRES (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS semestres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    clave TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    orden INTEGER UNIQUE CHECK(orden BETWEEN 1 AND 14),
    estado TEXT DEFAULT 'activo',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_semestres_id_global ON semestres(id_global)`);

  // 5. PLANES DE ESTUDIO (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS planes_estudio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    clave TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    nivel TEXT CHECK(nivel IN ('licenciatura','maestria','doctorado','especialidad')),
    estado TEXT DEFAULT 'activo',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_planes_id_global ON planes_estudio(id_global)`);

  // 6. EXPERIENCIAS EDUCATIVAS (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS experiencias_educativas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    clave_ee TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    tipo TEXT,
    creditos INTEGER DEFAULT 0,
    creditos_teoria INTEGER DEFAULT 0,
    creditos_practica INTEGER DEFAULT 0,
    creditos_otros INTEGER DEFAULT 0,
    horas_teoria INTEGER DEFAULT 0,
    horas_practica INTEGER DEFAULT 0,
    area TEXT,
    linea_investigacion TEXT,
    programa_academico TEXT,
    nrc TEXT UNIQUE,
    estado TEXT DEFAULT 'activa',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_ee_id_global ON experiencias_educativas(id_global)`);

  // 7. MALLA CURRICULAR (sincronizable como relación)
  db.exec(`CREATE TABLE IF NOT EXISTS malla_curricular (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    plan_id INTEGER,
    ee_id INTEGER NOT NULL,
    semestre_id INTEGER,
    creditos_asignados INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'activo',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES planes_estudio(id) ON DELETE RESTRICT,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE RESTRICT,
    FOREIGN KEY (semestre_id) REFERENCES semestres(id) ON DELETE RESTRICT,
    UNIQUE(ee_id, plan_id)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_malla_id_global ON malla_curricular(id_global)`);

  // 8. PROGRAMAS INSTITUCIONALES (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS programas_institucionales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    responsable TEXT,
    estado TEXT DEFAULT 'vigente',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_programas_id_global ON programas_institucionales(id_global)`);

  // 9. TIPOS CONSTANCIA (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS tipos_constancia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    clave TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    requiere_ee INTEGER DEFAULT 0,
    requiere_periodo INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'activo',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tipos_id_global ON tipos_constancia(id_global)`);

  // 10. FORMATOS CONSTANCIA (configuración; el HTML vive en archivos)
  db.exec(`CREATE TABLE IF NOT EXISTS formatos_constancia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    tipo_constancia_id INTEGER NOT NULL,
    version_formato INTEGER NOT NULL DEFAULT 1,
    nombre_version TEXT NOT NULL,
    plantilla_archivo TEXT NOT NULL,
    logotipo_recurso_id INTEGER,
    fecha_vigencia_desde DATE DEFAULT (date('now')),
    fecha_vigencia_hasta DATE,
    es_actual INTEGER DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (tipo_constancia_id) REFERENCES tipos_constancia(id) ON DELETE CASCADE,
    UNIQUE(tipo_constancia_id, version_formato)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_formatos_id_global ON formatos_constancia(id_global)`);

  // 11. CONSTANCIAS (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS constancias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    folio TEXT NOT NULL,
    space_gid TEXT,
    docente_id INTEGER NOT NULL,
    periodo_id INTEGER,
    ee_id INTEGER,
    programa_id INTEGER NOT NULL,
    tipo_constancia_id INTEGER NOT NULL,
    formato_version INTEGER DEFAULT 1,
    fecha_emision DATE DEFAULT (date('now')),
    ruta_archivo TEXT,
    config_emision TEXT,
    estado TEXT DEFAULT 'emitida',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE RESTRICT,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE RESTRICT,
    FOREIGN KEY (programa_id) REFERENCES programas_institucionales(id) ON DELETE RESTRICT,
    FOREIGN KEY (tipo_constancia_id) REFERENCES tipos_constancia(id) ON DELETE RESTRICT,
    UNIQUE(folio, space_gid)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_constancias_id_global ON constancias(id_global)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_constancias_folio ON constancias(folio)`);

  // 12. FIRMANTES (catálogo reutilizable, texto plano, sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS firmantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    texto TEXT UNIQUE NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_firmantes_id_global ON firmantes(id_global)`);

  // 13. RECURSOS COMPARTIBLES (identidad por id_global/hash; ruta_local solo ubicación)
  db.exec(`CREATE TABLE IF NOT EXISTS recursos_compartibles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    categoria TEXT NOT NULL DEFAULT 'logotipo',
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    hash_sha256 TEXT NOT NULL,
    ruta_local TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_recursos_id_global ON recursos_compartibles(id_global)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_recursos_hash ON recursos_compartibles(hash_sha256)`);

  // 14. FORMATO FIRMAS (relación formato ↔ firmantes, sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS formato_firmas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    formato_id INTEGER NOT NULL REFERENCES formatos_constancia(id) ON DELETE CASCADE,
    firmante_id INTEGER NOT NULL REFERENCES firmantes(id) ON DELETE RESTRICT,
    orden INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(formato_id, orden)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_formato_firmas_id_global ON formato_firmas(id_global)`);

  // 15. TEXTOS PLANTILLA (defaults globales, sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS textos_plantilla (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    clave TEXT UNIQUE NOT NULL,
    texto TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_textos_id_global ON textos_plantilla(id_global)`);

  // 16. CONSTANCIA FIRMAS (histórico, snapshot, sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS constancia_firmas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    constancia_id INTEGER NOT NULL REFERENCES constancias(id) ON DELETE CASCADE,
    orden INTEGER NOT NULL,
    firmante_id INTEGER REFERENCES firmantes(id) ON DELETE SET NULL,
    texto_firma TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_constancia_firmas_id_global ON constancia_firmas(id_global)`);

  // 17. HISTORIAL (local, NO sincronizable)
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

  // 18. ALUMNOS (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS alumnos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
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
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (generacion_id) REFERENCES generaciones(id) ON DELETE RESTRICT
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alumnos_id_global ON alumnos(id_global)`);

  // 19. GENERACIONES (sincronizable + soft delete)
  db.exec(`CREATE TABLE IF NOT EXISTS generaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    plan_id INTEGER,
    periodo_ingreso_id INTEGER,
    clave TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    estado TEXT DEFAULT 'activa',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (plan_id) REFERENCES planes_estudio(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_ingreso_id) REFERENCES periodos(id) ON DELETE RESTRICT
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_generaciones_id_global ON generaciones(id_global)`);

  // 20. TUTOR_ALUMNO (relación sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS tutor_alumno (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    docente_id INTEGER NOT NULL,
    alumno_id INTEGER NOT NULL,
    periodo_id INTEGER,
    fecha_asignacion DATE DEFAULT (date('now')),
    fecha_baja DATE,
    estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','inactivo')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE RESTRICT,
    FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE SET NULL
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tutor_id_global ON tutor_alumno(id_global)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_unique ON tutor_alumno(docente_id, alumno_id) WHERE estado='activo'`);

  // 21. DOCENTE_EE_ASIGNACION (relación sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS docente_ee_asignacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    docente_id INTEGER NOT NULL,
    ee_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    carga_horaria INTEGER DEFAULT 0,
    fecha_asignacion DATE DEFAULT (date('now')),
    fecha_desasignacion DATE,
    estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','inactivo')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (docente_id) REFERENCES docentes(id) ON DELETE RESTRICT,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE RESTRICT,
    UNIQUE(docente_id, ee_id, periodo_id)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_docente_ee_id_global ON docente_ee_asignacion(id_global)`);

  // 22. INSCRIPCIONES (relación sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS inscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    alumno_id INTEGER NOT NULL,
    ee_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    fecha_asignacion DATE DEFAULT (date('now')),
    fecha_baja DATE,
    activo INTEGER DEFAULT 1,
    asignado_por INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alumno_id) REFERENCES alumnos(id) ON DELETE RESTRICT,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE RESTRICT,
    FOREIGN KEY (asignado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    UNIQUE(alumno_id, ee_id, periodo_id)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inscripciones_id_global ON inscripciones(id_global)`);

  // 23. ESTADISTICAS (sincronizable, sin triggers de negocio)
  db.exec(`CREATE TABLE IF NOT EXISTS estadisticas_ee_periodo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    ee_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    total_alumnos INTEGER DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ee_id) REFERENCES experiencias_educativas(id) ON DELETE CASCADE,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE CASCADE,
    UNIQUE(ee_id, periodo_id)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_estadisticas_id_global ON estadisticas_ee_periodo(id_global)`);

  // 24. PLAN PERIODO (relación sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS plan_periodo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    plan_id INTEGER NOT NULL,
    periodo_id INTEGER NOT NULL,
    estado TEXT DEFAULT 'activo',
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES planes_estudio(id) ON DELETE RESTRICT,
    FOREIGN KEY (periodo_id) REFERENCES periodos(id) ON DELETE RESTRICT,
    UNIQUE(plan_id, periodo_id)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_plan_periodo_id_global ON plan_periodo(id_global)`);

  // 25. AUDITORIA RELACIONES (local, NO sincronizable)
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

  // 26. HORARIOS (local, NO sincronizable por ahora)
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

  // 27. ENTITY PERIOD (relación sincronizable)
  db.exec(`CREATE TABLE IF NOT EXISTS entity_period (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('docente', 'alumno', 'ee')),
    entity_id INTEGER NOT NULL,
    period_id INTEGER NOT NULL,
    fecha_vinculacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (period_id) REFERENCES periodos(id) ON DELETE CASCADE,
    UNIQUE(entity_type, entity_id, period_id)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_period_id_global ON entity_period(id_global)`);

  // 28. CONTADORES FOLIO (folio continuo por espacio)
  db.exec(`CREATE TABLE IF NOT EXISTS contadores_folio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_global TEXT NOT NULL UNIQUE,
    space_gid TEXT,
    ano INTEGER NOT NULL,
    siguiente INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(space_gid, ano)
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_contadores_id_global ON contadores_folio(id_global)`);

  // ============================================================
  // CAPA DE SINCRONIZACIÓN
  // ============================================================

  // S1. INSTALLATION (identidad permanente + versionado)
  db.exec(`CREATE TABLE IF NOT EXISTS installation (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    installation_id TEXT NOT NULL UNIQUE,
    nombre TEXT,
    app_version TEXT,
    schema_version INTEGER NOT NULL DEFAULT 1,
    sync_protocol_version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
  )`);

  // S2. CHANGE LOG (registro general de cambios)
  db.exec(`CREATE TABLE IF NOT EXISTS change_log (
    change_id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_uuid TEXT NOT NULL UNIQUE,
    installation_id TEXT NOT NULL,
    actor_name TEXT,
    space_gid TEXT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entity_type TEXT NOT NULL,
    entity_id_global TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('CREATE','UPDATE','DELETE')),
    data TEXT,
    version INTEGER,
    origen TEXT NOT NULL DEFAULT 'local' CHECK(origen IN ('local','recibido')),
    status TEXT DEFAULT 'pendiente'
      CHECK(status IN ('pendiente','sincronizado','rechazado','conflicto','incompatible')),
    recibido_en DATETIME,
    synced_at DATETIME
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_change_pending ON change_log(status, timestamp)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_change_entity ON change_log(entity_type, entity_id_global)`);

  // S3. SYNC CONTROL (anti-bucles, espacio activo, actor activo)
  db.exec(`CREATE TABLE IF NOT EXISTS sync_control (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    suprimir_captura INTEGER NOT NULL DEFAULT 0 CHECK(suprimir_captura IN (0,1)),
    space_gid_activo TEXT,
    actor_name_activo TEXT
  )`);
  db.exec(`INSERT OR IGNORE INTO sync_control (id, suprimir_captura) VALUES (1, 0)`);

  // S4. SYNC INBOX (paquetes recibidos no aplicables aún; conservar sin destruir)
  db.exec(`CREATE TABLE IF NOT EXISTS sync_inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    space_gid TEXT,
    origen_installation_id TEXT NOT NULL,
    origen_app_version TEXT,
    origen_schema_version INTEGER,
    protocol_version INTEGER NOT NULL,
    ruta_paquete TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'incompatible'
      CHECK(estado IN ('pendiente','incompatible','aplicado','descartado')),
    recibido_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    procesado_en DATETIME
  )`);

  // S5. COLLAB SPACES (espacios de colaboración + snapshot inicial)
  db.exec(`CREATE TABLE IF NOT EXISTS collab_spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    space_gid TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    creado_por_installation TEXT NOT NULL,
    invitacion_codigo TEXT,
    invitacion_expira DATETIME,
    config TEXT,
    snapshot_ruta TEXT,
    snapshot_generado_en DATETIME,
    estado TEXT DEFAULT 'activo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // S6. SPACE MEMBERS (miembros de espacios)
  db.exec(`CREATE TABLE IF NOT EXISTS space_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    space_gid TEXT NOT NULL,
    installation_id TEXT NOT NULL,
    rol TEXT DEFAULT 'miembro' CHECK(rol IN ('propietario','miembro')),
    estado TEXT DEFAULT 'activo' CHECK(estado IN ('activo','salido','expulsado')),
    unido_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    salido_en DATETIME,
    UNIQUE(space_gid, installation_id)
  )`);

  // S7. SYNC PEERS (instalaciones conocidas)
  db.exec(`CREATE TABLE IF NOT EXISTS sync_peers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    peer_installation_id TEXT NOT NULL UNIQUE,
    peer_name TEXT,
    endpoint TEXT,
    trusted INTEGER DEFAULT 0 CHECK(trusted IN (0,1)),
    shared_spaces TEXT,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // S8. SYNC STATE (estado de sincronización)
  db.exec(`CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    space_gid TEXT NOT NULL,
    peer_installation_id TEXT NOT NULL,
    direccion TEXT NOT NULL CHECK(direccion IN ('enviado','recibido')),
    last_change_id INTEGER,
    last_change_uuid TEXT,
    last_sync_at DATETIME,
    UNIQUE(space_gid, peer_installation_id, direccion)
  )`);

  console.log("[DB] Esquema verificado ✅");
}

// ============================================================
// GENERADOR AUTOMÁTICO DE TRIGGERS DE CAPTURA
// - DROP + CREATE en cada arranque (esquema siempre vigente)
// - suprimir_captura evita bucles de sincronización 
// ============================================================

function instalarTriggersCaptura(db) {
  console.log("[DB] Instalando triggers de captura...");

  const TABLAS_SINCRONIZABLES = [
    { nombre: "docentes", softDelete: true,
      columnas: ["codigo","nombres","apellido_paterno","apellido_materno","tratamiento","articulo","nivel_academico","correo_contacto","estado"] },
    { nombre: "periodos", softDelete: true,
      columnas: ["clave","descripcion","fecha_inicio","fecha_fin","estado"] },
    { nombre: "experiencias_educativas", softDelete: true,
      columnas: ["clave_ee","nombre","tipo","creditos","horas_teoria","horas_practica","nrc","estado"] },
    { nombre: "programas_institucionales", softDelete: true,
      columnas: ["nombre","descripcion","responsable","estado"] },
    { nombre: "tipos_constancia", softDelete: true,
      columnas: ["clave","nombre","descripcion","requiere_ee","requiere_periodo","estado"] },
    { nombre: "firmantes", softDelete: true, columnas: ["texto"] },
    { nombre: "recursos_compartibles", softDelete: true,
      columnas: ["nombre","categoria","mime_type","size_bytes","hash_sha256","ruta_local"] },
    { nombre: "formatos_constancia", softDelete: true,
      columnas: ["tipo_constancia_id","version_formato","nombre_version","plantilla_archivo","logotipo_recurso_id","es_actual"] },
    { nombre: "constancias", softDelete: true,
      columnas: ["folio","space_gid","docente_id","periodo_id","ee_id","programa_id","tipo_constancia_id","fecha_emision","estado"] },
    { nombre: "constancia_firmas", softDelete: false,
      columnas: ["constancia_id","orden","firmante_id","texto_firma"] },
    { nombre: "docente_ee_asignacion", softDelete: false,
      columnas: ["docente_id","ee_id","periodo_id","carga_horaria","estado"] },
    { nombre: "tutor_alumno", softDelete: false,
      columnas: ["docente_id","alumno_id","periodo_id","estado"] },
    { nombre: "estadisticas_ee_periodo", softDelete: false,
      columnas: ["ee_id","periodo_id","total_alumnos"] },
    { nombre: "contadores_folio", softDelete: false,
      columnas: ["space_gid","ano","siguiente"] }
  ];

  const installationId = obtenerOCrearInstallation(db);
  const SUP = `(SELECT suprimir_captura FROM sync_control WHERE id = 1)`;
  const SPACE = `(SELECT space_gid_activo FROM sync_control WHERE id = 1)`;
  const ACTOR = `(SELECT actor_name_activo FROM sync_control WHERE id = 1)`;

  TABLAS_SINCRONIZABLES.forEach(({ nombre, columnas, softDelete }) => {
    const jsonCols = columnas.map((c) => `'${c}', NEW.${c}`).join(", ");

    // INSERT - CORREGIDO: FOR EACH ROW antes de WHEN
    db.exec(`DROP TRIGGER IF EXISTS trg_${nombre}_insert_log`);
    db.exec(`
      CREATE TRIGGER trg_${nombre}_insert_log
      AFTER INSERT ON ${nombre}
      FOR EACH ROW
      WHEN ${SUP} = 0
      BEGIN
        INSERT INTO change_log (change_uuid, installation_id, actor_name, space_gid,
                                entity_type, entity_id_global, operation, data, version, origen)
        VALUES (lower(hex(randomblob(16))), '${installationId}', ${ACTOR}, ${SPACE},
                '${nombre}', NEW.id_global, 'CREATE', json_object(${jsonCols}), 1, 'local');
      END;
    `);

    // UPDATE - CORREGIDO: FOR EACH ROW antes de WHEN
    db.exec(`DROP TRIGGER IF EXISTS trg_${nombre}_update_log`);
    db.exec(`
      CREATE TRIGGER trg_${nombre}_update_log
      AFTER UPDATE ON ${nombre}
      FOR EACH ROW
      WHEN ${SUP} = 0 AND NEW.updated_at != OLD.updated_at
      BEGIN
        INSERT INTO change_log (change_uuid, installation_id, actor_name, space_gid,
                                entity_type, entity_id_global, operation, data, version, origen)
        VALUES (lower(hex(randomblob(16))), '${installationId}', ${ACTOR}, ${SPACE},
                '${nombre}', NEW.id_global, 'UPDATE', json_object(${jsonCols}), NEW.version, 'local');
      END;
    `);

    // DELETE (lógico o físico según la tabla) - CORREGIDO: FOR EACH ROW antes de WHEN
    db.exec(`DROP TRIGGER IF EXISTS trg_${nombre}_delete_log`);
    if (softDelete) {
      db.exec(`
        CREATE TRIGGER trg_${nombre}_delete_log
        AFTER UPDATE OF deleted_at ON ${nombre}
        FOR EACH ROW
        WHEN ${SUP} = 0 AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
        BEGIN
          INSERT INTO change_log (change_uuid, installation_id, actor_name, space_gid,
                                  entity_type, entity_id_global, operation, data, version, origen)
          VALUES (lower(hex(randomblob(16))), '${installationId}', ${ACTOR}, ${SPACE},
                  '${nombre}', NEW.id_global, 'DELETE', null, NEW.version, 'local');
        END;
      `);
    } else {
      db.exec(`
        CREATE TRIGGER trg_${nombre}_delete_log
        AFTER DELETE ON ${nombre}
        FOR EACH ROW
        WHEN ${SUP} = 0
        BEGIN
          INSERT INTO change_log (change_uuid, installation_id, actor_name, space_gid,
                                  entity_type, entity_id_global, operation, data, version, origen)
          VALUES (lower(hex(randomblob(16))), '${installationId}', ${ACTOR}, ${SPACE},
                  '${nombre}', OLD.id_global, 'DELETE', null, OLD.version, 'local');
        END;
      `);
    }
  });

  console.log(`[DB] Triggers instalados para ${TABLAS_SINCRONIZABLES.length} tablas ✅`);
}

// ============================================================
// SEEDS
// ============================================================

function seedData(db) {
  const installationId = obtenerOCrearInstallation(db);
  console.log("[DB] Cargando seeds...");

  // 1. USUARIOS
  if (db.prepare("SELECT count(*) as c FROM usuarios").get().c === 0) {
    db.prepare("INSERT INTO usuarios(username,password_hash,nombre_completo,rol)VALUES(?,?,?,?)")
      .run("admin", "admin", "Administrador", "administrador");
  }

  // 2. DOCENTES
  if (db.prepare("SELECT count(*) as c FROM docentes").get().c === 0) {
    const s = db.prepare("INSERT INTO docentes(id_global,codigo,apellido_paterno,nombres,tratamiento,articulo,estado)VALUES(?,?,?,?,?,?,?)");
    s.run(generarIdGlobal(installationId), "DOC-001", "Perez", "Juan", "Dr.", "El", "activo");
    s.run(generarIdGlobal(installationId), "DOC-002", "Lopez", "Maria", "Dra.", "La", "activo");
  }

  // 3. PERIODOS
  if (db.prepare("SELECT count(*) as c FROM periodos").get().c === 0) {
    const s = db.prepare("INSERT INTO periodos(id_global,clave,descripcion,fecha_inicio,fecha_fin,estado)VALUES(?,?,?,?,?,?)");
    s.run(generarIdGlobal(installationId), "FEB-JUL24", "Feb-Jul 2024", "2024-02-15", "2024-07-31", "inactivo");
    s.run(generarIdGlobal(installationId), "AGO-DIC24", "Ago-Dic 2024", "2024-08-01", "2024-12-15", "activo");
    s.run(generarIdGlobal(installationId), "ENE-JUN25", "Ene-Jun 2025", "2025-01-15", "2025-06-30", "activo");
  }

  // 4. PROGRAMAS INSTITUCIONALES
  if (db.prepare("SELECT count(*) as c FROM programas_institucionales").get().c === 0) {
    const s = db.prepare("INSERT INTO programas_institucionales(id_global,nombre,descripcion,responsable,estado)VALUES(?,?,?,?,?)");
    s.run(generarIdGlobal(installationId), "PRODEV", "Programa de Desarrollo Profesional Docente", "Coordinación de formación", "vigente");
    s.run(generarIdGlobal(installationId), "SNII", "Sistema Nacional de Investigadores", "Gestión de reconocimientos", "vigente");
  }

  // 5. TIPOS DE CONSTANCIA
  if (db.prepare("SELECT count(*) as c FROM tipos_constancia").get().c === 0) {
    const s = db.prepare("INSERT INTO tipos_constancia(id_global,clave,nombre,descripcion,requiere_ee,requiere_periodo,estado)VALUES(?,?,?,?,?,?,?)");
    s.run(generarIdGlobal(installationId), "EE",  "Constancia de impartición de Experiencia Educativa", "Acredita impartición de materia", 1, 1, "activo");
    s.run(generarIdGlobal(installationId), "DT",  "Constancia de dirección/codirección de tesis/trabajo recepcional", "Acredita dirección de trabajos", 0, 0, "activo");
    s.run(generarIdGlobal(installationId), "JE",  "Constancia participación Sinodal/jurado de examen profesional", "Acredita jurados de examen", 0, 1, "activo");
    s.run(generarIdGlobal(installationId), "SNP", "Constancia de evaluación SNP", "Evaluación Sistema Nacional de Posgrados", 0, 0, "activo");
    s.run(generarIdGlobal(installationId), "EV",  "Constancia de eventos académicos", "Congresos, seminarios, talleres", 0, 1, "activo");
    s.run(generarIdGlobal(installationId), "TUT", "Constancia de tutorías académica", "Función como tutor de alumnos", 0, 1, "activo");
    s.run(generarIdGlobal(installationId), "CAP", "Constancia de comité de admisión al posgrado", "Procesos de selección", 0, 1, "activo");
    s.run(generarIdGlobal(installationId), "DDT", "Constancia de designación de directora o codirectora de tesis", "Asignación administrativa", 0, 0, "activo");
    s.run(generarIdGlobal(installationId), "DTA", "Constancia de designación de tutor académico", "Asignación formal", 0, 1, "activo");
    s.run(generarIdGlobal(installationId), "DJG", "Constancia de designación de jurado de examen de grado", "Nombramiento para jurados", 0, 1, "activo");
    s.run(generarIdGlobal(installationId), "PE",  "Constancia de elaboración, participación y/o actualización de planes de estudios", "Diseño curricular", 0, 0, "activo");
    s.run(generarIdGlobal(installationId), "NAB", "Constancia que acredita ser miembro del Núcleo Académico Básico (NAB)", "Membresía posgrado", 0, 1, "activo");
    s.run(generarIdGlobal(installationId), "CA",  "Constancia que acredita ser miembro del Comité Académico (CA)", "Membresía comité", 0, 1, "activo");
  }

  // 6. EXPERIENCIAS EDUCATIVAS
  if (db.prepare("SELECT count(*) as c FROM experiencias_educativas").get().c === 0) {
    const s = db.prepare("INSERT INTO experiencias_educativas(id_global,clave_ee,nombre,tipo,creditos,estado)VALUES(?,?,?,?,?,?)");
    s.run(generarIdGlobal(installationId), "34563", "Programación I", "Obligatoria", 8, "activa");
    s.run(generarIdGlobal(installationId), "09384", "Base de Datos", "Obligatoria", 8, "activa");
    s.run(generarIdGlobal(installationId), "12345", "Estadística Avanzada", "Especialidad", 10, "activa");
  }

  // 7. ALUMNOS
  if (db.prepare("SELECT count(*) as c FROM alumnos").get().c === 0) {
    const s = db.prepare("INSERT INTO alumnos(id_global,matricula,apellido_paterno,nombres,estado)VALUES(?,?,?,?,?)");
    s.run(generarIdGlobal(installationId), "MAT-001", "Garcia", "Carlos", "activo");
    s.run(generarIdGlobal(installationId), "MAT-002", "Ruiz", "Laura", "activo");
  }

  // 8. FIRMANTES (catálogo de texto plano)
  if (db.prepare("SELECT count(*) as c FROM firmantes").get().c === 0) {
    const s = db.prepare("INSERT INTO firmantes(id_global,texto)VALUES(?,?)");
    s.run(generarIdGlobal(installationId), "Dr. Juan Pérez — Director de la Facultad");
    s.run(generarIdGlobal(installationId), "Mtra. María López — Secretaria Académica");
    s.run(generarIdGlobal(installationId), "Dr. Carlos Ruiz — Coordinador de Posgrado");
    s.run(generarIdGlobal(installationId), "Lic. Ana García — Administradora");
  }

  // 9. TEXTOS PLANTILLA (defaults globales)
  if (db.prepare("SELECT count(*) as c FROM textos_plantilla").get().c === 0) {
    const s = db.prepare("INSERT INTO textos_plantilla(id_global,clave,texto)VALUES(?,?,?)");
    s.run(generarIdGlobal(installationId), "saludo", "A quien corresponda,");
    s.run(generarIdGlobal(installationId), "mencion_final", "Para los fines que al interesado convenga se extiende la presente");
  }

  // 10. FORMATOS CONSTANCIA (configuración; el HTML vive en archivos)
  if (db.prepare("SELECT count(*) as c FROM formatos_constancia").get().c === 0) {
    const tipoEE  = db.prepare("SELECT id FROM tipos_constancia WHERE clave = 'EE'").get();
    const tipoTUT = db.prepare("SELECT id FROM tipos_constancia WHERE clave = 'TUT'").get();
    const tipoEV  = db.prepare("SELECT id FROM tipos_constancia WHERE clave = 'EV'").get();

    const s = db.prepare(`INSERT INTO formatos_constancia
      (id_global, tipo_constancia_id, version_formato, nombre_version, plantilla_archivo, es_actual)
      VALUES (?,?,?,?,?,1)`);
    s.run(generarIdGlobal(installationId), tipoEE.id,  1, "v1.0 EE",  "constancia-ee.html");
    s.run(generarIdGlobal(installationId), tipoTUT.id, 1, "v1.0 TUT", "constancia-tut.html");
    s.run(generarIdGlobal(installationId), tipoEV.id,  1, "v1.0 EV",  "constancia-ev.html");

    // Firmas por defecto de cada formato (el orden define aparición en el documento)
    const firmantes = db.prepare("SELECT id FROM firmantes ORDER BY id").all();
    const sf = db.prepare(`INSERT INTO formato_firmas (id_global, formato_id, firmante_id, orden) VALUES (?,?,?,?)`);

    const fmtEE  = db.prepare("SELECT id FROM formatos_constancia WHERE tipo_constancia_id = ?").get(tipoEE.id);
    const fmtTUT = db.prepare("SELECT id FROM formatos_constancia WHERE tipo_constancia_id = ?").get(tipoTUT.id);
    const fmtEV  = db.prepare("SELECT id FROM formatos_constancia WHERE tipo_constancia_id = ?").get(tipoEV.id);

    sf.run(generarIdGlobal(installationId), fmtEE.id,  firmantes[2].id, 1);
    sf.run(generarIdGlobal(installationId), fmtEE.id,  firmantes[0].id, 2);
    sf.run(generarIdGlobal(installationId), fmtTUT.id, firmantes[2].id, 1);
    sf.run(generarIdGlobal(installationId), fmtEV.id,  firmantes[1].id, 1);
    sf.run(generarIdGlobal(installationId), fmtEV.id,  firmantes[0].id, 2);
  }

  console.log("[DB] Seeds cargados ✅");
}

module.exports = { getDB, generarIdGlobal };