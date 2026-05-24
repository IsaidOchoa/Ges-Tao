// src/main/handlers/relacion/periodos.js
const { ipcMain } = require('electron');
const db = require('../../database').getDB();
const { RelationUtils } = require('./utils');

module.exports = () => {
  
  // 1. Obtener periodos vinculados al docente
  ipcMain.handle('obtenerPeriodosAsignados', async (event, { docenteId }) => {
    try {
      // Nota: Asume que existe una tabla de unión 'docente_periodo'
      // Si la tabla no existe, este handler deberá ajustarse según tu esquema final
      const rows = await db.all(`
        SELECT p.id, p.clave, p.descripcion, p.estado 
        FROM docente_periodo dp
        INNER JOIN periodos p ON dp.periodo_id = p.id
        WHERE dp.docente_id = ?
        ORDER BY p.fecha_inicio DESC
      `, [docenteId]);
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error obteniendo periodos:', error);
      return { success: false, error: error.message };
    }
  });

  // 2. Vincular docente a periodo
  ipcMain.handle('vincularDocentePeriodo', async (event, { docenteId, periodoId }) => {
    try {
      await db.run(`
        INSERT OR IGNORE INTO docente_periodo (docente_id, periodo_id) VALUES (?, ?)
      `, [docenteId, periodoId]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error vinculando periodo:', error);
      return { success: false, error: error.message };
    }
  });

  // 3. Desvincular docente de periodo
  ipcMain.handle('desvincularDocentePeriodo', async (event, { docenteId, periodoId }) => {
    try {
      await db.run('DELETE FROM docente_periodo WHERE docente_id = ? AND periodo_id = ?', [docenteId, periodoId]);
      return { success: true };
    } catch (error) {
      console.error('❌ Error desvinculando periodo:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ [relacion/periodos] Handlers de periodos registrados');
};