const { ipcMain } = require("electron");
const { getDB, generarIdGlobal } = require("../../database");

module.exports = () => {
  // ==========================================
  // 1. Obtener EE asignadas a un docente (Contexto Docente)
  // ==========================================

  ipcMain.handle("obtenerEEDelDocente", async (event, { docenteId, periodoId }) => {
    try {
      console.log("[BACKEND] obtenerEEDelDocente llamado:", { docenteId, periodoId });

      const db = getDB();
      const rows = db
        .prepare(
          `
      SELECT 
        e.id,
        e.clave_ee,
        e.nombre,
        e.creditos_teoria,
        e.creditos_practica,
        e.creditos_otros,
        e.horas_teoria,
        e.horas_practica,
        (COALESCE(e.creditos_teoria,0) || '/' || COALESCE(e.creditos_practica,0) || '/' || COALESCE(e.creditos_otros,0)) as creditos_ee,
        (COALESCE(e.horas_teoria,0) || '/' || COALESCE(e.horas_practica,0)) as horas_ee,
        a.carga_horaria
      FROM docente_ee_asignacion a
      INNER JOIN experiencias_educativas e ON a.ee_id = e.id
      WHERE a.docente_id = ? 
        AND a.periodo_id = ? 
        AND a.estado = 'activo'
        AND e.estado = 'activa'
      ORDER BY e.clave_ee
    `,
        )
        .all(docenteId, periodoId);

      console.log("[BACKEND] EE encontradas:", rows.length);
      console.log("[BACKEND] Primera EE:", rows[0]);

      return { success: true, data: rows };
    } catch (error) {
      console.error("❌ Error obteniendo EE del docente:", error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 2. Listar EE disponibles para asignar (EXCLUIR asignadas activas)
  // ==========================================
  ipcMain.handle(
    "listarEEDisponibles",
    async (event, { periodoId, excludeAsignadasA = null }) => {
      try {
        const db = getDB();
        let query = `SELECT id, clave_ee, nombre, creditos FROM experiencias_educativas WHERE estado = 'activa'`;
        const params = [];

        if (excludeAsignadasA && periodoId) {
          query += ` AND id NOT IN (
          SELECT ee_id FROM docente_ee_asignacion 
          WHERE docente_id = ? AND periodo_id = ? AND estado = 'activo'
        )`;
          params.push(excludeAsignadasA, periodoId);
        }

        query += " ORDER BY nombre";
        const rows = db.prepare(query).all(...params);

        return { success: true, data: rows };
      } catch (error) {
        console.error("❌ Error listando EE disponibles:", error);
        return { success: false, error: error.message };
      }
    },
  );

  // ==========================================
  // 3. Asignar EE a docente (VERIFICAR solo activas)
  // ==========================================
  ipcMain.handle(
    "asignarEEAdocente",
    async (event, { docenteId, eeId, periodoId, cargaHoraria = 0 }) => {
      try {
        const db = getDB();

        const exists = db
          .prepare(
            `
        SELECT id FROM docente_ee_asignacion 
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'activo'
      `,
          )
          .get(docenteId, eeId, periodoId);

        if (exists) {
          return {
            success: false,
            error:
              "La Experiencia Educativa ya está asignada activamente a este docente en este periodo",
          };
        }

        const inactiveRecord = db
          .prepare(
            `
        SELECT id FROM docente_ee_asignacion 
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'inactivo'
      `,
          )
          .get(docenteId, eeId, periodoId);

        if (inactiveRecord) {
          db.prepare(
            `
          UPDATE docente_ee_asignacion 
          SET estado = 'activo', carga_horaria = ?, fecha_asignacion = date('now')
          WHERE id = ?
        `,
          ).run(cargaHoraria, inactiveRecord.id);

          return {
            success: true,
            message: "Experiencia Educativa re-asignada correctamente",
            action: "reactivated",
          };
        }

        // Obtener installation_id para generar id_global
        const installation = db
          .prepare("SELECT installation_id FROM installation WHERE id = 1")
          .get();
        const idGlobal = generarIdGlobal(installation.installation_id);

        db.prepare(
          `
        INSERT INTO docente_ee_asignacion (id_global, docente_id, ee_id, periodo_id, carga_horaria, estado, fecha_asignacion)
        VALUES (?, ?, ?, ?, ?, 'activo', date('now'))
      `,
        ).run(idGlobal, docenteId, eeId, periodoId, cargaHoraria);

        return {
          success: true,
          message: "Experiencia Educativa asignada correctamente",
          action: "inserted",
        };
      } catch (error) {
        console.error("❌ Error asignando EE:", error);
        if (error.message.includes("UNIQUE constraint failed")) {
          return {
            success: false,
            error:
              "Ya existe una asignación con estos parámetros. Verifica el estado.",
          };
        }
        return { success: false, error: error.message };
      }
    },
  );

  // ==========================================
  // 4. Remover EE de docente (Soft Delete + Limpieza de Estadísticas)
  // ==========================================
  ipcMain.handle("removerDocenteEE", async (event, { docenteId, eeId, periodoId }) => {
    try {
      const db = getDB();

      // 1. Marcar la asignación como inactiva
      const result = db
        .prepare(
          `
        UPDATE docente_ee_asignacion 
        SET estado = 'inactivo', fecha_desasignacion = date('now')
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'activo'
      `,
        )
        .run(docenteId, eeId, periodoId);

      if (result.changes === 0) {
        return { success: false, error: "Asignación activa no encontrada" };
      }

      // 2. ELIMINAR las estadísticas de alumnos asociadas a esta relación
      db.prepare(
        `
        DELETE FROM estadisticas_ee_periodo 
        WHERE ee_id = ? AND periodo_id = ?
      `,
      ).run(eeId, periodoId);

      console.log(
        `✅ [BACKEND] Asignación removida y estadísticas limpiadas para EE: ${eeId}, Periodo: ${periodoId}`,
      );

      return {
        success: true,
        message: "Asignación removida correctamente",
        changes: result.changes,
      };
    } catch (error) {
      console.error("❌ Error en removerDocenteEE:", error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 5. Obtener el docente asignado a una EE (Contexto EE)
  // ==========================================
  ipcMain.handle("obtenerDocenteDeEE", async (event, { eeId, periodoId }) => {
    try {
      const db = getDB();
      const rows = db
        .prepare(
          `
      SELECT 
        d.id,
        d.codigo,
        d.nombres,
        d.apellido_paterno,
        d.apellido_materno,
        d.tratamiento,
        d.correo_contacto as correo,
        (d.tratamiento || ' ' || d.apellido_paterno || ' ' || COALESCE(d.apellido_materno,'') || ' ' || d.nombres) as nombre_completo
      FROM docente_ee_asignacion a
      INNER JOIN docentes d ON a.docente_id = d.id
      WHERE a.ee_id = ? 
        AND a.periodo_id = ? 
        AND a.estado = 'activo'
        AND d.estado = 'activo'
    `,
        )
        .all(eeId, periodoId);

      return { success: true, data: rows };
    } catch (error) {
      console.error(" Error obteniendo docente de EE:", error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 6. Actualizar carga horaria de la asignación (Edición inline)
  // ==========================================
  ipcMain.handle(
    "actualizarRelacionDocenteEE",
    async (event, { docenteId, eeId, periodoId, carga_horaria }) => {
      try {
        const db = getDB();
        const result = db
          .prepare(
            `
        UPDATE docente_ee_asignacion 
        SET carga_horaria = ?
        WHERE docente_id = ? AND ee_id = ? AND periodo_id = ? AND estado = 'activo'
      `,
          )
          .run(carga_horaria, docenteId, eeId, periodoId);

        return { success: true, changes: result.changes };
      } catch (error) {
        console.error("❌ Error actualizando relación docente-EE:", error);
        return { success: false, error: error.message };
      }
    },
  );

  // ==========================================
  // 7. Listar docentes para selects (Reutilizable)
  // ==========================================
  ipcMain.handle(
    "listarDocentesSelect",
    async (event, { periodoId, excludeIds = [] } = {}) => {
      try {
        const db = getDB();
        let query = `SELECT id, codigo, nombres, apellido_paterno, apellido_materno, tratamiento, correo_contacto as correo, estado FROM docentes WHERE estado = 'activo'`;
        const params = [];

        if (excludeIds && excludeIds.length > 0) {
          query += ` AND id NOT IN (${excludeIds.map(() => "?").join(",")})`;
          params.push(...excludeIds);
        }

        query += " ORDER BY apellido_paterno, nombres";
        const rows = db.prepare(query).all(...params);

        return { success: true, data: rows };
      } catch (error) {
        console.error("❌ Error listando docentes para select:", error);
        return { success: false, error: error.message };
      }
    },
  );

  // ==========================================
  // 8. Obtener estadísticas de alumnos por EE
  // ==========================================
  ipcMain.handle("obtenerEstadisticasEE", async (event, { eeId, periodoId }) => {
    try {
      const db = getDB();
      const stats = db
        .prepare(
          `
        SELECT total_alumnos 
        FROM estadisticas_ee_periodo 
        WHERE ee_id = ? AND periodo_id = ?
      `,
        )
        .get(eeId, periodoId);

      return { success: true, data: stats || { total_alumnos: 0 } };
    } catch (error) {
      console.error("❌ Error obteniendo estadísticas:", error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // 9. Actualizar estadísticas de alumnos (Upsert) - CORREGIDO
  // ==========================================
  ipcMain.handle(
    "actualizarEstadisticasEE",
    async (event, { eeId, periodoId, total_alumnos }) => {
      try {
        const db = getDB();

        const existing = db
          .prepare(
            `
        SELECT id FROM estadisticas_ee_periodo 
        WHERE ee_id = ? AND periodo_id = ?
      `,
          )
          .get(eeId, periodoId);

        if (existing) {
          // UPDATE: usar updated_at en lugar de ultima_actualizacion
          db.prepare(
            `
          UPDATE estadisticas_ee_periodo 
          SET total_alumnos = ?, updated_at = CURRENT_TIMESTAMP
          WHERE ee_id = ? AND periodo_id = ?
        `,
          ).run(total_alumnos, eeId, periodoId);
        } else {
          // INSERT: generar id_global y usar updated_at
          const installation = db
            .prepare("SELECT installation_id FROM installation WHERE id = 1")
            .get();
          const idGlobal = generarIdGlobal(installation.installation_id);

          db.prepare(
            `
          INSERT INTO estadisticas_ee_periodo (id_global, ee_id, periodo_id, total_alumnos, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `,
          ).run(idGlobal, eeId, periodoId, total_alumnos);
        }

        return { success: true };
      } catch (error) {
        console.error("❌ Error actualizando estadísticas:", error);
        return { success: false, error: error.message };
      }
    },
  );

  console.log("[docenteEEHandlers] Handlers registrados con consistencia de estado");
};