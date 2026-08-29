//src/main/handlers/relaciones/alumnoTutorHandlers.js
const { ipcMain } = require('electron');
const { getDB } = require('../../database');

module.exports = () => {
  
  // ==========================================
  // 1. Obtener el tutor asignado a un alumno (Contexto Alumno)
  // ==========================================
  ipcMain.handle('obtenerTutorDeAlumno', async (event, { alumnoId, periodoId }) => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT d.id, d.codigo, d.nombres, d.apellido_paterno, d.apellido_materno, d.tratamiento, d.correo_contacto as correo
        FROM docentes d
        INNER JOIN tutor_alumno t ON d.id = t.docente_id
        WHERE t.alumno_id = ? 
          AND t.periodo_id = ? 
          AND t.estado = 'activo'
      `).all(alumnoId, periodoId);
      
      return { success: true, data: rows };
    } catch (error) {
      console.error('❌ Error obteniendo tutor de alumno:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 2. Obtener histórico de EE del alumno (Para la pestaña "Consultar")
  // ==========================================
  ipcMain.handle('obtenerEEDeAlumno', async (event, { alumnoId }) => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT e.id, e.clave_ee, e.nombre, p.descripcion as periodo, i.activo
        FROM experiencias_educativas e
        INNER JOIN inscripciones i ON e.id = i.ee_id
        LEFT JOIN periodos p ON i.periodo_id = p.id
        WHERE i.alumno_id = ?
        ORDER BY p.fecha_inicio DESC
      `).all(alumnoId);
      
      // Mapeamos para que el frontend reciba el formato que espera
      const data = rows.map(r => ({
        ...r,
        carga_horaria: r.activo === 1 ? 'Activa' : 'Baja'
      }));

      return { success: true, data: data };
    } catch (error) {
      console.error('❌ Error obteniendo EE de alumno:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ [alumnoTutorHandlers] Handlers registrados');
};