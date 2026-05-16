// src/main/handlers/planHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  
  // Obtener todos los planes (para tablas)
  ipcMain.handle('obtener-planes', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT id, clave, nombre, nivel, estado, fecha_creacion 
        FROM planes_estudio 
        ORDER BY clave ASC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      console.error('[planHandlers] Error:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener planes disponibles para selects (solo activos)
  ipcMain.handle('obtener-planes-disponibles', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT id, clave, nombre, nivel 
        FROM planes_estudio 
        WHERE estado = 'activo' 
        ORDER BY clave ASC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Guardar plan (insertar o actualizar)
  ipcMain.handle('guardar-plan', async (event, datos) => {
    console.log('[IPC] Guardando plan:', datos.clave);
    try {
      const db = getDB();
      let stmt;
      
      if (datos.id) {
        // Actualizar
        stmt = db.prepare(`
          UPDATE planes_estudio SET 
            clave = ?, nombre = ?, nivel = ?, estado = ?
          WHERE id = ?
        `);
        stmt.run(
          datos.clave?.trim().toUpperCase(),
          datos.nombre?.trim(),
          datos.nivel,
          datos.estado || 'activo',
          datos.id
        );
      } else {
        // Insertar
        stmt = db.prepare(`
          INSERT INTO planes_estudio (clave, nombre, nivel, estado) 
          VALUES (?, ?, ?, ?)
        `);
        stmt.run(
          datos.clave?.trim().toUpperCase(),
          datos.nombre?.trim(),
          datos.nivel,
          datos.estado || 'activo'
        );
      }
      return { success: true, message: 'Plan guardado correctamente' };
    } catch (error) {
      console.error('[IPC] Error guardando plan:', error);
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Ya existe un plan con esa clave.' };
      }
      return { success: false, error: error.message };
    }
  });

  // Cambiar estado (soft-delete)
  ipcMain.handle('cambiar-estado-plan', async (event, id, nuevoEstado) => {
    try {
      const db = getDB();
      const stmt = db.prepare(`UPDATE planes_estudio SET estado = ? WHERE id = ?`);
      const result = stmt.run(nuevoEstado, id);
      if (result.changes === 0) {
        return { success: false, error: 'Plan no encontrado.' };
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Eliminar (solo si no tiene referencias - RESTRICT lo bloquea)
  ipcMain.handle('eliminar-plan', async (event, id) => {
    try {
      const db = getDB();
      // Verificar referencias antes de intentar borrar
      const hasRefs = db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM generaciones WHERE plan_id = ?) +
          (SELECT COUNT(*) FROM malla_curricular WHERE plan_id = ?) as total
      `).get(id, id);
      
      if (hasRefs.total > 0) {
        return { success: false, error: 'No se puede eliminar: el plan tiene generaciones o malla asociada. Use "Archivar".' };
      }
      
      db.prepare('DELETE FROM planes_estudio WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      if (error.message.includes('FOREIGN KEY constraint failed')) {
        return { success: false, error: 'No se puede eliminar: hay registros vinculados.' };
      }
      return { success: false, error: error.message };
    }
  });

};