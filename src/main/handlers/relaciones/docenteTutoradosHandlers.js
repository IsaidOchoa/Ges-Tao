// src/main/handlers/relaciones/docenteTutoradosHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../../database');

module.exports = () => {
  const db = getDB();

  // ✅ Listar alumnos DISPONIBLES para tutoría (CORREGIDO: columnas reales)
  ipcMain.handle('listarAlumnosDisponibles', async (event, { periodoId, excludeDocenteId }) => {
    try {
      // ✅ Usar columnas que SÍ existen en la tabla alumnos
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
      
      // ✅ Formatear nombre completo en JS (no en SQL)
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

  // ✅ Asignar alumno como tutorado (sin cambios, ya estaba bien)
  ipcMain.handle('asignarTutor', async (event, { docenteId, alumnoId, periodoId }) => {
    try {
      const exists = db.prepare(`
        SELECT id FROM tutor_alumno 
        WHERE docente_id = ? AND alumno_id = ? AND estado = 'activo'
      `).get(docenteId, alumnoId);
      
      if (exists) {
        return { success: false, error: 'El alumno ya está asignado como tutorado a este docente.' };
      }
      
      db.prepare(`
        INSERT INTO tutor_alumno (docente_id, alumno_id, periodo_id, estado, fecha_asignacion)
        VALUES (?, ?, ?, 'activo', date('now'))
      `).run(docenteId, alumnoId, periodoId);
      
      return { success: true, message: 'Tutorado asignado correctamente.' };
    } catch (error) {
      console.error('❌ Error asignando tutorado:', error);
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Esta relación de tutoría ya existe.' };
      }
      return { success: false, error: error.message };
    }
  });

  // ✅ Remover asignación (sin cambios)
  ipcMain.handle('removerTutor', async (event, { docenteId, alumnoId }) => {
    try {
      const result = db.prepare(`
        UPDATE tutor_alumno 
        SET estado = 'inactivo', fecha_baja = datetime('now')
        WHERE docente_id = ? AND alumno_id = ? AND estado = 'activo'
      `).run(docenteId, alumnoId);
      
      if (result.changes === 0) {
        return { success: false, error: 'Asignación no encontrada o ya inactiva.' };
      }
      return { success: true, message: 'Tutorado removido correctamente.' };
    } catch (error) {
      console.error('❌ Error removiendo tutorado:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Obtener tutorados (CORREGIDO: columnas reales)
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
      
      // ✅ Formatear nombre completo en JS
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