const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { rutaPlantilla } = require("./templates/index");

// ⚠️ IMPORTANTE: usar app.getAppPath() y NO __dirname.
// Con el main empaquetado por webpack, __dirname apunta a .webpack/main/,
// no al código fuente. app.getAppPath() apunta a la raíz del proyecto.
const PARTIALS_DIR = path.join(
  app.getAppPath(),
  "src",
  "main",
  "templates",
  "partials",
);

function leerPartial(nombre) {
  const ruta = path.join(PARTIALS_DIR, `${nombre}.html`);
  if (!fs.existsSync(ruta)) {
    console.warn(`⚠️ [templateEngine] Partial NO encontrado: ${ruta}`);
    return `<!-- partial ${nombre} no encontrado -->`;
  }
  return fs.readFileSync(ruta, "utf-8");
}

function procesarPlantilla(plantillaArchivo, datos, textos, logos = {}) {
  let html = fs.readFileSync(rutaPlantilla(plantillaArchivo), "utf-8");

  // 1. INCLUDE de parciales (antes que cualquier token)
  html = html.replace(/\{\{INCLUDE:([a-z_]+)\}\}/g, (m, nombre) =>
    leerPartial(nombre),
  );

  // 2. Logotipos globales: {{LOGO:uv}} / {{LOGO:msicu}}
  html = html.replace(/\{\{LOGO:([a-z_]+)\}\}/g, (m, clave) => {
    return logos[clave] ? `<img src="${logos[clave]}" alt="${clave}">` : "";
  });

  // 3. Datos de BD
  html = html.replace(/\{\{DATO:([a-z_]+)\}\}/g, (m, clave) =>
    escapeHtml(datos[clave] ?? ""),
  );

  // 4. Textos personalizables
  html = html.replace(/\{\{TEXTO:([a-z_]+)\}\}/g, (m, clave) =>
    escapeHtml(textos[clave] ?? ""),
  );

  // 5. Loops
  html = html.replace(
    /\{\{#LOOP:([a-z_]+)\}\}([\s\S]*?)\{\{\/LOOP:\1\}\}/g,
    (m, clave, template) => {
      const arr = datos[clave];
      if (!Array.isArray(arr) || arr.length === 0) return "";
      return arr
        .map((item) =>
          template.replace(/\{\{([a-z_]+)\}\}/g, (mm, campo) =>
            escapeHtml(item[campo] ?? ""),
          ),
        )
        .join("");
    },
  );

  return html;
}

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