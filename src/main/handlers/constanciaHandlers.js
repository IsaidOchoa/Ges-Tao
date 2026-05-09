const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  ipcMain.handle('obtener-datos-constancia', async () => {
    try {
      const db = getDB();
      const docentes = db.prepare("SELECT id, codigo, apellido_paterno, nombres FROM docentes WHERE estado = 'activo' ORDER BY apellido_paterno ASC").all();
      const periodos = db.prepare("SELECT id, clave, descripcion FROM periodos WHERE estado != 'cerrado' ORDER BY fecha_inicio DESC").all();
      const ee = db.prepare("SELECT id, clave_ee, nombre FROM experiencias_educativas WHERE estado = 'activa' ORDER BY nombre ASC").all();
      const programas = db.prepare("SELECT id, nombre FROM programas_institucionales WHERE estado = 'vigente' ORDER BY nombre ASC").all();
      const tipos = db.prepare("SELECT id, nombre, requiere_ee, requiere_periodo FROM tipos_constancia WHERE estado = 'activo' ORDER BY nombre ASC").all();

      return { 
        success: true, 
        data: { docentes, periodos, ee, programas, tipos }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('guardar-constancia', async (event, datos) => {
    try {
      const db = getDB();
      const folio = `CONST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      
      const stmt = db.prepare(`
        INSERT INTO constancias (folio, docente_id, periodo_id, ee_id, programa_id, tipo_constancia_id, estado, fecha_emision)
        VALUES (?, ?, ?, ?, ?, ?, 'emitida', date('now'))
      `);
      
      stmt.run(
        folio,
        datos.docente_id,
        datos.periodo_id || null,
        datos.ee_id || null,
        datos.programa_id || null,
        datos.tipo_constancia_id
      );

      db.prepare(`INSERT INTO historial_auditoria (accion, tabla_afectada, registro_id, detalles, fecha_sistema) 
                  VALUES ('EMITIR_CONSTANCIA', 'constancias', last_insert_rowid(), ?, datetime('now'))`)
        .run(JSON.stringify({ folio, ...datos }));

      return { success: true, folio, message: 'Constancia emitida correctamente.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('obtener-biblioteca-constancias', async () => {
    try {
      const db = getDB();
      const query = `
        SELECT 
          c.id, c.folio, c.estado, c.fecha_emision,
          t.nombre as tipo_nombre,
          d.apellido_paterno, d.nombres,
          p.clave as periodo_clave
        FROM constancias c
        LEFT JOIN docentes d ON c.docente_id = d.id
        LEFT JOIN periodos p ON c.periodo_id = p.id
        LEFT JOIN tipos_constancia t ON c.tipo_constancia_id = t.id
        ORDER BY c.fecha_emision DESC
      `;
      const rows = db.prepare(query).all();
      return { success: true, rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};