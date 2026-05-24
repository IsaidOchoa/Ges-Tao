// src/main/handlers/relacion/utils.js
const db = require('../../database').getDB();

module.exports = {
  
  // Validar que una entidad existe
  async entityExists(table, id, field = 'id') {
    const result = await db.get(`SELECT ${field} FROM ${table} WHERE ${field} = ?`, [id]);
    return !!result;
  },
  
  // Listar periodos (reutilizable en cualquier relación)
  async listarPeriodos() {
    return await db.all(`
      SELECT id, clave, descripcion, estado, fecha_inicio
      FROM periodos 
      ORDER BY fecha_inicio DESC
    `);
  },
  
  // Listar docentes activos (con filtro opcional)
  async listarDocentes({ excludeIds = [], periodoId = null } = {}) {
    let query = `SELECT id, codigo, nombres, apellido_paterno, estado FROM docentes WHERE estado = 'activo'`;
    const params = [];
    
    if (excludeIds.length > 0) {
      query += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`;
      params.push(...excludeIds);
    }
    
    query += ' ORDER BY apellido_paterno, nombres';
    return await db.all(query, params);
  },
  
  // Listar alumnos activos (con filtro opcional)
  async listarAlumnos({ excludeIds = [], periodoId = null } = {}) {
    let query = `SELECT id, matricula, nombres, apellido_paterno, apellido_materno, correo_contacto, estado FROM alumnos WHERE estado = 'activo'`;
    const params = [];
    
    if (excludeIds.length > 0) {
      query += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`;
      params.push(...excludeIds);
    }
    
    query += ' ORDER BY apellido_paterno, nombres';
    return await db.all(query, params);
  },
  
  // Registrar auditoría de relación (reutilizable)
  async registrarAuditoria({ usuarioId, accion, tipoRelacion, entidadA, entidadB, periodoId, motivo }) {
    try {
      await db.run(`
        INSERT INTO auditoria_relaciones 
        (usuario_id, accion, tipo_relacion, entidad_a_id, entidad_b_id, periodo_id, motivo, fecha_sistema)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        usuarioId || null,
        accion,
        tipoRelacion,
        entidadA?.id || null,
        entidadB?.id || null,
        periodoId || null,
        motivo || null
      ]);
    } catch (e) {
      console.warn(' No se pudo registrar auditoría:', e.message);
    }
  }
};