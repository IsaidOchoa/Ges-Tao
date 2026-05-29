// src/main/handlers/alumnoHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  
  // ==========================================
  // LISTAR ALUMNOS (CON TUTOR ASIGNADO)
  // ==========================================
  ipcMain.handle('obtener-alumnos', async () => {
    try {
      const db = getDB();
      
      const query = `
        SELECT 
          a.*,
          (
            SELECT d.nombres || ' ' || d.apellido_paterno || 
                   CASE WHEN d.apellido_materno IS NOT NULL AND d.apellido_materno != '' 
                        THEN ' ' || d.apellido_materno 
                        ELSE '' 
                   END
            FROM tutor_alumno ta
            INNER JOIN docentes d ON ta.docente_id = d.id
            WHERE ta.alumno_id = a.id 
              AND ta.estado = 'activo'
            LIMIT 1
          ) AS tutor_nombre
        FROM alumnos a
        WHERE a.estado != 'archivado'
        ORDER BY a.apellido_paterno, a.nombres
      `;
      
      const rows = db.prepare(query).all();
      return { success: true, rows };
      
    } catch (error) {
      console.error('❌ [IPC] Error en obtener-alumnos:', error);
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
        stmt = db.prepare(`
          UPDATE alumnos SET 
            matricula = ?,
            apellido_paterno = ?,
            apellido_materno = ?,
            nombres = ?,
            correo_contacto = ?,
            telefono_contacto = ?,
            programa_academico = ?,
            periodo_ingreso = ?,
            tratamiento = ?,
            articulo = ?,
            estado = ?
          WHERE id = ?
        `);
        
        stmt.run(
          datos.matricula,
          datos.apellido_paterno,
          datos.apellido_materno || '',
          datos.nombres,
          datos.correo_contacto || '',
          datos.telefono_contacto || '',
          datos.programa_academico || '',
          datos.periodo_ingreso || null,
          datos.tratamiento || 'Est.',
          datos.articulo || 'El',
          'activo',
          datos.id
        );
      } else {
        stmt = db.prepare(`
          INSERT INTO alumnos (
            matricula, 
            apellido_paterno, 
            apellido_materno, 
            nombres, 
            correo_contacto, 
            telefono_contacto, 
            programa_academico,
            periodo_ingreso,
            tratamiento,
            articulo,
            estado
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          datos.matricula,
          datos.apellido_paterno,
          datos.apellido_materno || '',
          datos.nombres,
          datos.correo_contacto || '',
          datos.telefono_contacto || '',
          datos.programa_academico || '',
          datos.periodo_ingreso || null,
          datos.tratamiento || 'Est.',
          datos.articulo || 'El',
          'activo'
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