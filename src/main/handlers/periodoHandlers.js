// src/main/handlers/periodoHandlers.js
const { ipcMain } = require("electron");
const { getDB } = require("../database");

module.exports = () => {
  // ==========================================
  // LISTAR PERIODOS
  // ==========================================
  ipcMain.handle("obtener-periodos", async () => {
    try {
      const db = getDB();
      const rows = db
        .prepare("SELECT * FROM periodos ORDER BY fecha_inicio DESC")
        .all();
      return { success: true, data: rows };
    } catch (error) {
      console.error("❌ [PeriodoHandlers] Error obteniendo periodos:", error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // GUARDAR PERIODO (Insertar o Actualizar)
  // ==========================================
  ipcMain.handle("guardar-periodo", async (event, datos) => {
    try {
      const db = getDB();

      if (datos.es_vigente_forzado === 1) {
        db.prepare(
          `
        UPDATE periodos SET es_vigente_forzado = 0 
        WHERE es_vigente_forzado = 1 AND id != ?
      `,
        ).run(datos.id || 0);
      }

      let stmt;
      if (datos.id) {
        // UPDATE
        stmt = db.prepare(
          `UPDATE periodos SET 
          clave = ?, descripcion = ?, fecha_inicio = ?, fecha_fin = ?, 
          estado = ?, es_vigente_forzado = ? 
        WHERE id = ?`,
        );
        stmt.run(
          datos.clave,
          datos.descripcion,
          datos.fecha_inicio,
          datos.fecha_fin,
          datos.estado,
          datos.es_vigente_forzado ?? 0,
          datos.id,
        );
      } else {
        // INSERT
        stmt = db.prepare(
          `INSERT INTO periodos (clave, descripcion, fecha_inicio, fecha_fin, estado, es_vigente_forzado) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        );
        stmt.run(
          datos.clave,
          datos.descripcion,
          datos.fecha_inicio,
          datos.fecha_fin,
          datos.estado || "activo",
          datos.es_vigente_forzado ?? 0,
        );
      }
      return { success: true, message: "Periodo guardado correctamente" };
    } catch (error) {
      console.error("❌ [PeriodoHandlers] Error guardando periodo:", error);
      if (error.message.includes("UNIQUE constraint failed")) {
        return { success: false, error: "La clave del periodo ya existe." };
      }
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // ACTUALIZAR ESTADO DE PERIODO
  // ==========================================
  ipcMain.handle(
    "actualizar-estado-periodo",
    async (event, { id, nuevoEstado, es_vigente_forzado }) => {
      try {
        const db = getDB();

        // VALIDAR ESTADOS REALES (activo/inactivo)
        if (!["activo", "inactivo"].includes(nuevoEstado)) {
          return {
            success: false,
            error: "Estado inválido. Permitidos: activo, inactivo",
          };
        }

        // Verificar que el periodo existe
        const periodo = db
          .prepare("SELECT id, estado FROM periodos WHERE id = ?")
          .get(id);
        if (!periodo) {
          return { success: false, error: "Periodo no encontrado" };
        }

        // Actualizar estado Y opcionalmente el flag de vigencia forzada
        if (es_vigente_forzado !== undefined) {
          // Si se pasa el flag, actualizar ambos campos
          db.prepare(
            "UPDATE periodos SET estado = ?, es_vigente_forzado = ? WHERE id = ?",
          ).run(nuevoEstado, es_vigente_forzado, id);
        } else {
          // Si no se pasa el flag, solo actualizar estado
          db.prepare("UPDATE periodos SET estado = ? WHERE id = ?").run(
            nuevoEstado,
            id,
          );
        }

        console.log(
          `✅ Periodo ${id} actualizado: ${periodo.estado} → ${nuevoEstado}`,
        );
        return { success: true };
      } catch (err) {
        console.error("❌ Error actualizando periodo:", err);
        return { success: false, error: err.message };
      }
    },
  );
};
