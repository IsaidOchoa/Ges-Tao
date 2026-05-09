const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  ipcMain.handle('obtener-periodos', async () => {
    try {
      const db = getDB();
      const rows = db.prepare('SELECT * FROM periodos ORDER BY fecha_inicio DESC').all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-periodo', async (event, datos) => {
    try {
      const db = getDB();
      let stmt;
      if (datos.id) {
        stmt = db.prepare(`UPDATE periodos SET clave=?, descripcion=?, fecha_inicio=?, fecha_fin=?, estado=? WHERE id=?`);
        stmt.run(datos.clave, datos.descripcion, datos.fecha_inicio, datos.fecha_fin, datos.estado, datos.id);
      } else {
        stmt = db.prepare(`INSERT INTO periodos (clave, descripcion, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?, ?)`);
        stmt.run(datos.clave, datos.descripcion, datos.fecha_inicio, datos.fecha_fin, datos.estado || 'abierto');
      }
      return { success: true, message: 'Periodo guardado correctamente' };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'La clave del periodo ya existe.' };
      }
      return { success: false, error: error.message };
    }
  });
};