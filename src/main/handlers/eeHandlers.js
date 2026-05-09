const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  ipcMain.handle('obtener-ee', async () => {
    try {
      const db = getDB();
      const rows = db.prepare('SELECT * FROM experiencias_educativas ORDER BY nombre ASC').all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-ee', async (event, datos) => {
    try {
      const db = getDB();
      let stmt;
      if (datos.id) {
        stmt = db.prepare(`UPDATE experiencias_educativas SET 
          clave_ee=?, nombre=?, tipo=?, creditos=?, horas_teoria=?, horas_practica=?, 
          programa_academico=?, estado=? WHERE id=?`);
        stmt.run(datos.clave_ee, datos.nombre, datos.tipo, datos.creditos, datos.horas_teoria, 
                 datos.horas_practica, datos.programa_academico, datos.estado, datos.id);
      } else {
        stmt = db.prepare(`INSERT INTO experiencias_educativas (clave_ee, nombre, tipo, creditos, horas_teoria, horas_practica, programa_academico, estado)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(datos.clave_ee, datos.nombre, datos.tipo, datos.creditos, datos.horas_teoria, 
                 datos.horas_practica, datos.programa_academico, datos.estado || 'activa');
      }
      return { success: true, message: 'EE guardada correctamente' };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'La clave de la EE ya existe.' };
      }
      return { success: false, error: error.message };
    }
  });
};