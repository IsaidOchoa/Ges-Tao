// src/main/handlers/semestreHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  
  ipcMain.handle('obtener-semestres', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT id, clave, nombre, orden, estado FROM semestres ORDER BY orden ASC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('obtener-semestres-disponibles', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT id, clave, nombre, orden FROM semestres WHERE estado = 'activo' ORDER BY orden ASC
      `).all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-semestre', async (event, datos) => {
    console.log('[IPC] Guardando semestre:', datos.clave);
    try {
      const db = getDB();
      let stmt;
      
      if (datos.id) {
        stmt = db.prepare(`
          UPDATE semestres SET clave = ?, nombre = ?, orden = ?, estado = ? WHERE id = ?
        `);
        stmt.run(datos.clave, datos.nombre, datos.orden, datos.estado || 'activo', datos.id);
      } else {
        stmt = db.prepare(`
          INSERT INTO semestres (clave, nombre, orden, estado) VALUES (?, ?, ?, ?)
        `);
        stmt.run(datos.clave, datos.nombre, datos.orden, datos.estado || 'activo');
      }
      return { success: true, message: 'Semestre guardado correctamente' };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Ya existe un semestre con esa clave u orden.' };
      }
      return { success: false, error: error.message };
    }
  });

};