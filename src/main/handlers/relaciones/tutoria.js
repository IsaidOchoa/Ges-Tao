// src/main/handlers/relacion/tutoria.js
const { ipcMain } = require('electron');
const db = require('../../database').getDB();
const { RelationUtils } = require('./utils');

module.exports = () => {
  
  // Listar alumnos disponibles para asignar como tutorados
  ipcMain.handle('listarAlumnosDisponibles', async (event, { excludeTutoradosOf = null }) => {
    try {
      const excludeIds = excludeTutoradosOf ? 
        await db.all(`SELECT alumno_id FROM tutor_alumno WHERE docente_id = ? AND estado = 'activo'`, [excludeTutoradosOf]).then(r => r.map(x => x.alumno_id)) 
        : [];
      
      const rows = await RelationUtils.listarAlumnos({ excludeIds });
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error listando alumnos disponibles:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Asignar tutoría (Docente → Alumno)
  ipcMain.handle('asignarTutor', async (event, { docenteId, alumnoId, periodoId, motivo }) => {
    try {
      const [docente, alumno] = await Promise.all([
        RelationUtils.entityExists('docentes', docenteId),
        RelationUtils.entityExists('alumnos', alumnoId)
      ]);
      
      if (!docente) return { success: false, error: 'Docente no encontrado' };
      if (!alumno) return { success: false, error: 'Alumno no encontrado' };
      
      await db.run(`
        INSERT INTO tutor_alumno (docente_id, alumno_id, periodo_id, fecha_asignacion, estado)
        VALUES (?, ?, ?, datetime('now'), 'activo')
        ON CONFLICT(docente_id, alumno_id) DO UPDATE SET
          periodo_id = excluded.periodo_id,
          fecha_asignacion = datetime('now'),
          estado = 'activo'
      `, [docenteId, alumnoId, periodoId || null]);
      
      await RelationUtils.registrarAuditoria({
        usuarioId: event.sender.id,
        accion: 'crear',
        tipoRelacion: 'tutoria',
        entidadA: { id: docenteId, tipo: 'docente' },
        entidadB: { id: alumnoId, tipo: 'alumno' },
        periodoId,
        motivo
      });
      
      return { success: true, message: 'Tutoría asignada correctamente' };
    } catch (error) {
      console.error('❌ Error asignando tutoría:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Remover tutoría
  ipcMain.handle('removerTutor', async (event, { docenteId, alumnoId, motivo }) => {
    try {
      const result = await db.run(`
        UPDATE tutor_alumno SET estado = 'inactivo', fecha_baja = datetime('now')
        WHERE docente_id = ? AND alumno_id = ? AND estado = 'activo'
      `, [docenteId, alumnoId]);
      
      if (result.changes === 0) return { success: false, error: 'Relación activa no encontrada' };
      
      await RelationUtils.registrarAuditoria({
        usuarioId: event.sender.id,
        accion: 'eliminar',
        tipoRelacion: 'tutoria',
        entidadA: { id: docenteId, tipo: 'docente' },
        entidadB: { id: alumnoId, tipo: 'alumno' },
        motivo
      });
      
      return { success: true, message: 'Tutoría removida' };
    } catch (error) {
      console.error('❌ Error removiendo tutoría:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Obtener tutorados de un docente
  ipcMain.handle('obtenerTutorados', async (event, { docenteId, periodoId, incluirHistorico = false }) => {
    try {
      let query = `
        SELECT a.id, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno, 
               a.correo_contacto, t.periodo_id, t.fecha_asignacion, t.estado
        FROM tutor_alumno t
        INNER JOIN alumnos a ON t.alumno_id = a.id
        WHERE t.docente_id = ?
      `;
      const params = [docenteId];
      
      if (!incluirHistorico) { query += ' AND t.estado = ?'; params.push('activo'); }
      if (periodoId) { query += ' AND t.periodo_id = ?'; params.push(periodoId); }
      
      query += ' ORDER BY a.apellido_paterno, a.nombres';
      const rows = await db.all(query, params);
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error obteniendo tutorados:', error);
      return { success: false, error: error.message };
    }
  });
  
  console.log('✅ [relacion/tutoria] Handlers registrados');
};