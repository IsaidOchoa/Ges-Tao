const { ipcMain } = require("electron");
const { getDB, generarIdGlobal } = require("../database");

module.exports = () => {
  ipcMain.handle("listar-firmantes", async () => {
    try {
      const db = getDB();
      const rows = db
        .prepare("SELECT * FROM firmantes WHERE deleted_at IS NULL ORDER BY texto ASC")
        .all();
      return { success: true, data: rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("guardar-firmante", async (event, datos) => {
    try {
      const db = getDB();
      let stmt;
      if (datos.id) {
        stmt = db.prepare(
          "UPDATE firmantes SET texto = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        );
        stmt.run(datos.texto, datos.id);
      } else {
        const installation = db
          .prepare("SELECT installation_id FROM installation WHERE id = 1")
          .get();
        stmt = db.prepare(
          "INSERT INTO firmantes (id_global, texto) VALUES (?, ?)"
        );
        stmt.run(generarIdGlobal(installation.installation_id), datos.texto);
      }
      return { success: true, message: "Firmante guardado correctamente" };
    } catch (error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        return { success: false, error: "Ya existe un firmante con ese texto." };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("eliminar-firmante", async (event, id) => {
    try {
      const db = getDB();
      
      // Soft delete
      db.prepare("UPDATE firmantes SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      
      return { success: true, message: "Firmante eliminado correctamente" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};