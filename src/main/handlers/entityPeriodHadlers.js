// src/main/handlers/entityPeriodHadlers.js
const { ipcMain } = require('electron');
const { getDB, generarIdGlobal } = require('../database');

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
      
      console.log(`[entityPeriod] Periodos de ${entityType} #${entityId}:`, periodos.length);
      return { success: true, data: periodos };
    } catch (error) {
      console.error('❌ Error obteniendo periodos de entidad:', error);
      return { success: false, error: error.message };
    }
  });

  // Agregar entidad a periodo (mejorado con verificación)
  ipcMain.handle('agregar-entidad-a-periodo', async (event, { entityType, entityId, periodId }) => {
    try {
      const db = getDB();
      
      // Verificar periodo existe
      const period = db.prepare('SELECT id FROM periodos WHERE id = ?').get(periodId);
      if (!period) return { success: false, error: 'Periodo no existe' };
      
      // Verificar si ya existe la vinculación
      const existing = db.prepare(`
        SELECT id FROM entity_period 
        WHERE entity_type = ? AND entity_id = ? AND period_id = ?
      `).get(entityType, entityId, periodId);
      
      if (existing) {
        console.log(`[entityPeriod] ${entityType} #${entityId} ya está vinculado al periodo #${periodId}`);
        return { 
          success: true, 
          message: 'Entidad ya estaba vinculada al periodo',
          action: 'already_exists'
        };
      }
      
      // Obtener installation_id para generar id_global
      const installation = db.prepare('SELECT installation_id FROM installation WHERE id = 1').get();
      const idGlobal = generarIdGlobal(installation.installation_id);
      
      // Vincular entidad al periodo
      const result = db.prepare(`
        INSERT INTO entity_period (id_global, entity_type, entity_id, period_id)
        VALUES (?, ?, ?, ?)
      `).run(idGlobal, entityType, entityId, periodId);
      
      console.log(`✅ Entidad vinculada: ${entityType} #${entityId} → Periodo #${periodId} (id: ${result.lastInsertRowid})`);
      return { 
        success: true, 
        message: 'Entidad vinculada al periodo',
        action: 'inserted',
        id: result.lastInsertRowid
      };
    } catch (error) {
      console.error('❌ Error agregando entidad a periodo:', error);
      return { success: false, error: error.message };
    }
  });

  // Remover entidad de periodo
  ipcMain.handle('remover-entidad-de-periodo', async (event, { entityType, entityId, periodId }) => {
    try {
      const db = getDB();
      const result = db.prepare(`
        DELETE FROM entity_period 
        WHERE entity_type = ? AND entity_id = ? AND period_id = ?
      `).run(entityType, entityId, periodId);
      
      console.log(`✅ Entidad desvinculada: ${entityType} #${entityId} ↛ Periodo #${periodId} (changes: ${result.changes})`);
      return { 
        success: true, 
        message: 'Entidad desvinculada del periodo',
        changes: result.changes
      };
    } catch (error) {
      console.error('❌ Error removiendo entidad de periodo:', error);
      return { success: false, error: error.message };
    }
  });
};