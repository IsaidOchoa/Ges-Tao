// src/main/handlers/planHandlers.js
const { ipcMain } = require('electron');
const { getDB, generarIdGlobal } = require('../database');  // ← agregar generarIdGlobal

// Unifica vocabulario de estados para que los selects ('activo') siempre los vean
function normalizarEstadoPlan(estado) {
  if (['vigente', 'activo', 'activa'].includes(estado)) return 'activo';
  if (['inactivo', 'inactiva', 'archivado'].includes(estado)) return 'inactivo';
  return 'activo';
}
function generarClavePlan(db) {
  const row = db.prepare(`
    SELECT clave FROM planes_estudio
    WHERE clave LIKE 'PLAN-%'
    ORDER BY CAST(SUBSTR(clave, 6) AS INTEGER) DESC
    LIMIT 1
  `).get();
  const n = row ? parseInt(row.clave.slice(5), 10) : NaN;
  return `PLAN-${String((isNaN(n) ? 0 : n) + 1).padStart(4, '0')}`;
}

module.exports = () => {

  ipcMain.handle('obtener-planes', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT id, clave, nombre, nivel, estado, created_at
        FROM planes_estudio
        WHERE deleted_at IS NULL
        ORDER BY clave ASC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      console.error('[planHandlers] Error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('obtener-planes-disponibles', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT id, clave, nombre, nivel
        FROM planes_estudio
        WHERE estado = 'activo' AND deleted_at IS NULL
        ORDER BY clave ASC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-plan', async (event, datos) => {
    try {
      const db = getDB();
      const estado = normalizarEstadoPlan(datos.estado);
      const clave = datos.clave?.trim().toUpperCase() || generarClavePlan(db);

      if (datos.id) {
        db.prepare(`
          UPDATE planes_estudio
          SET clave = ?, nombre = ?, nivel = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          clave,
          datos.nombre?.trim(),
          datos.nivel,
          estado,
          datos.id
        );
      } else {
        const installation = db.prepare("SELECT installation_id FROM installation WHERE id = 1").get();
        db.prepare(`
          INSERT INTO planes_estudio (id_global, clave, nombre, nivel, estado)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          generarIdGlobal(installation.installation_id),
          clave,
          datos.nombre?.trim(),
          datos.nivel,
          estado
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

  ipcMain.handle('cambiar-estado-plan', async (event, id, nuevoEstado) => {
    try {
      const db = getDB();
      const result = db.prepare(`UPDATE planes_estudio SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(normalizarEstadoPlan(nuevoEstado), id);
      if (result.changes === 0) return { success: false, error: 'Plan no encontrado.' };
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