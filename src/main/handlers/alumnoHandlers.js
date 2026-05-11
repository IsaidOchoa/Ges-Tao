// src/handlers/alumnoHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  
  // ==========================================
  // LISTAR ALUMNOS
  // ==========================================
  ipcMain.handle('obtener-alumnos', async () => {
    try {
      const db = getDB();
      const rows = db.prepare('SELECT * FROM alumnos ORDER BY apellido_paterno ASC').all();
      return { success: true, rows };
    } catch (error) {
      console.error('[IPC] Error obteniendo alumnos:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // GUARDAR ALUMNO (Insertar o Actualizar)
  // ==========================================
  ipcMain.handle('guardar-alumno', async (event, datos) => {
    console.log('[IPC] Guardando alumno:', datos.nombres);
    
    try {
      const db = getDB();
      let stmt;
      
      if (datos.id) {
        // ✅ Actualizar existente
        stmt = db.prepare(`UPDATE alumnos SET 
          matricula = ?,
          apellido_paterno = ?,
          apellido_materno = ?,
          nombres = ?,
          correo_contacto = ?,
          telefono_contacto = ?,
          programa_academico = ?,
          fecha_ingreso = ?,
          estado = ?
          WHERE id = ?`);
        
        stmt.run(
          datos.matricula,
          datos.apellido_paterno,
          datos.apellido_materno || '',
          datos.nombres,
          datos.correo_contacto || '',
          datos.telefono_contacto || '',
          datos.programa_academico || '',
          datos.fecha_ingreso || null,
          datos.estado || 'activo',
          datos.id
        );
      } else {
        // ✅ Insertar nuevo
        stmt = db.prepare(`INSERT INTO alumnos (
          matricula, 
          apellido_paterno, 
          apellido_materno, 
          nombres, 
          correo_contacto, 
          telefono_contacto, 
          programa_academico,
          fecha_ingreso,
          estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        
        stmt.run(
          datos.matricula,
          datos.apellido_paterno,
          datos.apellido_materno || '',
          datos.nombres,
          datos.correo_contacto || '',
          datos.telefono_contacto || '',
          datos.programa_academico || '',
          datos.fecha_ingreso || null,
          datos.estado || 'activo'
        );
      }
      
      return { success: true, message: 'Alumno guardado correctamente' };
    } catch (error) {
      console.error('[IPC] Error guardando alumno:', error);
      
      if (error.message.includes('UNIQUE constraint failed: alumnos.matricula')) {
        return { success: false, error: 'La matrícula ya existe.' };
      }
      
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // ELIMINAR ALUMNO
  // ==========================================
  ipcMain.handle('eliminar-alumno', async (event, id) => {
    try {
      const db = getDB();
      db.prepare('DELETE FROM alumnos WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error eliminando alumno:', error);
      return { success: false, error: error.message };
    }
  });

};