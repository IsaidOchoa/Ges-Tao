/** src/main/templates/index.js */
const path = require("node:path");
const fs = require("node:fs");
const { app } = require("electron");

/**
 * Resuelve la ruta física de una plantilla y verifica que exista.
 * La fuente de verdad de "qué archivo usa cada tipo" es formatos_constancia;
 * este módulo solo resuelve y valida la existencia del archivo.
 */
function rutaPlantilla(archivo) {
  const ruta = path.join(app.getAppPath(), "src", "main", "templates", archivo);
  if (!fs.existsSync(ruta)) {
    throw new Error(
      `La plantilla "${archivo}" no existe en esta versión de Ges-TAO. ` +
      `Actualiza la aplicación o verifica el archivo de formato.`
    );
  }
  return ruta;
}

function plantillaDisponible(archivo) {
  return fs.existsSync(
    path.join(app.getAppPath(), "src", "main", "templates", archivo)
  );
}

module.exports = { rutaPlantilla, plantillaDisponible };