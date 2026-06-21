// src/main/handlers/docenteEEHandlers.js
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
          AND a.estado = 'activo'  -- ✅ Filtrar solo activas
          AND e.estado = 'activa'   -- ✅ Y que la EE también esté activa
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
        // ✅ CORRECCIÓN: Excluir SOLO las asignaciones activas
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
      
      // ✅ CORRECCIÓN PRINCIPAL: Verificar SOLO asignaciones activas
      const exists = db.prepare(`
        SELECT id FROM docente_ee_asignacion 
        WHERE docente_id = ? 
          AND ee_id = ? 
          AND periodo_id = ? 
          AND estado = 'activo'  -- 🔹 ¡ESTO FALTABA!
      `).get(docenteId, eeId, periodoId);
      
      if (exists) {
        return { 
          success: false, 
          error: 'La materia ya está asignada activamente a este docente en este periodo' 
        };
      }
      
      // 🔹 Verificar si existe un registro inactivo para reactivarlo (optimización)
      const inactiveRecord = db.prepare(`
        SELECT id FROM docente_ee_asignacion 
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'inactivo'
      `).get(docenteId, eeId, periodoId);
      
      if (inactiveRecord) {
        // Reactivar registro existente en lugar de crear uno nuevo
        db.prepare(`
          UPDATE docente_ee_asignacion 
          SET estado = 'activo', 
              carga_horaria = ?,
              fecha_asignacion = datetime('now')
          WHERE id = ?
        `).run(cargaHoraria, inactiveRecord.id);
        
        return { 
          success: true, 
          message: 'Materia re-asignada correctamente',
          action: 'reactivated'
        };
      }
      
      // Insertar nuevo registro si no existe ninguno
      db.prepare(`
        INSERT INTO docente_ee_asignacion (docente_id, ee_id, periodo_id, carga_horaria, estado, fecha_asignacion)
        VALUES (?, ?, ?, ?, 'activo', datetime('now'))
      `).run(docenteId, eeId, periodoId, cargaHoraria);
      
      return { 
        success: true, 
        message: 'Materia asignada correctamente',
        action: 'inserted'
      };
      
    } catch (error) {
      console.error('❌ Error asignando EE:', error);
      
      // Manejo específico de errores de constraints
      if (error.message.includes('UNIQUE constraint failed')) {
        return { 
          success: false, 
          error: 'Ya existe una asignación con estos parámetros. Verifica el estado.' 
        };
      }
      
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 4. Remover EE de docente (Soft Delete - YA CORRECTO)
  // ==========================================
  ipcMain.handle('removerDocenteEE', async (event, { docenteId, eeId, periodoId }) => {
    console.log(`🗑️ [BACKEND] removerDocenteEE: d=${docenteId}, ee=${eeId}, p=${periodoId}`);
    
    try {
      const db = getDB();
      
      // ✅ Esta consulta YA está correcta (filtra por estado='activo')
      const result = db.prepare(`
        UPDATE docente_ee_asignacion 
        SET estado = 'inactivo',
            fecha_desasignacion = datetime('now')
        WHERE docente_id = ? 
          AND ee_id = ? 
          AND periodo_id = ? 
          AND estado = 'activo'
      `).run(docenteId, eeId, periodoId);
      
      if (result.changes === 0) {
        return { 
          success: false, 
          error: 'Asignación activa no encontrada. ¿Ya fue desasignada?' 
        };
      }
      
      console.log(`✅ [BACKEND] Asignación marcada como inactiva: ${result.changes} registro(s)`);
      
      return { 
        success: true, 
        message: 'Asignación removida correctamente',
        changes: result.changes,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error en removerDocenteEE:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ [docenteEEHandlers] Handlers registrados con consistencia de estado');
};