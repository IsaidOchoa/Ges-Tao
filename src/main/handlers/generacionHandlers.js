// src/main/handlers/generacionHandlers.js
const { ipcMain } = require('electron');
const { getDB, generarIdGlobal } = require('../database');

//Función para generar claves secuenciales
function generarClaveGeneracion(db) {
  const row = db.prepare(`
    SELECT clave FROM generaciones
    WHERE clave LIKE 'GEN-%'
    ORDER BY CAST(SUBSTR(clave, 5) AS INTEGER) DESC
    LIMIT 1
  `).get();
  const n = row ? parseInt(row.clave.slice(4), 10) : NaN;
  return `GEN-${String((isNaN(n) ? 0 : n) + 1).padStart(4, '0')}`;
}

module.exports = () => {

  ipcMain.handle('obtener-generaciones', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT 
          g.id, g.clave, g.nombre, g.estado, g.created_at,
          g.plan_id, g.periodo_ingreso_id,
          p.clave as plan_clave, p.nombre as plan_nombre,
          per.clave as periodo_clave, per.descripcion as periodo_desc
        FROM generaciones g
        LEFT JOIN planes_estudio p ON g.plan_id = p.id
        LEFT JOIN periodos per ON g.periodo_ingreso_id = per.id
        WHERE g.deleted_at IS NULL
        ORDER BY g.clave DESC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      console.error('[generacionHandlers] Error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-generacion', async (event, datos) => {
    console.log('[IPC] Guardando generación:', datos.nombre);
    try {
      const db = getDB();
      const installation = db.prepare("SELECT installation_id FROM installation WHERE id = 1").get();
      
      const clave = datos.clave?.trim().toUpperCase() || generarClaveGeneracion(db);

      if (datos.id) {
        db.prepare(`
          UPDATE generaciones
          SET clave = ?, nombre = ?, plan_id = ?, periodo_ingreso_id = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(clave, datos.nombre?.trim(), datos.plan_id || null, datos.periodo_ingreso_id || null, datos.estado || 'activa', datos.id);
      } else {
        db.prepare(`
          INSERT INTO generaciones (id_global, clave, nombre, plan_id, periodo_ingreso_id, estado)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          generarIdGlobal(installation.installation_id),
          clave,
          datos.nombre?.trim(),
          datos.plan_id || null,
          datos.periodo_ingreso_id || null,
          datos.estado || 'activa'
        );
      }
      return { success: true, message: 'Generación guardada correctamente' };
    } catch (error) {
      console.error('[IPC] Error guardando generación:', error);
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Ya existe una generación con esa clave.' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cambiar-estado-generacion', async (event, { id, nuevoEstado }) => {
    try {
      const db = getDB();
      if (!['activa', 'inactiva'].includes(nuevoEstado)) return { success: false, error: 'Estado inválido' };
      const r = db.prepare(`UPDATE generaciones SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`)
        .run(nuevoEstado, id);
      if (r.changes === 0) return { success: false, error: 'Generación no encontrada' };
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('obtener-generaciones-disponibles', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT g.id, g.clave, g.nombre, p.clave as plan_clave
        FROM generaciones g
        LEFT JOIN planes_estudio p ON g.plan_id = p.id
        WHERE g.estado = 'activa' AND g.deleted_at IS NULL
        ORDER BY g.clave DESC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('obtener-datos-selects-generacion', async () => {
    try {
      const db = getDB();
      const planes = db.prepare(`
        SELECT id, clave, nombre FROM planes_estudio WHERE estado = 'activo' AND deleted_at IS NULL
      `).all();
      const periodos = db.prepare(`
        SELECT id, clave, descripcion FROM periodos 
        WHERE estado != 'cerrado' AND deleted_at IS NULL
        ORDER BY fecha_inicio DESC
      `).all();
      return { success: true, data: { planes, periodos } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

};