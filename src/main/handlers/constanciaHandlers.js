const { ipcMain, BrowserWindow, app } = require("electron");
const path = require("path");
const fs = require("fs");
const { getDB, generarIdGlobal } = require("../database");
const settings = require("../settings");
const { procesarPlantilla } = require("../templateEngine");

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
 */
function validarConstancia(db, datos, tipo) {
  const errores = [];

  const docente = db
    .prepare("SELECT id FROM docentes WHERE id = ? AND estado = ?")
    .get(datos.docente_id, "activo");
  if (!docente)
    errores.push("El docente seleccionado no existe o está inactivo.");

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

  if (!tipo) {
    errores.push("El tipo de constancia no es válido.");
    return errores;
  }

  if (tipo.requiere_ee === 1 && !datos.ee_id) {
    errores.push(
      `El tipo "${tipo.nombre}" requiere una Experiencia Educativa.`,
    );
  }

  if (tipo.requiere_periodo === 1 && !datos.periodo_id) {
    errores.push(`El tipo "${tipo.nombre}" requiere un Periodo Escolar.`);
  }

  if (datos.ee_id) {
    const ee = db
      .prepare(
        "SELECT id FROM experiencias_educativas WHERE id = ? AND estado = ?",
      )
      .get(datos.ee_id, "activa");
    if (!ee)
      errores.push("La Experiencia Educativa no existe o está inactiva.");
  }

  if (datos.periodo_id) {
    const periodo = db
      .prepare("SELECT id FROM periodos WHERE id = ? AND estado != ?")
      .get(datos.periodo_id, "cerrado");
    if (!periodo) errores.push("El periodo no existe o está cerrado.");
  }

  return errores;
}

/**
 * Resolvedor de HTML: procesa plantilla con parciales, logotipos y datos
 * Usado tanto por preview como por generación de PDF (misma fuente de verdad)
 */
function resolverHtmlConstancia(db, payload) {
  const formato = db
    .prepare(
      `
    SELECT plantilla_archivo FROM formatos_constancia
    WHERE tipo_constancia_id = ? AND es_actual = 1
  `,
    )
    .get(payload.tipo_constancia_id);

  if (!formato) {
    throw new Error("No hay formato activo para este tipo de constancia");
  }

  // Logotipos GLOBALES (aplican a todas las plantillas)
  const config = settings.get();
  const aBase64 = (ruta) => {
    if (!ruta || !fs.existsSync(ruta)) return "";
    const ext = path.extname(ruta).slice(1).toLowerCase() || "png";
    const mime = ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    return `data:${mime};base64,${fs.readFileSync(ruta).toString("base64")}`;
  };

  const logos = {
    uv: aBase64(config.logoUvRuta),
    msicu: aBase64(config.logoMsicuRuta),
  };

  // Textos: defaults de BD + overrides de la emisión
  const filas = db.prepare("SELECT clave, texto FROM textos_plantilla").all();
  const textos = {};
  filas.forEach((f) => (textos[f.clave] = f.texto));
  Object.assign(textos, payload.textos_overrides || {});

  // Firmas: separar nombre/cargo si el texto contiene "—"
  const firmas = (payload.firmas || []).map((f) => {
    const [nombre, ...resto] = String(f.texto || "").split("—");
    return { nombre: (nombre || "").trim(), cargo: resto.join("—").trim() };
  });

  const datos = { ...payload, firmas };

  return procesarPlantilla(formato.plantilla_archivo, datos, textos, logos);
}

module.exports = () => {
  // ==========================================================
  // HANDLER: Obtener catálogos para emisión
  // ==========================================================
  ipcMain.handle("obtener-datos-constancia", async () => {
    try {
      const db = getDB();

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
          SELECT id, codigo, apellido_paterno, apellido_materno, nombres, tratamiento, articulo
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

      const firmantes = db
        .prepare(
          `SELECT id, texto FROM firmantes WHERE deleted_at IS NULL ORDER BY texto`,
        )
        .all();

      return {
        success: true,
        data: {
          tipos: tipos || [],
          docentes: docentes || [],
          periodos: periodos || [],
          ee: ee || [],
          programas: programas || [],
          firmantes: firmantes || [],
        },
      };
    } catch (error) {
      console.error("❌ Error en obtener-datos-constancia:", error);
      return {
        success: false,
        error: error.message,
        data: {
          tipos: [],
          docentes: [],
          periodos: [],
          ee: [],
          programas: [],
          firmantes: [],
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

        // Generar id_global antes del insert
        const installation = db
          .prepare("SELECT installation_id FROM installation WHERE id = 1")
          .get();
        const idGlobal = generarIdGlobal(installation.installation_id);

        const stmt = db.prepare(`
          INSERT INTO constancias 
          (id_global, folio, docente_id, periodo_id, ee_id, programa_id, tipo_constancia_id, estado, fecha_emision)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'))
        `);

        const info = stmt.run(
          idGlobal,
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
  // HANDLER: Vista previa (devuelve HTML resuelto)
  // ==========================================================
  ipcMain.handle("previsualizar-constancia", async (event, payload) => {
    try {
      const db = getDB();
      // Folio de muestra (solo lectura, no consume numeración)
      const folioPreview = generarFolioSecuencial(db);
      const html = resolverHtmlConstancia(db, {
        ...payload,
        folio: folioPreview,
      });
      return { success: true, html };
    } catch (error) {
      console.error("❌ Error en previsualizar-constancia:", error);
      return { success: false, error: error.message };
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
      // 1. TRANSACCIÓN ATÓMICA: Folio + Insert en BD
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

        // Generar id_global antes del insert
        const installation = db
          .prepare("SELECT installation_id FROM installation WHERE id = 1")
          .get();
        const idGlobal = generarIdGlobal(installation.installation_id);

        const stmt = db.prepare(`
        INSERT INTO constancias 
        (id_global, folio, docente_id, periodo_id, ee_id, programa_id, tipo_constancia_id, fecha_emision, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

        const info = stmt.run(
          idGlobal,
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

      const folioSanitized = folio.replace(/\//g, "-");
      const filePath = path.join(rutaBase, `${folioSanitized}.pdf`);

      console.log("📄 Folio original:", folio);
      console.log("📄 Folio para archivo:", folioSanitized);
      console.log("📄 Ruta completa:", filePath);

      // 2. Resolver HTML con el mismo motor que la preview
      const htmlProcesado = resolverHtmlConstancia(db, { ...payload, folio });

      // Escribir a archivo temporal (origen file:// → impresión fiel)
      const tmpPath = path.join(
        app.getPath("userData"),
        `preview_${Date.now()}.html`,
      );
      fs.writeFileSync(tmpPath, htmlProcesado);

      // Crear ventana oculta
      const win = new BrowserWindow({
        show: false,
        width: 850,
        height: 1100,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      await win.loadFile(tmpPath);
      await new Promise((r) => setTimeout(r, 400));

      // 3. Exportar a PDF
      const buffer = await win.webContents.printToPDF({
        pageSize: "Letter",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        printBackground: true,
        displayHeaderFooter: false,
      });

      // 4. Guardar y actualizar BD
      fs.writeFileSync(filePath, buffer);
      win.close();
      fs.unlinkSync(tmpPath);

      db.prepare("UPDATE constancias SET ruta_archivo = ? WHERE id = ?").run(
        filePath,
        constanciaId,
      );

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

      const windows = BrowserWindow.getAllWindows();
      windows.forEach((w) => {
        if (
          w.webContents.getURL().includes("data:text/html") ||
          w.webContents.getURL().includes("preview_")
        )
          w.close();
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

        const asignaciones = db
          .prepare(
            `
      SELECT 
        ee.id AS ee_id,
        ee.nombre AS ee_nombre,
        ee.clave_ee,
        ee.nrc,
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
            firmas: [],
          },
        };
      } catch (error) {
        console.error("❌ Error obteniendo contexto docente:", error);
        return {
          success: false,
          error: error.message,
          data: { asignaciones: [], firmas: [] },
        };
      }
    },
  );
  // Periodos donde el docente tiene asignaciones activas
  ipcMain.handle(
    "obtener-periodos-con-asignacion",
    async (event, { docenteId }) => {
      try {
        const db = getDB();
        const rows = db
          .prepare(
            `
      SELECT DISTINCT p.id, p.clave, p.descripcion, p.fecha_inicio
      FROM docente_ee_asignacion dea
      INNER JOIN periodos p ON dea.periodo_id = p.id
      WHERE dea.docente_id = ? AND dea.estado = 'activo'
      ORDER BY p.fecha_inicio DESC
    `,
          )
          .all(docenteId);
        return { success: true, data: rows };
      } catch (error) {
        console.error("❌ Error obteniendo periodos con asignación:", error);
        return { success: false, error: error.message };
      }
    },
  );
  // ==========================================================
  // HANDLER: Obtener asignaciones de un docente en múltiples periodos
  // ==========================================================
  ipcMain.handle(
    "obtener-asignaciones-multi",
    async (event, { docenteId, periodoIds }) => {
      try {
        const db = getDB();

        if (!Array.isArray(periodoIds) || periodoIds.length === 0) {
          return { success: true, data: [] };
        }

        const marks = periodoIds.map(() => "?").join(",");
        const rows = db
          .prepare(
            `
        SELECT 
          ee.id AS ee_id, 
          ee.nombre AS ee_nombre, 
          ee.clave_ee, 
          ee.nrc,
          dea.carga_horaria, 
          p.id AS periodo_id, 
          p.clave AS periodo_clave,
          p.descripcion AS periodo_desc,
          COALESCE(ep.total_alumnos, 0) AS alumnos
        FROM docente_ee_asignacion dea
        INNER JOIN experiencias_educativas ee ON dea.ee_id = ee.id
        INNER JOIN periodos p ON dea.periodo_id = p.id
        LEFT JOIN estadisticas_ee_periodo ep 
          ON ep.ee_id = ee.id AND ep.periodo_id = p.id
        WHERE dea.docente_id = ? AND dea.periodo_id IN (${marks})
        ORDER BY p.fecha_inicio, ee.clave_ee
      `,
          )
          .all(docenteId, ...periodoIds);

        return { success: true, data: rows };
      } catch (error) {
        console.error("❌ Error obteniendo asignaciones multi:", error);
        return { success: false, error: error.message };
      }
    },
  );
};
