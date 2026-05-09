const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  ipcMain.handle('obtener-programas', async () => {
    try {
      const db = getDB();
      const rows = db.prepare('SELECT * FROM programas_institucionales ORDER BY nombre ASC').all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-programa', async (event, datos) => {
    try {
      const db = getDB();
      let stmt;
      if (datos.id) {
        stmt = db.prepare(`UPDATE programas_institucionales SET nombre=?, descripcion=?, responsable=?, fecha_registro=?, estado=? WHERE id=?`);
        stmt.run(datos.nombre, datos.descripcion, datos.responsable, datos.fecha_registro, datos.estado, datos.id);
      } else {
        stmt = db.prepare(`INSERT INTO programas_institucionales (nombre, descripcion, responsable, fecha_registro, estado) VALUES (?, ?, ?, ?, ?)`);
        stmt.run(datos.nombre, datos.descripcion, datos.responsable, datos.fecha_registro, datos.estado || 'vigente');
      }
      return { success: true, message: 'Programa guardado correctamente' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};