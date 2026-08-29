const fs = require("fs");
const path = require("path");
const { rutaPlantilla } = require("./templates/index");

/**
 * Procesa una plantilla HTML con el sistema de tokens.
 * @param {string} plantillaArchivo - Nombre del archivo de plantilla (ej: "constancia-ee.html")
 * @param {object} datos - Datos a inyectar (folio, docente, ees, tutorados, firmas, etc.)
 * @param {object} textos - Textos personalizables (saludo, mencion_final)
 * @param {string|null} logotipoUrl - URL del logotipo (file://...) o null
 * @returns {string} HTML procesado
 */
function procesarPlantilla(plantillaArchivo, datos, textos, logotipoUrl) {
  const rutaArchivo = rutaPlantilla(plantillaArchivo);
  let html = fs.readFileSync(rutaArchivo, "utf-8");

  // 1. Reemplazar {{LOGO}}
  if (logotipoUrl) {
    html = html.replace("{{LOGO}}", `<img src="${logotipoUrl}" alt="Logotipo">`);
  } else {
    html = html.replace("{{LOGO}}", "");
  }

  // 2. Reemplazar {{DATO:clave}} con valores de datos
  const datosRegex = /\{\{DATO:([a-z_]+)\}\}/g;
  html = html.replace(datosRegex, (match, clave) => {
    return escapeHtml(datos[clave] || "");
  });

  // 3. Reemplazar {{TEXTO:clave}} con valores de textos personalizables
  const textosRegex = /\{\{TEXTO:([a-z_]+)\}\}/g;
  html = html.replace(textosRegex, (match, clave) => {
    return escapeHtml(textos[clave] || "");
  });

  // 4. Procesar {{#LOOP:clave}} ... {{/LOOP:clave}}
  const loopRegex = /\{\{#LOOP:([a-z_]+)\}\}([\s\S]*?)\{\{\/LOOP:\1\}\}/g;
  html = html.replace(loopRegex, (match, clave, template) => {
    const array = datos[clave] || [];
    if (!Array.isArray(array) || array.length === 0) {
      return ""; // Si no hay datos, eliminar el bloque
    }
    return array
      .map((item) => {
        let rowHtml = template;
        // Reemplazar {{campo}} con valores del item
        const campoRegex = /\{\{([a-z_]+)\}\}/g;
        rowHtml = rowHtml.replace(campoRegex, (m, campo) => {
          return escapeHtml(item[campo] || "");
        });
        return rowHtml;
      })
      .join("");
  });

  return html;
}

/**
 * Escapa HTML para prevenir inyección XSS
 */
function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

module.exports = { procesarPlantilla };