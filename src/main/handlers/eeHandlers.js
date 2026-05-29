// src/main/handlers/eeHandlers.js
// 📍 Handlers IPC para Experiencias Educativas (EE)

const { ipcMain } = require('electron');  // ✅ IMPORTANTE: Esta línea faltaba
const { getDB } = require('../database');

module.exports = () => {
  
  // ==========================================
  // LISTAR EXPERIENCIAS EDUCATIVAS
  // ==========================================
  ipcMain.handle('obtener-ee', async () => {
    try {
      const db = getDB();
      const rows = db.prepare('SELECT * FROM experiencias_educativas ORDER BY nombre ASC').all();
      return { success: true, rows };
    } catch (error) {
      console.error('[IPC] Error obteniendo EE:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // GUARDAR EE (Insertar o Actualizar)
  // ==========================================
  ipcMain.handle('guardar-ee', async (event, datos) => {
    console.log('[IPC] Guardando EE:', datos.nombre);
    
    try {
      const db = getDB();
      
      // ✅ Validar estado (3 opciones permitidas)
      const estadosValidos = ['activa', 'inactiva', 'archivada'];
      if (!estadosValidos.includes(datos.estado)) {
        return { 
          success: false, 
          error: `Estado no válido. Use: ${estadosValidos.join(', ')}` 
        };
      }
      
      let stmt;
      
      if (datos.id) {
        // Actualizar existente
        stmt = db.prepare(`UPDATE experiencias_educativas SET 
          clave_ee = ?,
          nombre = ?,
          tipo = ?,
          creditos = ?,
          creditos_teoria = ?,
          creditos_practica = ?,
          creditos_otros = ?,
          area = ?,
          linea_investigacion = ?,
          horas_teoria = ?,
          horas_practica = ?,
          programa_academico = ?,
          estado = ?
          WHERE id = ?`);
        
        stmt.run(
          datos.clave_ee,
          datos.nombre,
          datos.tipo,
          datos.creditos,
          datos.creditos_teoria,
          datos.creditos_practica,
          datos.creditos_otros || 0,
          datos.area,
          datos.linea_investigacion,
          datos.horas_teoria,
          datos.horas_practica,
          datos.programa_academico,
          datos.estado,
          datos.id
        );
      } else {
        // Insertar nuevo
        stmt = db.prepare(`INSERT INTO experiencias_educativas (
          clave_ee, nombre, tipo, creditos, creditos_teoria, creditos_practica,
          creditos_otros, area, linea_investigacion, horas_teoria, horas_practica,
          programa_academico, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        
        stmt.run(
          datos.clave_ee,
          datos.nombre,
          datos.tipo,
          datos.creditos,
          datos.creditos_teoria,
          datos.creditos_practica,
          datos.creditos_otros || 0,
          datos.area,
          datos.linea_investigacion,
          datos.horas_teoria,
          datos.horas_practica,
          datos.programa_academico,
          datos.estado || 'activa'
        );
      }
      
      return { success: true, message: 'EE guardada correctamente' };
    } catch (error) {
      console.error('[IPC] Error guardando EE:', error);
      
      if (error.message.includes('UNIQUE constraint failed: experiencias_educativas.clave_ee')) {
        return { success: false, error: 'La clave de EE ya existe.' };
      }
      if (error.message.includes('CHECK constraint failed')) {
        return { success: false, error: 'Estado no válido. Use: activa, inactiva o archivada.' };
      }
      
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('actualizar-estado-ee', async (event, { id, nuevoEstado }) => {
  try {
    const db = getDB();
    if (!['activa', 'inactiva'].includes(nuevoEstado)) return { success: false, error: 'Estado inválido' };
    const ee = db.prepare('SELECT id FROM experiencias_educativas WHERE id = ?').get(id);
    if (!ee) return { success: false, error: 'EE no encontrada' };
    db.prepare('UPDATE experiencias_educativas SET estado = ? WHERE id = ?').run(nuevoEstado, id);
    return { success: true };
  } catch (err) { console.error('❌ Error actualizando EE:', err); return { success: false, error: err.message }; }
});

  // ==========================================
  // ELIMINAR EE
  // ==========================================
  ipcMain.handle('eliminar-ee', async (event, id) => {
    try {
      const db = getDB();
      db.prepare('DELETE FROM experiencias_educativas WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error eliminando EE:', error);
      return { success: false, error: error.message };
    }
  });

};