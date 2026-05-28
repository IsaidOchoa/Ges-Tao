// src/main/handlers/constanciaHandlers.js
const { ipcMain, BrowserWindow, app } = require("electron");
const path = require("path");
const fs = require("fs");
const { getDB } = require("../database");
const settings = require("../settings");

/**
 * Genera folio secuencial seguro: CO/MSICU/NNNN/AAAA
 */
function generarFolioSecuencial(db) {
  const year = new Date().getFullYear();

  const result = db
    .prepare(
      `
    SELECT folio FROM constancias 
    WHERE folio LIKE ? 
    ORDER BY id DESC LIMIT 1
  `,
    )
    .get(`CO/MSICU/%/${year}`);

  let nextNum = 1;
  if (result && result.folio) {
    const match = result.folio.match(/CO\/MSICU\/(\d+)\/\d{4}/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `CO/MSICU/${String(nextNum).padStart(4, "0")}/${year}`;
}

/**
 * Valida datos según el tipo de constancia
 * 🔹 CORRECCIÓN: Usar comillas simples 'valor' para literales de texto en SQLite
 */
function validarConstancia(db, datos, tipo) {
  const errores = [];

  // Docente siempre requerido
  const docente = db
    .prepare("SELECT id FROM docentes WHERE id = ? AND estado = ?")
    .get(datos.docente_id, "activo");
  if (!docente)
    errores.push("El docente seleccionado no existe o está inactivo.");

  // Programa institucional SIEMPRE requerido
  if (!datos.programa_id) {
    errores.push("Debe seleccionar un Programa Institucional.");
  } else {
    const programa = db
      .prepare(
        "SELECT id FROM programas_institucionales WHERE id = ? AND estado = ?",
      )
      .get(datos.programa_id, "vigente");
    if (!programa)
      errores.push("El programa institucional seleccionado no es válido.");
  }

  // Validar tipo
  if (!tipo) {
    errores.push("El tipo de constancia no es válido.");
    return errores;
  }

  // Validaciones condicionales según tipo
  if (tipo.requiere_ee === 1 && !datos.ee_id) {
    errores.push(
      `El tipo "${tipo.nombre}" requiere una Experiencia Educativa.`,
    );
  }

  if (tipo.requiere_periodo === 1 && !datos.periodo_id) {
    errores.push(`El tipo "${tipo.nombre}" requiere un Periodo Escolar.`);
  }

  // Validar EE si se proporcionó
  if (datos.ee_id) {
    const ee = db
      .prepare(
        "SELECT id FROM experiencias_educativas WHERE id = ? AND estado = ?",
      )
      .get(datos.ee_id, "activa");
    if (!ee)
      errores.push("La Experiencia Educativa no existe o está inactiva.");
  }

  // Validar Periodo si se proporcionó
  if (datos.periodo_id) {
    const periodo = db
      .prepare("SELECT id FROM periodos WHERE id = ? AND estado != ?")
      .get(datos.periodo_id, "cerrado");
    if (!periodo) errores.push("El periodo no existe o está cerrado.");
  }

  return errores;
}

module.exports = () => {
  // ==========================================================
  // HANDLER: Obtener catálogos para emisión
  // ==========================================================
  ipcMain.handle("obtener-datos-constancia", async () => {
    try {
      const db = getDB();

      const directivos = db
        .prepare(
          `
          SELECT id, cargo, nombre_completo, grado_academico 
          FROM directivos 
          WHERE estado = ? 
          ORDER BY 
            CASE cargo 
              WHEN 'directora' THEN 1 
              WHEN 'secretaria_academica' THEN 2 
              WHEN 'coordinadora_posgrado' THEN 3 
              WHEN 'administradora' THEN 4 
            END
        `,
        )
        .all("vigente");

      const tipos = db
        .prepare(
          `
          SELECT id, clave, nombre, descripcion, requiere_ee, requiere_periodo 
          FROM tipos_constancia 
          WHERE estado = ? 
          ORDER BY 
            CASE clave 
              WHEN 'EE' THEN 1 WHEN 'DT' THEN 2 WHEN 'JE' THEN 3 
              WHEN 'SNP' THEN 4 WHEN 'EV' THEN 5 WHEN 'TUT' THEN 6 
              ELSE 7 END, nombre ASC
        `,
        )
        .all("activo");

      const docentes = db
        .prepare(
          `
          SELECT id, codigo, apellido_paterno, apellido_materno, nombres, tratamiento
          FROM docentes WHERE estado = ? ORDER BY apellido_paterno, nombres
        `,
        )
        .all("activo");

      const periodos = db
        .prepare(
          `
          SELECT id, clave, descripcion, fecha_inicio, fecha_fin 
          FROM periodos WHERE estado != ? ORDER BY fecha_inicio DESC
        `,
        )
        .all("cerrado");

      const ee = db
        .prepare(
          `
          SELECT id, clave_ee, nombre, tipo 
          FROM experiencias_educativas WHERE estado = ? ORDER BY nombre
        `,
        )
        .all("activa");

      const programas = db
        .prepare(
          `
          SELECT id, nombre, descripcion 
          FROM programas_institucionales WHERE estado = ? ORDER BY nombre
        `,
        )
        .all("vigente");

      return {
        success: true,
        data: {
          directivos: directivos || [],
          tipos: tipos || [],
          docentes: docentes || [],
          periodos: periodos || [],
          ee: ee || [],
          programas: programas || [],
        },
      };
    } catch (error) {
      console.error("❌ Error en obtener-datos-constancia:", error);
      return {
        success: false,
        error: error.message,
        data: {
          directivos: [],
          tipos: [],
          docentes: [],
          periodos: [],
          ee: [],
          programas: [],
        },
      };
    }
  });

  // ==========================================================
  // HANDLER: Guardar constancia (versión básica - sin PDF)
  // ==========================================================
  ipcMain.handle("guardar-constancia", (event, datos) => {
    try {
      const db = getDB();

      const resultado = db.transaction(() => {
        const tipo = db
          .prepare(
            `
          SELECT id, nombre, requiere_ee, requiere_periodo 
          FROM tipos_constancia WHERE id = ? AND estado = ?
        `,
          )
          .get(datos.tipo_constancia_id, "activo");

        const errores = validarConstancia(db, datos, tipo);
        if (errores.length > 0) {
          throw new Error(errores.join(" "));
        }

        const folio = generarFolioSecuencial(db);

        const stmt = db.prepare(`
          INSERT INTO constancias 
          (folio, docente_id, periodo_id, ee_id, programa_id, tipo_constancia_id, estado, fecha_emision)
          VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))
        `);

        const info = stmt.run(
          folio,
          datos.docente_id,
          datos.periodo_id || null,
          datos.ee_id || null,
          datos.programa_id,
          datos.tipo_constancia_id,
          "emitida",
        );

        db.prepare(
          `
          INSERT INTO historial_auditoria 
          (accion, tabla_afectada, registro_id, detalles, fecha_sistema) 
          VALUES (?, ?, ?, ?, datetime('now'))
        `,
        ).run(
          "EMITIR_CONSTANCIA",
          "constancias",
          info.lastInsertRowid,
          JSON.stringify({ folio, tipo: tipo?.nombre, ...datos }),
        );

        return {
          success: true,
          id: info.lastInsertRowid,
          folio,
          message: "Constancia emitida correctamente",
        };
      })();

      return resultado;
    } catch (error) {
      console.error("❌ Error en guardar-constancia:", error.message);
      return {
        success: false,
        error: error.message,
        code: "VALIDATION_ERROR",
      };
    }
  });

  
    // ==========================================================
  // HANDLER: Generar constancia con PDF nativo (PRODUCCIÓN)
  // ==========================================================
  ipcMain.handle("generar-constancia-pdf", async (event, payload) => {
    const db = getDB();
    const config = settings.get();
    const rutaBase = config.rutaConstancias || app.getPath("documents");

    let constanciaId = null;
    let folio = null;

    try {
      // ==========================================================
      // 1. TRANSACCIÓN ATÓMICA: Folio + Insert en BD
      // ==========================================================
      const resultado = db.transaction(() => {
        const tipo = db
          .prepare(
            `
          SELECT id, nombre, requiere_ee, requiere_periodo 
          FROM tipos_constancia WHERE id = ? AND estado = ?
        `,
          )
          .get(payload.tipo_constancia_id, "activo");

        const errores = validarConstancia(db, payload, tipo);
        if (errores.length > 0) {
          throw new Error(errores.join(" "));
        }

        folio = generarFolioSecuencial(db);

        const stmt = db.prepare(`
        INSERT INTO constancias 
        (folio, docente_id, periodo_id, ee_id, programa_id, tipo_constancia_id, fecha_emision, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

        const info = stmt.run(
          folio,
          payload.docente_id,
          payload.periodo_id || null,
          payload.ee_id || null,
          payload.programa_id,
          payload.tipo_constancia_id,
          payload.fecha_emision || new Date().toISOString().split("T")[0],
          "emitida",
        );

        return { constanciaId: info.lastInsertRowid };
      })();

      constanciaId = resultado.constanciaId;
      
      // 🔹 CORRECCIÓN CLAVE: Sanitizar folio para nombre de archivo
      const folioSanitized = folio.replace(/\//g, "-");
      // ✅ USAR folioSanitized para la ruta del archivo
      const filePath = path.join(rutaBase, `${folioSanitized}.pdf`);

      console.log("📄 Folio original:", folio);
      console.log("📄 Folio para archivo:", folioSanitized);
      console.log("📄 Ruta completa:", filePath);

      // ==========================================================
      // 2. CARGAR PLANTILLA HTML: Ruta corregida con app.getAppPath()
      // ==========================================================

      const templatePath = path.join(
        app.getAppPath(),
        "src",
        "main",
        "templates",
        "constancia-ee.html",
      );

      console.log("🔍 Buscando plantilla en:", templatePath);
      console.log("✅ Existe:", fs.existsSync(templatePath));

      if (!fs.existsSync(templatePath)) {
        const templateDir = path.dirname(templatePath);
        if (fs.existsSync(templateDir)) {
          console.log("📁 Contenido de templates/:", fs.readdirSync(templateDir));
        }
        throw new Error(`Plantilla no encontrada: ${templatePath}`);
      }

      // Crear ventana oculta para renderizado Chromium
      const win = new BrowserWindow({
        show: false,
        width: 850,
        height: 1100,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      await win.loadFile(templatePath);

      // ==========================================================
      // 3. INYECTAR DATOS Y ESPERAR RENDERIZADO
      // ==========================================================
      await win.webContents.executeJavaScript(`
        window.__PDF_DATA = ${JSON.stringify(payload)};
        window.__PDF_FOLIO = "${folio}";
      `);

      await new Promise((resolve) => setTimeout(resolve, 800));

      // ==========================================================
      // 4. EXPORTAR A PDF
      // ==========================================================
      const buffer = await win.webContents.printToPDF({
        pageSize: "A4",
        margins: {
          top: 0.6,
          bottom: 0.6,
          left: 0.8,
          right: 0.8,
        },
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        landscape: false,
      });

      // ==========================================================
      // 5. GUARDAR Y ACTUALIZAR BD
      // ==========================================================
      fs.writeFileSync(filePath, buffer);
      win.close();

      // Actualizar registro con la ruta del PDF generado
      db.prepare("UPDATE constancias SET ruta_archivo = ? WHERE id = ?").run(
        filePath,
        constanciaId,
      );

      // Registrar en auditoría
      db.prepare(
        `
      INSERT INTO historial_auditoria 
      (accion, tabla_afectada, registro_id, detalles, fecha_sistema) 
      VALUES (?, ?, ?, ?, datetime('now'))
    `,
      ).run(
        "EMITIR_CONSTANCIA_PDF",
        "constancias",
        constanciaId,
        JSON.stringify({
          folio,
          ruta: filePath,
          tipo: payload.tipo_constancia_id,
          docente: payload.docente_id,
        }),
      );

      return {
        success: true,
        folio,
        ruta: filePath,
        id: constanciaId,
        message: "Constancia generada y guardada exitosamente",
      };

    } catch (error) {
      console.error("❌ Error generando PDF:", error);

      // Limpieza: eliminar registro BD si falló la generación del archivo
      if (constanciaId) {
        try {
          db.prepare("DELETE FROM constancias WHERE id = ?").run(constanciaId);
        } catch (cleanupErr) {
          console.error(
            "⚠️ Error limpiando registro tras fallo:",
            cleanupErr.message,
          );
        }
      }

      // Cerrar ventanas residuales
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((w) => {
        if (w.webContents.getURL().includes("constancia-ee.html")) w.close();
      });

      return {
        success: false,
        error: error.message,
        code: "PDF_GENERATION_ERROR",
      };
    }
  });
  // ==========================================================
  // HANDLER: Obtener biblioteca de constancias
  // ==========================================================
  ipcMain.handle("obtener-biblioteca-constancias", async () => {
    try {
      const db = getDB();
      const query = `
        SELECT 
          c.id, c.folio, c.estado, c.fecha_emision, c.ruta_archivo,
          t.nombre as tipo_nombre, t.clave as tipo_clave,
          d.apellido_paterno, d.nombres as docente_nombre, d.codigo as docente_codigo,
          p.clave as periodo_clave, p.descripcion as periodo_desc,
          prog.nombre as programa_nombre,
          ee.nombre as ee_nombre, ee.clave_ee as ee_clave
        FROM constancias c
        LEFT JOIN docentes d ON c.docente_id = d.id
        LEFT JOIN periodos p ON c.periodo_id = p.id
        LEFT JOIN tipos_constancia t ON c.tipo_constancia_id = t.id
        LEFT JOIN programas_institucionales prog ON c.programa_id = prog.id
        LEFT JOIN experiencias_educativas ee ON c.ee_id = ee.id
        ORDER BY c.fecha_emision DESC
      `;
      const rows = db.prepare(query).all();
      return { success: true, rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    "obtener-datos-docente-contexto",
    async (event, { docente_id, periodo_id }) => {
      try {
        const db = getDB();

        // 🔹 CONSULTA CORREGIDA: 'nrc' está en 'experiencias_educativas' (ee), no en 'docente_ee_asignacion' (dea)
        const asignaciones = db
          .prepare(
            `
      SELECT 
        ee.id AS ee_id,
        ee.nombre AS ee_nombre,
        ee.clave_ee,
        ee.nrc,              /* ✅ CAMBIO AQUÍ: Leemos nrc de la tabla ee */
        dea.carga_horaria,
        p.descripcion AS periodo_desc
      FROM docente_ee_asignacion dea
      INNER JOIN experiencias_educativas ee ON dea.ee_id = ee.id
      INNER JOIN periodos p ON dea.periodo_id = p.id
      WHERE dea.docente_id = ? AND dea.periodo_id = ?
    `,
          )
          .all(docente_id, periodo_id);

        return {
          success: true,
          data: {
            asignaciones: asignaciones || [],
            firmas: {
              coord: { nombre: "Dr. Roberto Méndez Ruiz" },
              director: { nombre: "Dra. Laura Patricia Gómez" },
            },
          },
        };
      } catch (error) {
        console.error("❌ Error obteniendo contexto docente:", error);
        return {
          success: false,
          error: error.message,
          data: { asignaciones: [], firmas: {} },
        };
      }
    },
  );
};
