// src/main/handlers/configHandlers.js
const { ipcMain, dialog, app } = require("electron");
const path = require("path");
const fs = require("fs");
const settings = require("../settings");

module.exports = () => {
  // ==========================================================
  // Configuración general (settings.json)
  // ==========================================================
  ipcMain.handle("obtener-config", () => settings.get());

  ipcMain.handle("guardar-config", (event, { key, value }) => {
    return settings.set(key, value);
  });

  // ==========================================================
  // Selector de carpeta para constancias
  // ==========================================================
  ipcMain.handle("seleccionar-directorio", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Seleccionar carpeta para constancias",
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ==========================================================
  // Selector de archivo de imagen (logotipos)
  // ==========================================================
  ipcMain.handle("seleccionar-archivo-imagen", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        { name: "Imágenes", extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"] },
      ],
      title: "Seleccionar logotipo",
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // ==========================================================
  // Guardar logotipo del membrete (uv | msicu)
  // Copia el archivo a userData/logotipos y persiste la ruta en settings
  // ==========================================================
  ipcMain.handle("guardar-logotipo", async (event, { clave, rutaOrigen }) => {
    try {
      if (!["uv", "msicu"].includes(clave)) {
        return { success: false, error: "Clave de logotipo inválida" };
      }
      if (!rutaOrigen || !fs.existsSync(rutaOrigen)) {
        return { success: false, error: "Archivo de origen no encontrado" };
      }

      const dir = path.join(app.getPath("userData"), "logotipos");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const ext = path.extname(rutaOrigen).toLowerCase() || ".png";
      const destino = path.join(dir, `logo-${clave}${ext}`);
      fs.copyFileSync(rutaOrigen, destino);

      const key = clave === "uv" ? "logoUvRuta" : "logoMsicuRuta";
      settings.set(key, destino);

      console.log(`✅ Logotipo ${clave} guardado en: ${destino}`);
      return { success: true, ruta: destino };
    } catch (error) {
      console.error("❌ Error guardando logotipo:", error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================================
  // Obtener logotipos actuales (con data URI para el panel)
  // ==========================================================
  ipcMain.handle("obtener-logotipos", async () => {
    try {
      const config = settings.get();

      const aBase64 = (ruta) => {
        if (!ruta || !fs.existsSync(ruta)) return null;
        const ext = path.extname(ruta).slice(1).toLowerCase() || "png";
        const mime = ext === "svg" ? "image/svg+xml" : `image/${ext}`;
        return `data:${mime};base64,${fs.readFileSync(ruta).toString("base64")}`;
      };

      return {
        success: true,
        data: {
          uv: {
            ruta: config.logoUvRuta || null,
            dataUri: aBase64(config.logoUvRuta),
          },
          msicu: {
            ruta: config.logoMsicuRuta || null,
            dataUri: aBase64(config.logoMsicuRuta),
          },
        },
      };
    } catch (error) {
      console.error("❌ Error obteniendo logotipos:", error);
      return { success: false, error: error.message };
    }
  });
};