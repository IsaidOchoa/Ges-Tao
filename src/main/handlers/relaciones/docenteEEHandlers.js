// src/main/handlers/docenteEEHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../../database');

module.exports = () => {
  
  // ✅ CORREGIDO: API síncrona con better-sqlite3
  
  // Obtener EE asignadas a un docente en un periodo
  ipcMain.handle('obtenerEEDelDocente', async (event, { docenteId, periodoId }) => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT e.id, e.clave_ee, e.nombre, a.carga_horaria, a.fecha_asignacion
        FROM docente_ee_asignacion a
        INNER JOIN experiencias_educativas e ON a.ee_id = e.id
        WHERE a.docente_id = ? AND a.periodo_id = ? AND a.estado = 'activo'
        ORDER BY e.clave_ee
      `).all(docenteId, periodoId);
      
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ Error obteniendo EE del docente:', error);
      return { success: false, error: error.message };
    }
  });

  // Listar EE disponibles para asignar
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

  // Asignar EE a docente
  ipcMain.handle('asignarEEAdocente', async (event, { docenteId, eeId, periodoId, cargaHoraria = 0 }) => {
    try {
      const db = getDB();
      
      // Verificar si ya existe
      const exists = db.prepare(`
        SELECT id FROM docente_ee_asignacion 
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ?
      `).get(docenteId, eeId, periodoId);
      
      if (exists) {
        return { success: false, error: 'La materia ya está asignada a este docente en este periodo' };
      }
      
      db.prepare(`
        INSERT INTO docente_ee_asignacion (docente_id, ee_id, periodo_id, carga_horaria, estado, fecha_asignacion)
        VALUES (?, ?, ?, ?, 'activo', datetime('now'))
      `).run(docenteId, eeId, periodoId, cargaHoraria);
      
      return { success: true, message: 'Materia asignada correctamente' };
    } catch (error) {
      console.error('❌ Error asignando EE:', error);
      return { success: false, error: error.message };
    }
  });

ipcMain.handle('removerDocenteEE', async (event, { docenteId, eeId, periodoId }) => {
  console.log(`🗑️ [BACKEND] removerDocenteEE: d=${docenteId}, ee=${eeId}, p=${periodoId}`);
  try {
    const db = getDB();
    const result = db.prepare(`
      UPDATE docente_ee_asignacion 
      SET estado = 'inactivo'
      WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'activo'
    `).run(docenteId, eeId, periodoId);
    
    if (result.changes === 0) {
      return { success: false, error: 'Asignación no encontrada' };
    }
    return { success: true, message: 'Asignación removida' };
  } catch (error) {
    console.error('❌ Error en removerDocenteEE:', error);
    return { success: false, error: error.message };
  }
});

  console.log('✅ [docenteEEHandlers] Handlers registrados');
};