const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  ipcMain.handle('listar-tipos-constancia', async () => {
    try {
      const db = getDB();
      const rows = db.prepare('SELECT * FROM tipos_constancia ORDER BY nombre ASC').all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-tipo-constancia', async (event, datos) => {
    try {
      const db = getDB();
      let stmt;
      if (datos.id) {
        stmt = db.prepare(`UPDATE tipos_constancia SET 
          clave=?, nombre=?, descripcion=?, requiere_ee=?, requiere_periodo=?, estado=? 
          WHERE id=?`);
        stmt.run(datos.clave, datos.nombre, datos.descripcion, 
               datos.requiere_ee ? 1 : 0, datos.requiere_periodo ? 1 : 0, datos.estado, datos.id);
      } else {
        stmt = db.prepare(`INSERT INTO tipos_constancia (clave, nombre, descripcion, requiere_ee, requiere_periodo, estado) 
          VALUES (?, ?, ?, ?, ?, ?)`);
        stmt.run(datos.clave, datos.nombre, datos.descripcion, 
               datos.requiere_ee ? 1 : 0, datos.requiere_periodo ? 1 : 0, datos.estado);
      }
      return { success: true, message: 'Tipo de constancia guardado correctamente' };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'La clave del tipo ya existe.' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('eliminar-tipo-constancia', async (event, id) => {
    try {
      const db = getDB();
      const count = db.prepare('SELECT COUNT(*) as count FROM constancias WHERE tipo_constancia_id = ?').get(id);
      if (count.count > 0) {
        return { success: false, error: 'No se puede eliminar: Hay constancias emitidas con este tipo.' };
      }
      
      db.prepare('DELETE FROM tipos_constancia WHERE id = ?').run(id);
      return { success: true, message: 'Tipo eliminado correctamente' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};