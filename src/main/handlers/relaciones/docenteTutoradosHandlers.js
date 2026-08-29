const { ipcMain } = require('electron');
const { getDB, generarIdGlobal } = require('../../database');

module.exports = () => {
  const db = getDB();

  // Listar alumnos DISPONIBLES para tutoría
  ipcMain.handle('listarAlumnosDisponibles', async (event, { periodoId, excludeDocenteId }) => {
    try {
      let query = `
        SELECT id, matricula, nombres, apellido_paterno, apellido_materno 
        FROM alumnos 
        WHERE estado = 'activo'
      `;
      const params = [];
      
      if (excludeDocenteId) {
        query += ` AND id NOT IN (
          SELECT alumno_id FROM tutor_alumno 
          WHERE docente_id = ? AND estado = 'activo'
        )`;
        params.push(excludeDocenteId);
      }
      
      query += ' ORDER BY apellido_paterno, nombres ASC';
      const rows = db.prepare(query).all(...params);
      
      const data = rows.map(row => ({
        ...row,
        nombre_completo: `${row.nombres} ${row.apellido_paterno} ${row.apellido_materno || ''}`.trim()
      }));
      
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error listando alumnos disponibles:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Asignar alumno como tutorado - CORREGIDO con id_global
  ipcMain.handle('asignarTutor', async (event, { docenteId, alumnoId, periodoId }) => {
    try {
      const exists = db.prepare(`
        SELECT id FROM tutor_alumno 
        WHERE docente_id = ? AND alumno_id = ? AND estado = 'activo'
      `).get(docenteId, alumnoId);
      
      if (exists) {
        return { success: false, error: 'El alumno ya está asignado como tutorado a este docente.' };
      }
      
      // Obtener installation_id para generar id_global
      const installation = db.prepare('SELECT installation_id FROM installation WHERE id = 1').get();
      const idGlobal = generarIdGlobal(installation.installation_id);
      
      db.prepare(`
        INSERT INTO tutor_alumno (id_global, docente_id, alumno_id, periodo_id, estado, fecha_asignacion)
        VALUES (?, ?, ?, ?, 'activo', date('now'))
      `).run(idGlobal, docenteId, alumnoId, periodoId);
      
      return { success: true, message: 'Tutorado asignado correctamente.' };
    } catch (error) {
      console.error('❌ Error asignando tutorado:', error);
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Esta relación de tutoría ya existe.' };
      }
      return { success: false, error: error.message };
    }
  });

  // ✅ Remover asignación
  ipcMain.handle('removerTutor', async (event, { docenteId, alumnoId, periodoId }) => {
    try {
      if (!docenteId || !alumnoId) {
        return { success: false, error: 'Se requiere docenteId y alumnoId' };
      }
      
      let query = `
        UPDATE tutor_alumno 
        SET estado = 'inactivo', fecha_baja = datetime('now')
        WHERE docente_id = ? AND alumno_id = ? AND estado = 'activo'
      `;
      const params = [docenteId, alumnoId];
      
      if (periodoId) {
        query += ` AND periodo_id = ?`;
        params.push(periodoId);
      }
      
      const result = db.prepare(query).run(...params);
      
      if (result.changes === 0) {
        return { success: false, error: 'Asignación no encontrada o ya inactiva' };
      }
      
      return { 
        success: true, 
        message: 'Tutoría removida correctamente',
        changes: result.changes 
      };
      
    } catch (error) {
      console.error('❌ Error en removerTutor:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Obtener tutorados
  ipcMain.handle('obtenerTutorados', async (event, { docenteId, periodoId }) => {
    try {
      let query = `
        SELECT a.id, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno
        FROM tutor_alumno t
        INNER JOIN alumnos a ON t.alumno_id = a.id
        WHERE t.docente_id = ? AND t.estado = 'activo'
      `;
      const params = [docenteId];
      
      if (periodoId) {
        query += ` AND t.periodo_id = ?`;
        params.push(periodoId);
      }
      
      query += ' ORDER BY a.apellido_paterno, a.nombres ASC';
      const rows = db.prepare(query).all(...params);
      
      const data = rows.map(row => ({
        ...row,
        nombre_completo: `${row.nombres} ${row.apellido_paterno} ${row.apellido_materno || ''}`.trim()
      }));
      
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error obteniendo tutorados:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ [relaciones/docenteTutorados] Handlers registrados');
};