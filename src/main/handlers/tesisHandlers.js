// src/main/handlers/tesisHandlers.js
const { ipcMain } = require("electron");
const { getDB, generarIdGlobal } = require("../database");

const getInstallationId = (db) =>
  db.prepare("SELECT installation_id FROM installation WHERE id = 1").get().installation_id;

module.exports = () => {

  ipcMain.handle("obtener-lista-tesis", async () => {
    try {
      const db = getDB();
      const rows = db.prepare(`
        SELECT t.*,
          a.nombres AS alumno_nombres,
          a.apellido_paterno AS alumno_ap,
          a.apellido_materno AS alumno_am,
          (SELECT nombre FROM tesis_participante WHERE tesis_id=t.id AND rol='director'    AND deleted_at IS NULL LIMIT 1) AS director,
          (SELECT nombre FROM tesis_participante WHERE tesis_id=t.id AND rol='codirector'  AND deleted_at IS NULL LIMIT 1) AS codirector,
          (SELECT nombre FROM tesis_participante WHERE tesis_id=t.id AND rol='presidente'  AND deleted_at IS NULL LIMIT 1) AS presidente,
          (SELECT nombre FROM tesis_participante WHERE tesis_id=t.id AND rol='secretario'  AND deleted_at IS NULL LIMIT 1) AS secretario,
          (SELECT nombre FROM tesis_participante WHERE tesis_id=t.id AND rol='vocal'       AND deleted_at IS NULL LIMIT 1) AS vocal
        FROM tesis t
        LEFT JOIN alumnos a ON t.alumno_id = a.id
        WHERE t.deleted_at IS NULL
        ORDER BY t.folio DESC
      `).all();
      return { success: true, rows };
    } catch (error) {
      console.error("❌ Error listando tesis:", error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================================
  // DETALLE (para editar: tesis + participantes por rol)
  // ==========================================================
  ipcMain.handle("obtener-detalle-tesis", async (event, { id }) => {
    try {
      const db = getDB();
      const tesis = db.prepare("SELECT * FROM tesis WHERE id = ? AND deleted_at IS NULL").get(id);
      if (!tesis) return { success: false, error: "Acta no encontrada" };

      const participantes = db.prepare(
        "SELECT rol, docente_id, nombre FROM tesis_participante WHERE tesis_id = ? AND deleted_at IS NULL"
      ).all(id);

      const map = {};
      participantes.forEach((p) => { map[p.rol] = { docente_id: p.docente_id, nombre: p.nombre }; });

      return { success: true, data: { ...tesis, participantes: map } };
    } catch (error) {
      console.error("❌ Error obteniendo detalle de tesis:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("obtener-alumnos-select", async () => {
    try {
      const db = getDB();
      const rows = db.prepare(
        "SELECT id, matricula, nombres, apellido_paterno, apellido_materno FROM alumnos WHERE estado = 'activo' ORDER BY apellido_paterno, nombres"
      ).all();
      return { success: true, data: rows };
    } catch (error) {
      console.error("❌ Error obteniendo alumnos:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("guardar-tesis", (event, datos) => {
    try {
      const db = getDB();

      const resultado = db.transaction(() => {
        const instId = getInstallationId(db);

        // Validación mínima: alumno obligatorio
        if (!datos.alumno_id) throw new Error("Debe seleccionar un alumno.");

        let tesisId = datos.id ? parseInt(datos.id, 10) : null;

        if (tesisId) {
          db.prepare(`
            UPDATE tesis SET
              fecha = ?, hora = ?, alumno_id = ?, alumno_nombre = ?, alumno_matricula = ?,
              modalidad = ?, titulo = ?, resultado = ?, generacion = ?,
              fecha_asignacion = ?, estado = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND deleted_at IS NULL
          `).run(
            datos.fecha || null, datos.hora || null, datos.alumno_id,
            datos.alumno_nombre, datos.alumno_matricula || null,
            datos.modalidad || "tesis", datos.titulo || null,
            datos.resultado || null, datos.generacion || null,
            datos.fecha_asignacion || null, datos.estado || "aprobada",
            tesisId
          );
        } else {
          // -------- INSERT con folio MAX+1 (respeta canceladas) --------
          const maxRow = db.prepare("SELECT MAX(folio) AS m FROM tesis").get();
          const folio = (maxRow?.m || 0) + 1;

          const stmt = db.prepare(`
            INSERT INTO tesis
              (id_global, folio, fecha, hora, alumno_id, alumno_nombre, alumno_matricula,
               modalidad, titulo, resultado, generacion, fecha_asignacion, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const info = stmt.run(
            generarIdGlobal(instId), folio,
            datos.fecha || null, datos.hora || null,
            datos.alumno_id, datos.alumno_nombre, datos.alumno_matricula || null,
            datos.modalidad || "tesis", datos.titulo || null,
            datos.resultado || null, datos.generacion || null,
            datos.fecha_asignacion || null, datos.estado || "aprobada"
          );
          tesisId = info.lastInsertRowid;
        }

        // -------- PARTICIPANTES: soft-delete de los anteriores + insertar los nuevos --------
        db.prepare(
          "UPDATE tesis_participante SET deleted_at = CURRENT_TIMESTAMP WHERE tesis_id = ? AND deleted_at IS NULL"
        ).run(tesisId);

        const insPart = db.prepare(`
          INSERT INTO tesis_participante
            (id_global, tesis_id, docente_id, nombre, rol)
          VALUES (?, ?, ?, ?, ?)
        `);
        (datos.participantes || []).forEach((p) => {
          if (!p.nombre || !p.rol) return;
          insPart.run(
            generarIdGlobal(instId),
            tesisId,
            p.docente_id || null,
            p.nombre,
            p.rol
          );
        });

        return { success: true, id: tesisId, message: "Acta guardada correctamente" };
      })();

      return resultado;
    } catch (error) {
      console.error("❌ Error guardando tesis:", error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("actualizar-estado-tesis", (event, { id, nuevoEstado }) => {
    try {
      const db = getDB();
      if (!["aprobada", "cancelada"].includes(nuevoEstado)) {
        return { success: false, error: "Estado inválido" };
      }
      const r = db.prepare(
        "UPDATE tesis SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL"
      ).run(nuevoEstado, id);
      if (r.changes === 0) return { success: false, error: "Acta no encontrada" };
      return { success: true };
    } catch (error) {
      console.error("❌ Error actualizando estado de tesis:", error);
      return { success: false, error: error.message };
    }
  });

  console.log("✅ [tesisHandlers] Handlers de tesis registrados");
};