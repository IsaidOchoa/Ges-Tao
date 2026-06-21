// src/main/handlers/docenteHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../database.js'); // ✅ Extensión explícita

module.exports = () => {
  
  // ==========================================
  // 1. LISTAR DOCENTES
  // ==========================================
  ipcMain.handle('obtener-docentes', async () => {
    try {
      const db = getDB();
      const rows = db.prepare('SELECT * FROM docentes ORDER BY apellido_paterno ASC').all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 2. GUARDAR DOCENTE (INSERT/UPDATE)
  // ==========================================
  ipcMain.handle('guardar-docente', async (event, datos) => {
    console.log('[IPC] Guardando docente:', datos.nombres);
    
    try {
      const db = getDB();
      let stmt;
      
      if (datos.id) {
        // UPDATE
        stmt = db.prepare(`UPDATE docentes SET 
          codigo = ?, apellido_paterno = ?, apellido_materno = ?,
          nombres = ?, correo_contacto = ?, telefono_contacto = ?,
          nivel_academico = ?, tratamiento = ?, articulo = ?, estado = ?
          WHERE id = ?`);
        
        stmt.run(
          datos.codigo, datos.apellido_paterno, datos.apellido_materno || '',
          datos.nombres, datos.correo_contacto || '', datos.telefono_contacto || '',
          datos.nivel_academico || '', datos.tratamiento || 'Dr.',
          datos.articulo || 'El', datos.estado || 'activo', datos.id
        );
      } else {
        // INSERT
        stmt = db.prepare(`INSERT INTO docentes (
          codigo, apellido_paterno, apellido_materno, nombres,
          correo_contacto, telefono_contacto, nivel_academico,
          tratamiento, articulo, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        
        stmt.run(
          datos.codigo, datos.apellido_paterno, datos.apellido_materno || '',
          datos.nombres, datos.correo_contacto || '', datos.telefono_contacto || '',
          datos.nivel_academico || '', datos.tratamiento || 'Dr.',
          datos.articulo || 'El', datos.estado || 'activo'
        );
      }
      
      return { success: true, message: 'Docente guardado correctamente' };
    } catch (error) {
      console.error('[IPC] Error guardando docente:', error);
      
      if (error.message.includes('UNIQUE constraint failed: docentes.codigo')) {
        return { success: false, error: 'El código de docente ya existe.' };
      }
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 3. ACTUALIZAR ESTADO (ACTIVO/INACTIVO)
  // ==========================================
  ipcMain.handle('actualizar-estado-docente', async (event, { id, nuevoEstado }) => {
    try {
      const db = getDB();
      if (!['activo', 'inactivo'].includes(nuevoEstado)) {
        return { success: false, error: 'Estado inválido' };
      }
      db.prepare('UPDATE docentes SET estado = ? WHERE id = ?').run(nuevoEstado, id);
      return { success: true };
    } catch (err) {
      console.error('Error actualizando estado docente:', err);
      return { success: false, error: err.message };
    }
  });

  // ==========================================
  // 4. ELIMINAR DOCENTE (Hard Delete)
  // ==========================================
  ipcMain.handle('eliminar-docente', async (event, id) => {
    try {
      const db = getDB();
      db.prepare('DELETE FROM docentes WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  console.log('✅ [docenteHandlers] Handlers de docentes registrados');
};