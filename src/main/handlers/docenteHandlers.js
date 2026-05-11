const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  ipcMain.handle('obtener-docentes', async () => {
    try {
      const db = getDB();
      const rows = db.prepare('SELECT * FROM docentes ORDER BY apellido_paterno ASC').all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-docente', async (event, datos) => {
  console.log('[IPC] Guardando docente:', datos.nombres);
  console.log('[IPC] Datos completos:', datos); // Debug
  
  try {
    const db = getDB();
    let stmt;
    
    if (datos.id) {
      // ✅ ACTUALIZAR: Incluir tratamiento y articulo
      stmt = db.prepare(`UPDATE docentes SET 
        codigo = ?,
        apellido_paterno = ?,
        apellido_materno = ?,
        nombres = ?,
        correo_contacto = ?,
        telefono_contacto = ?,
        nivel_academico = ?,
        tratamiento = ?,
        articulo = ?,
        estado = ?
        WHERE id = ?`);
      
      stmt.run(
        datos.codigo,
        datos.apellido_paterno,
        datos.apellido_materno || '',
        datos.nombres,
        datos.correo_contacto || '',
        datos.telefono_contacto || '',
        datos.nivel_academico || '',
        datos.tratamiento || 'Dr.',
        datos.articulo || 'El',
        datos.estado || 'activo',
        datos.id
      );
    } else {
      // ✅ INSERTAR: Incluir tratamiento y articulo
      stmt = db.prepare(`INSERT INTO docentes (
        codigo, 
        apellido_paterno, 
        apellido_materno, 
        nombres, 
        correo_contacto, 
        telefono_contacto, 
        nivel_academico,
        tratamiento,
        articulo,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      stmt.run(
        datos.codigo,
        datos.apellido_paterno,
        datos.apellido_materno || '',
        datos.nombres,
        datos.correo_contacto || '',
        datos.telefono_contacto || '',
        datos.nivel_academico || '',
        datos.tratamiento || 'Dr.',    
        datos.articulo || 'El',       
        datos.estado || 'activo'
      );
    }
    
    return { success: true, message: 'Docente guardado correctamente' };
  } catch (error) {
    console.error('[IPC] Error guardando docente:', error);
    
    if (error.message.includes('UNIQUE constraint failed: docentes.codigo')) {
      return { success: false, error: 'El código de docente ya existe.' };
    }
    if (error.message.includes('NOT NULL constraint failed: docentes.tratamiento')) {
      return { success: false, error: 'El tratamiento es obligatorio.' };
    }
    
    return { success: false, error: error.message };
  }
});

  ipcMain.handle('eliminar-docente', async (event, id) => {
    try {
      const db = getDB();
      db.prepare('DELETE FROM docentes WHERE id = ?').run(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};