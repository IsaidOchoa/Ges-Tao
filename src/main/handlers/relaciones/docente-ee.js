// src/main/handlers/relacion/docente-ee.js
const { ipcMain } = require('electron');
const db = require('../../database').getDB();
const { RelationUtils } = require('./utils');

module.exports = () => {
  
  // Listar docentes disponibles (con filtros)
  ipcMain.handle('listarDocentesSelect', async (event, { excludeAsignadosA = null, periodoId = null }) => {
    try {
      const excludeIds = (excludeAsignadosA && periodoId) ? 
        await db.all(`SELECT docente_id FROM docente_ee_asignacion WHERE ee_id = ? AND periodo_id = ? AND estado = 'activo'`, [excludeAsignadosA, periodoId]).then(r => r.map(x => x.docente_id))
        : [];
      
      const rows = await RelationUtils.listarDocentes({ excludeIds });
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error listando docentes:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Listar periodos (reutiliza utils)
  ipcMain.handle('listarPeriodosSelect', async () => {
    try {
      const rows = await RelationUtils.listarPeriodos();
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error listando periodos:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Asignar docente a una EE en un periodo
  ipcMain.handle('asignarDocenteEE', async (event, { docenteId, eeId, periodoId, cargaHoraria = 0, motivo }) => {
    try {
      if (!periodoId) return { success: false, error: 'El periodo es obligatorio' };
      
      const [docente, ee, periodo] = await Promise.all([
        RelationUtils.entityExists('docentes', docenteId),
        RelationUtils.entityExists('experiencias_educativas', eeId),
        RelationUtils.entityExists('periodos', periodoId)
      ]);
      
      if (!docente || !ee || !periodo) return { success: false, error: 'Entidad no encontrada' };
      
      await db.run(`
        INSERT INTO docente_ee_asignacion (docente_id, ee_id, periodo_id, carga_horaria, fecha_asignacion, estado)
        VALUES (?, ?, ?, ?, datetime('now'), 'activo')
        ON CONFLICT(docente_id, ee_id, periodo_id) DO UPDATE SET
          carga_horaria = excluded.carga_horaria,
          fecha_asignacion = datetime('now'),
          estado = 'activo'
      `, [docenteId, eeId, periodoId, cargaHoraria]);
      
      await RelationUtils.registrarAuditoria({
        usuarioId: event.sender.id,
        accion: 'crear',
        tipoRelacion: 'docente_ee',
        entidadA: { id: docenteId, tipo: 'docente' },
        entidadB: { id: eeId, tipo: 'ee' },
        periodoId,
        motivo
      });
      
      return { success: true, message: 'Asignación realizada' };
    } catch (error) {
      console.error('❌ Error asignando docente-EE:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Remover asignación docente-EE
  ipcMain.handle('removerDocenteEE', async (event, { docenteId, eeId, periodoId, motivo }) => {
    try {
      const result = await db.run(`
        UPDATE docente_ee_asignacion SET estado = 'inactivo', fecha_baja = datetime('now')
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'activo'
      `, [docenteId, eeId, periodoId]);
      
      if (result.changes === 0) return { success: false, error: 'Asignación no encontrada' };
      
      await RelationUtils.registrarAuditoria({
        usuarioId: event.sender.id,
        accion: 'eliminar',
        tipoRelacion: 'docente_ee',
        entidadA: { id: docenteId, tipo: 'docente' },
        entidadB: { id: eeId, tipo: 'ee' },
        periodoId,
        motivo
      });
      
      return { success: true, message: 'Asignación removida' };
    } catch (error) {
      console.error('❌ Error removiendo asignación:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Obtener EE asignadas a un docente
  ipcMain.handle('obtenerEEDelDocente', async (event, { docenteId, periodoId }) => {
    try {
      const rows = await db.all(`
        SELECT e.id, e.clave_ee, e.nombre, e.descripcion, a.carga_horaria, a.fecha_asignacion, a.estado
        FROM docente_ee_asignacion a
        INNER JOIN experiencias_educativas e ON a.ee_id = e.id
        WHERE a.docente_id = ? AND a.periodo_id = ?
        ORDER BY e.clave_ee
      `, [docenteId, periodoId]);
      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('❌ Error obteniendo EE del docente:', error);
      return { success: false, error: error.message };
    }
  });

  // Listar EE disponibles para asignar a un docente en un periodo
ipcMain.handle('listarEEDisponibles', async (event, { periodoId, excludeAsignadasA = null }) => {
  try {
    let query = `SELECT id, clave_ee, nombre, creditos, estado FROM experiencias_educativas WHERE estado = 'activa'`;
    const params = [];
    
    // Excluir EE que ya están asignadas a este docente en este periodo
    if (excludeAsignadasA && periodoId) {
      query += ` AND id NOT IN (
        SELECT ee_id FROM docente_ee_asignacion 
        WHERE docente_id = ? AND periodo_id = ? AND estado = 'activo'
      )`;
      params.push(excludeAsignadasA, periodoId);
    }
    
    query += ' ORDER BY clave_ee';
    const rows = await db.all(query, params);
    return { success: true, data: rows || [] };
  } catch (error) {
    console.error('❌ Error listando EE disponibles:', error);
    return { success: false, error: error.message };
  }
});
  
  console.log('✅ [relacion/docente-ee] Handlers registrados');
};