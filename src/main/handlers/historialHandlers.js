const { ipcMain, shell } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  ipcMain.handle('obtener-historial', async () => {
    try {
      const db = getDB();
      const query = `
        SELECT h.*, u.nombre_completo as usuario_nombre
        FROM historial_auditoria h
        LEFT JOIN usuarios u ON h.usuario_id = u.id
        ORDER BY h.fecha_sistema DESC
        LIMIT 100
      `;
      const rows = db.prepare(query).all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('abrir-archivo-pdf', async (event, rutaArchivo) => {
    try {
      if (!rutaArchivo) return { success: false, error: 'Ruta no disponible' };
      await shell.openPath(rutaArchivo);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'No se pudo abrir el archivo' };
    }
  });
};