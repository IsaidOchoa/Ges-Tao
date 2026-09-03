// src/main/handlers/relacionHandlers.js

const { ipcMain } = require('electron');
const { getDB, generarIdGlobal } = require('../database');

module.exports = () => {
  
  // =========================================
  // 👨‍🎓 TUTORÍA: Docente ↔ Alumno
  // =========================================
  
  // Listar alumnos disponibles para asignar como tutorados
  ipcMain.handle('listarAlumnosDisponibles', async (event, { excludeTutoradosOf = null }) => {
    try {
      const db = getDB();
      let query = `
        SELECT id, matricula, nombres, apellido_paterno, apellido_materno, correo_contacto, estado 
        FROM alumnos 
        WHERE estado = 'activo'
      `;
      const params = [];
      
      if (excludeTutoradosOf) {
        query += ` AND id NOT IN (
          SELECT alumno_id FROM tutor_alumno WHERE docente_id = ? AND estado = 'activo'
        )`;
        params.push(excludeTutoradosOf);
      }
      
      query += ' ORDER BY apellido_paterno, nombres';
      const rows = db.prepare(query).all(...params);
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error listando alumnos disponibles:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Asignar tutoría (Docente → Alumno)
  ipcMain.handle('asignarTutor', async (event, { docenteId, alumnoId, periodoId }) => {
    try {
      const db = getDB();
      
      const docente = db.prepare('SELECT id FROM docentes WHERE id = ?').get(docenteId);
      const alumno = db.prepare('SELECT id FROM alumnos WHERE id = ?').get(alumnoId);
      
      if (!docente) return { success: false, error: 'Docente no encontrado' };
      if (!alumno) return { success: false, error: 'Alumno no encontrado' };
      
      // Obtener installation_id para generar id_global
      const installation = db.prepare('SELECT installation_id FROM installation WHERE id = 1').get();
      const idGlobal = generarIdGlobal(installation.installation_id);
      
      db.prepare(`
        INSERT INTO tutor_alumno (id_global, docente_id, alumno_id, periodo_id, fecha_asignacion, estado)
        VALUES (?, ?, ?, ?, date('now'), 'activo')
        ON CONFLICT(docente_id, alumno_id) DO UPDATE SET
          periodo_id = excluded.periodo_id,
          fecha_asignacion = date('now'),
          estado = 'activo'
      `).run(idGlobal, docenteId, alumnoId, periodoId || null);
      
      console.log(`✅ Tutoría asignada: Docente #${docenteId} → Alumno #${alumnoId}`);
      return { success: true, message: 'Tutoría asignada correctamente' };
    } catch (error) {
      console.error('❌ Error asignando tutoría:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Remover tutoría
  ipcMain.handle('removerTutor', async (event, { docenteId, alumnoId }) => {
    try {
      const db = getDB();
      
      const result = db.prepare(`
        UPDATE tutor_alumno SET estado = 'inactivo', fecha_baja = date('now')
        WHERE docente_id = ? AND alumno_id = ? AND estado = 'activo'
      `).run(docenteId, alumnoId);
      
      if (result.changes === 0) {
        return { success: false, error: 'Relación activa no encontrada' };
      }
      
      console.log(`✅ Tutoría removida: Docente #${docenteId} ↛ Alumno #${alumnoId}`);
      return { success: true, message: 'Tutoría removida' };
    } catch (error) {
      console.error('❌ Error removiendo tutoría:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Obtener tutorados de un docente
  ipcMain.handle('obtenerTutorados', async (event, { docenteId, periodoId, incluirHistorico = false }) => {
    try {
      const db = getDB();
      let query = `
        SELECT a.id, a.matricula, a.nombres, a.apellido_paterno, a.apellido_materno, 
               a.correo_contacto, t.periodo_id, t.fecha_asignacion, t.estado
        FROM tutor_alumno t
        INNER JOIN alumnos a ON t.alumno_id = a.id
        WHERE t.docente_id = ?
      `;
      const params = [docenteId];
      
      if (!incluirHistorico) {
        query += ' AND t.estado = ?';
        params.push('activo');
      }
      if (periodoId) {
        query += ' AND t.periodo_id = ?';
        params.push(periodoId);
      }
      
      query += ' ORDER BY a.apellido_paterno, a.nombres';
      const rows = db.prepare(query).all(...params);
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error obteniendo tutorados:', error);
      return { success: false, error: error.message };
    }
  });
  
  // =========================================
  // 📚 ASIGNACIÓN DOCENTE ↔ EE (por Periodo)
  // =========================================
  
  // Listar docentes disponibles para dropdowns
  ipcMain.handle('listarDocentesSelect', async (event, { excludeAsignadosA = null, periodoId = null }) => {
    try {
      const db = getDB();
      let query = `SELECT id, codigo, nombres, apellido_paterno, estado FROM docentes WHERE estado = 'activo'`;
      const params = [];
      
      if (excludeAsignadosA && periodoId) {
        query += ` AND id NOT IN (
          SELECT docente_id FROM docente_ee_asignacion 
          WHERE ee_id = ? AND periodo_id = ? AND estado = 'activo'
        )`;
        params.push(excludeAsignadosA, periodoId);
      }
      
      query += ' ORDER BY apellido_paterno, nombres';
      const rows = db.prepare(query).all(...params);
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error listando docentes:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Listar periodos para dropdowns
  ipcMain.handle('listarPeriodosSelect', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT id, clave, descripcion, estado, fecha_inicio
        FROM periodos 
        ORDER BY fecha_inicio DESC
      `).all();
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error listando periodos:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Asignar docente a una EE en un periodo específico
  ipcMain.handle('asignarDocenteEE', async (event, { docenteId, eeId, periodoId, rol = 'titular' }) => {
    try {
      const db = getDB();
      
      if (!periodoId) return { success: false, error: 'El periodo es obligatorio para esta asignación' };
      
      const docente = db.prepare('SELECT id FROM docentes WHERE id = ?').get(docenteId);
      const ee = db.prepare('SELECT id FROM experiencias_educativas WHERE id = ?').get(eeId);
      const periodo = db.prepare('SELECT id FROM periodos WHERE id = ?').get(periodoId);
      
      if (!docente || !ee || !periodo) {
        return { success: false, error: 'Entidad no encontrada' };
      }
      
      // Obtener installation_id para generar id_global
      const installation = db.prepare('SELECT installation_id FROM installation WHERE id = 1').get();
      const idGlobal = generarIdGlobal(installation.installation_id);
      
      db.prepare(`
        INSERT INTO docente_ee_asignacion (id_global, docente_id, ee_id, periodo_id, carga_horaria, fecha_asignacion, estado)
        VALUES (?, ?, ?, ?, 0, date('now'), 'activo')
        ON CONFLICT(docente_id, ee_id, periodo_id) DO UPDATE SET
          fecha_asignacion = date('now'),
          estado = 'activo'
      `).run(idGlobal, docenteId, eeId, periodoId);
      
      console.log(`✅ Docente-EE asignado: Docente #${docenteId} → EE #${eeId} en Periodo #${periodoId}`);
      return { success: true, message: 'Asignación realizada' };
    } catch (error) {
      console.error('❌ Error asignando docente-EE:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Remover asignación docente-EE
  ipcMain.handle('removerDocenteEE', async (event, { docenteId, eeId, periodoId }) => {
    try {
      const db = getDB();
      const result = db.prepare(`
        UPDATE docente_ee_asignacion SET estado = 'inactivo', fecha_desasignacion = date('now')
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'activo'
      `).run(docenteId, eeId, periodoId);
      
      return { 
        success: true, 
        message: result.changes > 0 ? 'Asignación removida' : 'No se encontró la asignación' 
      };
    } catch (error) {
      console.error('❌ Error removiendo asignación:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Obtener EE asignadas a un docente en un periodo
  ipcMain.handle('obtenerEEDelDocente', async (event, { docenteId, periodoId }) => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT e.id, e.clave_ee, e.nombre, e.tipo, a.carga_horaria, a.fecha_asignacion, a.estado
        FROM docente_ee_asignacion a
        INNER JOIN experiencias_educativas e ON a.ee_id = e.id
        WHERE a.docente_id = ? AND a.periodo_id = ? AND a.estado = 'activo'
        ORDER BY e.clave_ee
      `).all(docenteId, periodoId);
      
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error obteniendo EE del docente:', error);
      return { success: false, error: error.message };
    }
  });
  
  console.log('✅ [relacionHandlers] Handlers de relaciones registrados');
};