// src/main/handlers/relacion/docenteEEHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../../database');

module.exports = () => {
  
  // ==========================================
  // 1. Obtener EE asignadas a un docente (SOLO activas)
  // ==========================================
  ipcMain.handle('obtenerEEDelDocente', async (event, { docenteId, periodoId }) => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT e.id, e.clave_ee, e.nombre, a.carga_horaria, a.fecha_asignacion
        FROM docente_ee_asignacion a
        INNER JOIN experiencias_educativas e ON a.ee_id = e.id
        WHERE a.docente_id = ? 
          AND a.periodo_id = ? 
          AND a.estado = 'activo'
          AND e.estado = 'activa'
        ORDER BY e.clave_ee
      `).all(docenteId, periodoId);
      
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ Error obteniendo EE del docente:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 2. Listar EE disponibles para asignar (EXCLUIR asignadas activas)
  // ==========================================
  ipcMain.handle('listarEEDisponibles', async (event, { periodoId, excludeAsignadasA = null }) => {
    try {
      const db = getDB();
      let query = `SELECT id, clave_ee, nombre, creditos FROM experiencias_educativas WHERE estado = 'activa'`;
      const params = [];
      
      if (excludeAsignadasA && periodoId) {
        query += ` AND id NOT IN (
          SELECT ee_id FROM docente_ee_asignacion 
          WHERE docente_id = ? AND periodo_id = ? AND estado = 'activo'
        )`;
        params.push(excludeAsignadasA, periodoId);
      }
      
      query += ' ORDER BY nombre';
      const rows = db.prepare(query).all(...params);
      
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ Error listando EE disponibles:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 3. Asignar EE a docente (VERIFICAR solo activas)
  // ==========================================
  ipcMain.handle('asignarEEAdocente', async (event, { docenteId, eeId, periodoId, cargaHoraria = 0 }) => {
    try {
      const db = getDB();
      
      const exists = db.prepare(`
        SELECT id FROM docente_ee_asignacion 
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'activo'
      `).get(docenteId, eeId, periodoId);
      
      if (exists) {
        return { success: false, error: 'La Experiencia Educativa ya está asignada activamente a este docente en este periodo' };
      }
      
      const inactiveRecord = db.prepare(`
        SELECT id FROM docente_ee_asignacion 
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'inactivo'
      `).get(docenteId, eeId, periodoId);
      
      if (inactiveRecord) {
        db.prepare(`
          UPDATE docente_ee_asignacion 
          SET estado = 'activo', carga_horaria = ?, fecha_asignacion = datetime('now')
          WHERE id = ?
        `).run(cargaHoraria, inactiveRecord.id);
        
        return { success: true, message: 'Experiencia Educativa re-asignada correctamente', action: 'reactivated' };
      }
      
      db.prepare(`
        INSERT INTO docente_ee_asignacion (docente_id, ee_id, periodo_id, carga_horaria, estado, fecha_asignacion)
        VALUES (?, ?, ?, ?, 'activo', datetime('now'))
      `).run(docenteId, eeId, periodoId, cargaHoraria);
      
      return { success: true, message: 'Experiencia Educativa asignada correctamente', action: 'inserted' };
      
    } catch (error) {
      console.error('❌ Error asignando EE:', error);
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Ya existe una asignación con estos parámetros. Verifica el estado.' };
      }
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 4. Remover EE de docente (Soft Delete)
  // ==========================================
  ipcMain.handle('removerDocenteEE', async (event, { docenteId, eeId, periodoId }) => {
    try {
      const db = getDB();
      const result = db.prepare(`
        UPDATE docente_ee_asignacion 
        SET estado = 'inactivo', fecha_desasignacion = datetime('now')
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'activo'
      `).run(docenteId, eeId, periodoId);
      
      if (result.changes === 0) {
        return { success: false, error: 'Asignación activa no encontrada. ¿Ya fue desasignada?' };
      }
      
      return { success: true, message: 'Asignación removida correctamente', changes: result.changes };
    } catch (error) {
      console.error('❌ Error en removerDocenteEE:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 5. Obtener el docente asignado a una EE (Contexto EE) [NUEVO]
  // ==========================================
  ipcMain.handle('obtenerDocenteDeEE', async (event, { eeId, periodoId }) => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT d.id, d.codigo, d.nombres, d.apellido_paterno, d.apellido_materno, d.tratamiento, d.correo_contacto as correo, a.carga_horaria
        FROM docentes d
        INNER JOIN docente_ee_asignacion a ON d.id = a.docente_id
        WHERE a.ee_id = ? AND a.periodo_id = ? AND a.estado = 'activo'
      `).all(eeId, periodoId);
      
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ Error obteniendo docente de EE:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 6. Actualizar carga horaria de la asignación (Edición inline) [NUEVO]
  // ==========================================
  ipcMain.handle('actualizarRelacionDocenteEE', async (event, { docenteId, eeId, periodoId, carga_horaria }) => {
    try {
      const db = getDB();
      const result = db.prepare(`
        UPDATE docente_ee_asignacion 
        SET carga_horaria = ?
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'activo'
      `).run(carga_horaria, docenteId, eeId, periodoId);
      
      return { success: true, changes: result.changes };
    } catch (error) {
      console.error('❌ Error actualizando relación docente-EE:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 7. Listar docentes para selects (Reutilizable) [NUEVO]
  // ==========================================
  ipcMain.handle('listarDocentesSelect', async (event, { periodoId, excludeIds = [] } = {}) => {
    try {
      const db = getDB();
      let query = `SELECT id, codigo, nombres, apellido_paterno, apellido_materno, tratamiento, correo_contacto as correo, estado FROM docentes WHERE estado = 'activo'`;
      const params = [];
      
      if (excludeIds && excludeIds.length > 0) {
        query += ` AND id NOT IN (${excludeIds.map(() => '?').join(',')})`;
        params.push(...excludeIds);
      }
      
      query += ' ORDER BY apellido_paterno, nombres';
      const rows = db.prepare(query).all(...params);
      
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ Error listando docentes para select:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ [docenteEEHandlers] Handlers registrados con consistencia de estado');
};