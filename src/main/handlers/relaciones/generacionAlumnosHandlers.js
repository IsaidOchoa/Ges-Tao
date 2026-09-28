// src/main/handlers/relaciones/generacionAlumnosHandlers.js

const { ipcMain } = require('electron');
const { getDB } = require('../../database');

module.exports = () => {

  // =========================================
  // GENERACIÓN <> ALUMNO (relación permanente, sin periodo)
  // =========================================

  // Listar generaciones activas para el selector (contexto alumno)
  ipcMain.handle('listarGeneracionesSelect', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT g.id, g.clave, g.nombre, p.clave AS periodo_ingreso
        FROM generaciones g
        LEFT JOIN periodos p ON g.periodo_ingreso_id = p.id
        WHERE g.estado = 'activa' AND g.deleted_at IS NULL
        ORDER BY g.clave
      `).all();
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error listando generaciones:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener la generación de un alumno (contexto alumno, singleItem)
  ipcMain.handle('obtenerGeneracionDeAlumno', async (event, { alumnoId }) => {
    try {
      const db = getDB();
      const row = db.prepare(`
        SELECT g.id, g.clave, g.nombre, p.clave AS periodo_ingreso
        FROM alumnos a
        INNER JOIN generaciones g ON a.generacion_id = g.id
        LEFT JOIN periodos p ON g.periodo_ingreso_id = p.id
        WHERE a.id = ? AND g.deleted_at IS NULL
      `).get(alumnoId);
      return { success: true, data: row ? [row] : [] };
    } catch (error) {
      console.error('❌ Error obteniendo generación del alumno:', error);
      return { success: false, error: error.message };
    }
  });

  // Listar alumnos de una generación (contexto generación, lista)
  ipcMain.handle('obtenerAlumnosDeGeneracion', async (event, { generacionId }) => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT id, matricula, nombres, apellido_paterno, apellido_materno,
               correo_contacto, programa_academico, estado
        FROM alumnos
        WHERE generacion_id = ? AND deleted_at IS NULL AND estado = 'activo'
        ORDER BY apellido_paterno, nombres
      `).all(generacionId);
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error obteniendo alumnos de generación:', error);
      return { success: false, error: error.message };
    }
  });

  // Listar alumnos SIN generación (para el selector al asignar desde generación)
  ipcMain.handle('listarAlumnosSinGeneracion', async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT id, matricula, nombres, apellido_paterno, apellido_materno
        FROM alumnos
        WHERE generacion_id IS NULL AND deleted_at IS NULL AND estado = 'activo'
        ORDER BY apellido_paterno, nombres
      `).all();
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error listando alumnos sin generación:', error);
      return { success: false, error: error.message };
    }
  });

  // Asignar generación a un alumno (UPDATE del campo, no tabla intermedia)
  ipcMain.handle('asignarGeneracionAlumno', async (event, { alumnoId, generacionId }) => {
    try {
      const db = getDB();

      const alumno = db.prepare('SELECT id FROM alumnos WHERE id = ?').get(alumnoId);
      const generacion = db.prepare('SELECT id FROM generaciones WHERE id = ?').get(generacionId);

      if (!alumno) return { success: false, error: 'Alumno no encontrado' };
      if (!generacion) return { success: false, error: 'Generación no encontrada' };

      db.prepare(`
        UPDATE alumnos
        SET generacion_id = ?, updated_at = CURRENT_TIMESTAMP, version = version + 1
        WHERE id = ?
      `).run(generacionId, alumnoId);

      console.log(`✅ Generación asignada: Alumno #${alumnoId} → Generación #${generacionId}`);
      return { success: true, message: 'Generación asignada correctamente' };
    } catch (error) {
      console.error('❌ Error asignando generación:', error);
      return { success: false, error: error.message };
    }
  });

  // Desasignar generación de un alumno
  ipcMain.handle('removerGeneracionDeAlumno', async (event, { alumnoId }) => {
    try {
      const db = getDB();

      const alumno = db.prepare('SELECT id, generacion_id FROM alumnos WHERE id = ?').get(alumnoId);
      if (!alumno) return { success: false, error: 'Alumno no encontrado' };
      if (!alumno.generacion_id) return { success: false, error: 'El alumno no tiene generación asignada' };

      db.prepare(`
        UPDATE alumnos
        SET generacion_id = NULL, updated_at = CURRENT_TIMESTAMP, version = version + 1
        WHERE id = ?
      `).run(alumnoId);

      console.log(`✅ Generación desasignada: Alumno #${alumnoId}`);
      return { success: true, message: 'Generación desasignada correctamente' };
    } catch (error) {
      console.error('❌ Error desasignando generación:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ [relaciones/generacionAlumnos] Handlers registrados');
};