const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  
  // Obtener periodos de entidad (usa entity_period)
ipcMain.handle('obtener-periodos-de-entidad', async (event, { entityType, entityId }) => {
  try {
    const db = getDB();
    const periodos = db.prepare(`
      SELECT p.id, p.clave, p.descripcion, p.fecha_inicio, p.fecha_fin, p.estado
      FROM periodos p
      INNER JOIN entity_period ep ON p.id = ep.period_id
      WHERE ep.entity_type = ? AND ep.entity_id = ?
      ORDER BY p.fecha_inicio DESC
    `).all(entityType, entityId);
    
    return { success: true, data: periodos };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Agregar entidad a periodo (SOLO vincula, no crea relaciones incompletas)
ipcMain.handle('agregar-entidad-a-periodo', async (event, { entityType, entityId, periodId }) => {
  try {
    const db = getDB();
    
    // Verificar periodo existe
    const period = db.prepare('SELECT id FROM periodos WHERE id = ?').get(periodId);
    if (!period) return { success: false, error: 'Periodo no existe' };
    
    // Vincular entidad al periodo (tabla independiente)
    db.prepare(`
      INSERT OR IGNORE INTO entity_period (entity_type, entity_id, period_id)
      VALUES (?, ?, ?)
    `).run(entityType, entityId, periodId);
    
    return { success: true, message: 'Entidad vinculada al periodo' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Remover entidad de periodo
ipcMain.handle('remover-entidad-de-periodo', async (event, { entityType, entityId, periodId }) => {
  try {
    const db = getDB();
    db.prepare(`
      DELETE FROM entity_period 
      WHERE entity_type = ? AND entity_id = ? AND period_id = ?
    `).run(entityType, entityId, periodId);
    
    return { success: true, message: 'Entidad desvinculada del periodo' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
};