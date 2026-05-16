// src/main/handlers/generacionHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  
  ipcMain.handle('obtener-generaciones', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT 
          g.id, g.clave, g.nombre, g.estado, g.fecha_creacion,
          p.clave as plan_clave, p.nombre as plan_nombre,
          per.clave as periodo_clave, per.descripcion as periodo_desc
        FROM generaciones g
        LEFT JOIN planes_estudio p ON g.plan_id = p.id
        LEFT JOIN periodos per ON g.periodo_ingreso_id = per.id
        ORDER BY g.clave DESC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      console.error('[generacionHandlers] Error:', error);
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
        WHERE g.estado = 'activa'
        ORDER BY g.clave DESC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Datos para poblar selects en modales
  ipcMain.handle('obtener-datos-selects-generacion', async () => {
    try {
      const db = getDB();
      const planes = db.prepare(`
        SELECT id, clave, nombre FROM planes_estudio WHERE estado = 'activo'
      `).all();
      const periodos = db.prepare(`
        SELECT id, clave, descripcion FROM periodos WHERE estado IN ('abierto', 'en_progreso')
      `).all();
      return { success: true, data: { planes, periodos } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-generacion', async (event, datos) => {
    console.log('[IPC] Guardando generación:', datos.clave);
    try {
      const db = getDB();
      let stmt;
      
      if (datos.id) {
        stmt = db.prepare(`
          UPDATE generaciones 
          SET clave = ?, nombre = ?, plan_id = ?, periodo_ingreso_id = ?, estado = ?
          WHERE id = ?
        `);
        stmt.run(
          datos.clave, datos.nombre, datos.plan_id, datos.periodo_ingreso_id, 
          datos.estado || 'activa', datos.id
        );
      } else {
        stmt = db.prepare(`
          INSERT INTO generaciones (clave, nombre, plan_id, periodo_ingreso_id, estado) 
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(
          datos.clave, datos.nombre, datos.plan_id, datos.periodo_ingreso_id, 
          datos.estado || 'activa'
        );
      }
      return { success: true, message: 'Generación guardada correctamente' };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Ya existe una generación con esa clave.' };
      }
      return { success: false, error: error.message };
    }
  });

};