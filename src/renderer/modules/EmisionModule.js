/** src/renderer/modules/EmisionModule.js */
/**
 * Módulo de Emisión de Constancias
 * @module EmisionModule
 * @description Gestiona la interfaz y lógica para la generación de constancias docentes
 * @version 2.0.0
 */

import { Toast } from "../components/common/Toast.js";

export class EmisionModule {
  constructor() {
    // ============================================================
    // 1. CATÁLOGOS MAESTROS (cargados desde BD al iniciar)
    // ============================================================
    this.datosMaestros = {
      tipos: [],
      programas: [],
      periodos: [],
      docentes: [],
      firmantes: [],
      ee: [],
    };

    // ============================================================
    // 2. CONTEXTO DE EMISIÓN (selección del panel izquierdo)
    // ============================================================
    this.contexto = {
      tipo: null,
      programa: null,
      periodo: null,
      docente: null,
    };

    // ============================================================
    // 3. DATOS AUTO-CARGADOS (derivados del contexto)
    // ============================================================
    this.datosAutoCargados = {
      ee: [],
      fecha: new Date(),
      firmas: [], // Array de { firmante_id, texto }
    };

    // ============================================================
    // 4. CONFIGURACIÓN DEL PANEL DERECHO (opciones de salida)
    // ============================================================
    this.configuracionPanelDerecho = {
      rutaGuardado: null,
      recordarRuta: true,
      logotipoUrl: null,
      logotipoRecursoId: null,
      textosEditables: {
        saludo: "A quien corresponda,",
        mencion_final:
          "Para los fines que al interesado convenga se extiende la presente",
      },
      textosOriginales: {
        saludo: "A quien corresponda,",
        mencion_final:
          "Para los fines que al interesado convenga se extiende la presente",
      },
      panelColapsado: false,
      rutaResumen: "",
    };

    // ============================================================
    // 5. ESTADO INTERNO Y CONTROL
    // ============================================================
    this._listenersCleanup = [];
    this._previewDebounceTimer = null;
    this._firmaSlotIdCounter = 0;
    this._isGenerando = false;
  }

  /**
   * Inicializa el módulo: carga datos, configura UI y establece estado inicial
   */
  async init() {
    this._limpiarToastsResiduales();

    if (!this._verificarElementosCriticos()) {
      Toast.error(
        "Error de inicialización: elementos del formulario no encontrados",
        8000,
      );
      console.error(
        "[EmisionModule] DOM incompleto. Verificar HTML de la vista.",
      );
      return;
    }

    try {
      await this.cargarDatosIniciales();
      this.configurarFormulario();
      await this.configurarPanelDerecho();
      this.establecerFechaDefault();
      this.actualizarPreview();
      this._restaurarEstadoPanel();

      if (process?.env?.NODE_ENV === "development") {
        console.log("✅ EmisionModule inicializado correctamente");
      }
    } catch (err) {
      console.error("❌ Error crítico en init():", err);
      Toast.error("No se pudo cargar el módulo de emisión", 10000);
    }
  }

  // ============================================================
  // UTILIDADES DE UI
  // ============================================================

  _limpiarToastsResiduales() {
    if (typeof Toast?.clear === "function") {
      Toast.clear();
      return;
    }

    const selectoresToast = [
      ".toast-container",
      ".toast-wrapper",
      "[data-component='toast']",
      ".notification-area",
    ];

    selectoresToast.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (el.animate) {
          el.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 200,
            easing: "ease-out",
          }).onfinish = () => el.remove();
        } else {
          el.remove();
        }
      });
    });
  }

  _verificarElementosCriticos() {
    const elementosRequeridos = [
      "form-constancia",
      "sel-tipo",
      "sel-programa",
      "sel-periodo",
      "sel-docente",
      "input-fecha-emision",
      "preview-tabla-body",
      "btn-generar",
      "btn-limpiar",
    ];

    return elementosRequeridos.every((id) => {
      const existe = document.getElementById(id) !== null;
      if (!existe && process?.env?.NODE_ENV === "development") {
        console.warn(`[EmisionModule] Elemento #${id} no encontrado en el DOM`);
      }
      return existe;
    });
  }

  // ============================================================
  // CARGA DE DATOS INICIALES
  // ============================================================

  async cargarDatosIniciales() {
    try {
      if (!window.electronAPI?.obtenerDatosConstancia) {
        throw new Error(
          "API 'obtenerDatosConstancia' no disponible. Verificar preload.js",
        );
      }

      const resp = await window.electronAPI.obtenerDatosConstancia();

      if (!resp?.success) {
        throw new Error(resp?.error || "Respuesta inválida del servidor");
      }

      const data = resp.data || {};

      this.datosMaestros = {
        tipos: Array.isArray(data.tipos) ? data.tipos : [],
        programas: Array.isArray(data.programas) ? data.programas : [],
        periodos: Array.isArray(data.periodos) ? data.periodos : [],
        docentes: Array.isArray(data.docentes) ? data.docentes : [],
        firmantes: Array.isArray(data.firmantes) ? data.firmantes : [],
        ee: Array.isArray(data.ee) ? data.ee : [],
      };

      this.llenarSelectores();
    } catch (err) {
      console.error("[EmisionModule] Error en cargarDatosIniciales:", {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      });

      Toast.error(
        "Error al cargar catálogos. Verifique su conexión o contacte a soporte.",
        8000,
      );

      this._deshabilitarFormulario(true);
    }
  }

  _deshabilitarFormulario(deshabilitar) {
    ["sel-tipo", "sel-programa", "sel-periodo", "sel-docente", "sel-ee"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = deshabilitar;
      },
    );

    const btn = document.getElementById("btn-generar");
    if (btn) btn.disabled = deshabilitar;
  }

  llenarSelectores() {
    const fill = (id, items, defaultTxt, valKey = "id", txtFn = null) => {
      const sel = document.getElementById(id);
      if (!sel) {
        if (process?.env?.NODE_ENV === "development") {
          console.warn(`[EmisionModule] Select #${id} no encontrado`);
        }
        return;
      }

      sel.innerHTML = `<option value="">${defaultTxt}</option>`;

      if (!Array.isArray(items) || items.length === 0) {
        sel.disabled = true;
        return;
      }

      const defaultTextFn = (item) =>
        item.nombre ||
        item.clave ||
        item.codigo ||
        item.descripcion ||
        String(item[valKey] ?? "");

      const fragment = document.createDocumentFragment();

      items.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item[valKey] ?? "";
        opt.textContent =
          typeof txtFn === "function" ? txtFn(item) : defaultTextFn(item);
        fragment.appendChild(opt);
      });

      sel.appendChild(fragment);
      sel.disabled = false;
    };

    fill("sel-tipo", this.datosMaestros.tipos, "Seleccione un tipo...", "id", (i) => i.nombre);
    fill("sel-programa", this.datosMaestros.programas, "Seleccione un programa...", "id", (i) => i.nombre);
    fill("sel-periodo", this.datosMaestros.periodos, "Seleccione un periodo...", "id", (p) => `${p.clave || ""} - ${p.descripcion || ""}`.trim());
    fill("sel-docente", this.datosMaestros.docentes, "Seleccione un docente...", "id", (d) => {
      const apellido = d.apellido_paterno || "";
      const nombre = d.nombres || "";
      const codigo = d.codigo ? `(${d.codigo})` : "";
      return `${apellido}, ${nombre} ${codigo}`.trim();
    });
    fill("sel-ee", this.datosMaestros.ee, "Ninguna", "id", (i) =>
      `${i.nrc || i.clave_ee || ""} - ${i.nombre || ""}`.trim(),
    );
  }

  // ============================================================
  // CONFIGURACIÓN DEL FORMULARIO (Panel Izquierdo)
  // ============================================================

  configurarFormulario() {
    this._limpiarListenersPrevios();

    const bindWithCleanup = (id, event, handler) => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener(event, handler);
      this._listenersCleanup.push(() => {
        el.removeEventListener(event, handler);
      });
    };

    ["sel-tipo", "sel-programa", "sel-periodo"].forEach((id) => {
      bindWithCleanup(id, "change", () => this.actualizarContexto());
    });

    bindWithCleanup("sel-docente", "change", (e) => {
      if (e.target.value) {
        this.cargarDatosDocente(e.target.value);
      } else {
        this.limpiarAutoCarga();
      }
    });

    bindWithCleanup("input-fecha-emision", "change", (e) => {
      this.datosAutoCargados.fecha = e.target.value
        ? new Date(e.target.value)
        : new Date();
      this.actualizarPreview();
    });

    bindWithCleanup("sel-ee", "change", () => {
      this.actualizarPreview();
    });

    bindWithCleanup("form-constancia", "submit", (e) => {
      e.preventDefault();
      this.generarConstancia(e);
    });

    bindWithCleanup("btn-limpiar", "click", () => this.limpiarTodo());
  }

  // ============================================================
  // CONFIGURACIÓN DEL PANEL DERECHO
  // ============================================================

  async configurarPanelDerecho() {
    // Cargar configuración inicial
    try {
      const config = await window.electronAPI?.obtenerConfig?.() || {};
      this.configuracionPanelDerecho.rutaGuardado = config.rutaConstancias || "";
      this.actualizarDisplayRuta();
      this._actualizarResumenRuta();
    } catch (err) {
      console.warn("[EmisionModule] No se pudo cargar configuración:", err);
    }

    // Listener: Cambiar ruta de guardado
    const btnCambiarRuta = document.getElementById("btn-cambiar-ruta");
    if (btnCambiarRuta) {
      btnCambiarRuta.addEventListener("click", async () => {
        try {
          const ruta = await window.electronAPI.seleccionarDirectorio();
          if (ruta) {
            this.configuracionPanelDerecho.rutaGuardado = ruta;
            this.actualizarDisplayRuta();
            this._actualizarResumenRuta();

            const chkRecordar = document.getElementById("chk-recordar-ruta");
            if (chkRecordar?.checked) {
              await window.electronAPI.guardarConfig({
                key: "rutaConstancias",
                value: ruta,
              });
              Toast.success("Ruta predeterminada actualizada", 3000);
            }
          }
        } catch (err) {
          Toast.error("Error al seleccionar carpeta", 5000);
        }
      });
    }

    // Listener: Agregar firma
    const btnAgregarFirma = document.getElementById("btn-agregar-firma");
    if (btnAgregarFirma) {
      btnAgregarFirma.addEventListener("click", () => this.agregarSlotFirma());
    }

    // Listener: Cambiar logotipo
    const btnCambiarLogo = document.getElementById("btn-cambiar-logo");
    if (btnCambiarLogo) {
      btnCambiarLogo.addEventListener("click", async () => {
        try {
          const ruta = await window.electronAPI.seleccionarArchivoImagen();
          if (ruta) {
            this.configuracionPanelDerecho.logotipoUrl = `file://${ruta}`;
            this.actualizarPreviewLogotipo();
          }
        } catch (err) {
          Toast.error("Error al seleccionar imagen", 5000);
        }
      });
    }

    // Listener: Quitar logotipo
    const btnQuitarLogo = document.getElementById("btn-quitar-logo");
    if (btnQuitarLogo) {
      btnQuitarLogo.addEventListener("click", () => {
        this.configuracionPanelDerecho.logotipoUrl = null;
        this.configuracionPanelDerecho.logotipoRecursoId = null;
        this.actualizarPreviewLogotipo();
      });
    }

    // Listener: Toggle panel derecho
    const btnToggle = document.getElementById("btn-toggle-panel-derecho");
    if (btnToggle) {
      btnToggle.addEventListener("click", () => this.togglePanelDerecho());
    }

    // Cargar firmas por defecto del formato
    await this.cargarFirmasPorDefecto();

    // Configurar textos editables inline
    this.configurarTextosEditables();
  }

  actualizarDisplayRuta() {
    const display = document.getElementById("ruta-constancias-display");
    if (display) {
      display.textContent =
        this.configuracionPanelDerecho.rutaGuardado || "No configurada";
      display.title = this.configuracionPanelDerecho.rutaGuardado || "";
    }
  }

  _actualizarResumenRuta() {
    const ruta = this.configuracionPanelDerecho.rutaGuardado || "";
    const partes = ruta.split(/[/\\]/).filter(Boolean);
    const resumen =
      partes.length >= 2
        ? `.../${partes.slice(-2).join("/")}`
        : ruta || "Sin configurar";
    this.configuracionPanelDerecho.rutaResumen = resumen;
  }

  async cargarFirmasPorDefecto() {
    if (!this.contexto.tipo) {
      this.datosAutoCargados.firmas = [];
      this.renderizarSlotsFirmas();
      return;
    }

    // Por defecto, cargar 2 firmas si hay firmantes disponibles
    const firmantes = this.datosMaestros.firmantes;
    if (firmantes.length >= 2) {
      this.datosAutoCargados.firmas = [
        { firmante_id: firmantes[0].id, texto: firmantes[0].texto },
        { firmante_id: firmantes[1].id, texto: firmantes[1].texto },
      ];
    } else if (firmantes.length === 1) {
      this.datosAutoCargados.firmas = [
        { firmante_id: firmantes[0].id, texto: firmantes[0].texto },
      ];
    } else {
      this.datosAutoCargados.firmas = [];
    }

    this.renderizarSlotsFirmas();
  }

  agregarSlotFirma() {
    this.datosAutoCargados.firmas.push({ firmante_id: null, texto: "" });
    this.renderizarSlotsFirmas();
  }

  eliminarSlotFirma(index) {
    this.datosAutoCargados.firmas.splice(index, 1);
    this.renderizarSlotsFirmas();
  }

  renderizarSlotsFirmas() {
    const container = document.getElementById("firma-slots-container");
    const countEl = document.getElementById("firma-count");
    if (!container) return;

    container.innerHTML = "";
    if (countEl) countEl.textContent = this.datosAutoCargados.firmas.length;

    this.datosAutoCargados.firmas.forEach((firma, index) => {
      const slot = document.createElement("div");
      slot.className = "firma-slot";

      const select = document.createElement("select");
      select.className = "form-control";
      select.innerHTML = '<option value="">Seleccione firmante...</option>';

      this.datosMaestros.firmantes.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = f.texto;
        if (String(firma.firmante_id) === String(f.id)) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener("change", (e) => {
        const firmante = this.datosMaestros.firmantes.find(
          (f) => String(f.id) === String(e.target.value),
        );
        this.datosAutoCargados.firmas[index] = {
          firmante_id: e.target.value ? parseInt(e.target.value, 10) : null,
          texto: firmante?.texto || "",
        };
        this.actualizarPreviewFirmas();
      });

      const btnEliminar = document.createElement("button");
      btnEliminar.className = "btn btn-danger btn-sm";
      btnEliminar.innerHTML = '<i class="fa-solid fa-times"></i>';
      btnEliminar.type = "button";
      btnEliminar.addEventListener("click", () =>
        this.eliminarSlotFirma(index),
      );

      slot.appendChild(select);
      slot.appendChild(btnEliminar);
      container.appendChild(slot);
    });

    this.actualizarPreviewFirmas();
  }

  actualizarPreviewFirmas() {
    const container = document.getElementById("preview-firmas-container");
    if (!container) return;

    container.innerHTML = "";

    this.datosAutoCargados.firmas.forEach((firma) => {
      const block = document.createElement("div");
      block.className = "signature-block";
      block.innerHTML = `
        <div class="signature-line"></div>
        <p>${this._escapeHtml(firma.texto) || "[Firma pendiente]"}</p>
      `;
      container.appendChild(block);
    });
  }

  actualizarPreviewLogotipo() {
    const previewBox = document.getElementById("logotipo-preview");
    const btnQuitar = document.getElementById("btn-quitar-logo");
    if (!previewBox) return;

    if (this.configuracionPanelDerecho.logotipoUrl) {
      previewBox.innerHTML = `<img src="${this.configuracionPanelDerecho.logotipoUrl}" alt="Logotipo">`;
      if (btnQuitar) btnQuitar.style.display = "block";
    } else {
      previewBox.innerHTML = `
        <i class="fa-solid fa-image placeholder-icon"></i>
        <p>Sin logotipo</p>
      `;
      if (btnQuitar) btnQuitar.style.display = "none";
    }
  }

  togglePanelDerecho() {
    const container = document.querySelector(".emission-container");
    const btn = document.getElementById("btn-toggle-panel-derecho");
    if (!container || !btn) return;

    container.classList.toggle("panel-colapsado");
    this.configuracionPanelDerecho.panelColapsado =
      container.classList.contains("panel-colapsado");

    const icon = btn.querySelector("i");
    if (icon) {
      if (this.configuracionPanelDerecho.panelColapsado) {
        icon.classList.replace("fa-chevron-right", "fa-chevron-left");
      } else {
        icon.classList.replace("fa-chevron-left", "fa-chevron-right");
      }
    }

    // Persistir preferencia
    window.electronAPI
      ?.guardarConfig?.({
        key: "panelDerechoColapsado",
        value: this.configuracionPanelDerecho.panelColapsado,
      })
      .catch((err) =>
        console.warn("[EmisionModule] No se pudo guardar preferencia:", err),
      );
  }

  configurarTextosEditables() {
    const elementos = document.querySelectorAll('[contenteditable="true"]');
    elementos.forEach((el) => {
      el.addEventListener("blur", () => {
        const key = el.getAttribute("data-editable-key");
        if (!key) return;

        const nuevoValor = el.textContent.trim();
        const valorOriginal =
          this.configuracionPanelDerecho.textosOriginales[key];

        if (nuevoValor !== valorOriginal) {
          this.configuracionPanelDerecho.textosEditables[key] = nuevoValor;
          // TODO: Implementar modal de confirmación para aplicar a todas las plantillas
          console.log(`[EmisionModule] Texto editado: ${key} = "${nuevoValor}"`);
        }
      });
    });
  }

  _restaurarEstadoPanel() {
    window.electronAPI
      ?.obtenerConfig?.()
      .then((config) => {
        if (config?.panelDerechoColapsado === true) {
          this.configuracionPanelDerecho.panelColapsado = true;
          const container = document.querySelector(".emission-container");
          if (container) {
            container.classList.add("panel-colapsado");
            const btn = document.getElementById("btn-toggle-panel-derecho");
            const icon = btn?.querySelector("i");
            if (icon) icon.classList.replace("fa-chevron-right", "fa-chevron-left");
          }
        }
      })
      .catch((err) =>
        console.warn("[EmisionModule] No se pudo restaurar estado:", err),
      );
  }

  // ============================================================
  // GESTIÓN DE LISTENERS
  // ============================================================

  _limpiarListenersPrevios() {
    this._listenersCleanup.forEach((cleanup) => {
      try {
        cleanup();
      } catch (err) {
        if (process?.env?.NODE_ENV === "development") {
          console.warn("[EmisionModule] Error limpiando listener:", err);
        }
      }
    });
    this._listenersCleanup = [];
  }

  // ============================================================
  // ACTUALIZACIÓN DE CONTEXTO
  // ============================================================

  actualizarContexto() {
    this.contexto.tipo = document.getElementById("sel-tipo")?.value || null;
    this.contexto.programa =
      document.getElementById("sel-programa")?.value || null;
    this.contexto.periodo =
      document.getElementById("sel-periodo")?.value || null;

    const selDoc = document.getElementById("sel-docente");
    if (selDoc) {
      if (this.contexto.periodo) {
        selDoc.disabled = false;
        if (!selDoc.value) {
          selDoc.options[0].textContent = "Seleccione un docente...";
        }
      } else {
        selDoc.disabled = true;
        selDoc.value = "";
        selDoc.options[0].textContent = "Primero seleccione periodo...";
        this.limpiarAutoCarga();
      }
    }

    // Recargar firmas por defecto cuando cambia el tipo
    if (this.contexto.tipo) {
      this.cargarFirmasPorDefecto();
    }

    this.actualizarPreview();
  }

  async cargarDatosDocente(docenteId) {
    if (!docenteId) {
      this.limpiarAutoCarga();
      return;
    }

    this.contexto.docente = docenteId;
    const tbody = document.getElementById("preview-tabla-body");

    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="loading-state">' +
        '<i class="fa-solid fa-spinner fa-spin"></i> Cargando datos...</td></tr>';
    }

    try {
      if (!window.electronAPI?.obtenerDatosDocenteContexto) {
        throw new Error("API 'obtenerDatosDocenteContexto' no disponible");
      }

      const resp = await window.electronAPI.obtenerDatosDocenteContexto({
        docente_id: parseInt(docenteId, 10),
        periodo_id: this.contexto.periodo
          ? parseInt(this.contexto.periodo, 10)
          : null,
      });

      if (!resp?.success) {
        throw new Error(
          resp?.error || "Sin datos disponibles para este docente",
        );
      }

      const asignaciones = resp.data.asignaciones || [];

      // Preservar firmas y fecha actuales
      const firmasActuales = this.datosAutoCargados.firmas;
      const fechaActual = this.datosAutoCargados.fecha;

      this.datosAutoCargados = {
        ee: asignaciones.map((a) => ({
          id: Number(a.ee_id) || null,
          nombre: String(a.ee_nombre || "Sin nombre"),
          nrc: String(a.nrc || "N/A"),
          hsm: Number(a.carga_horaria) || 0,
          horas: (Number(a.carga_horaria) || 0) * 16,
          creditos: Number(a.creditos) || 8,
          periodo: String(a.periodo_desc || ""),
          alumnos: Number(a.num_alumnos) || 0,
        })),
        firmas: firmasActuales,
        fecha: fechaActual,
      };

      const selEE = document.getElementById("sel-ee");
      if (selEE) {
        if (this.datosAutoCargados.ee.length > 0) {
          selEE.value = this.datosAutoCargados.ee[0].id;
          selEE.disabled = false;
        } else {
          selEE.value = "";
          selEE.disabled = true;
          selEE.innerHTML = '<option value="">Sin asignaciones</option>';
        }
      }

      this.renderTabla();
      this.actualizarPreview();

      if (process?.env?.NODE_ENV === "development") {
        console.log("✅ Docente cargado:", {
          id: docenteId,
          eeCount: this.datosAutoCargados.ee.length,
          eeId: this.datosAutoCargados.ee[0]?.id,
        });
      }
    } catch (err) {
      console.error("[EmisionModule] Error en cargarDatosDocente:", {
        docenteId,
        periodoId: this.contexto.periodo,
        message: err.message,
        stack: err.stack,
      });

      Toast.error(
        `No se pudieron cargar los datos del docente: ${err.message}`,
        8000,
      );

      this.limpiarAutoCarga();
    }
  }

  renderTabla() {
    const tbody = document.getElementById("preview-tabla-body");
    if (!tbody) return;

    if (!this.datosAutoCargados.ee?.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="empty-state">' +
        "Sin asignaciones registradas para este periodo</td></tr>";
      return;
    }

    const fragment = document.createDocumentFragment();

    this.datosAutoCargados.ee.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${this._escapeHtml(row.nrc)}</td>
        <td>${this._escapeHtml(row.nombre)}</td>
        <td>${Number(row.hsm) || 0}</td>
        <td>${Number(row.horas) || 0}</td>
        <td>${Number(row.creditos) || 0}</td>
        <td>${this._escapeHtml(row.periodo)}</td>
        <td>${Number(row.alumnos) || 0}</td>
      `;
      fragment.appendChild(tr);
    });

    tbody.innerHTML = "";
    tbody.appendChild(fragment);
  }

  establecerFechaDefault() {
    const input = document.getElementById("input-fecha-emision");
    if (input) {
      const hoy = new Date().toISOString().split("T")[0];
      input.value = hoy;
      this.datosAutoCargados.fecha = new Date();
    }
  }

  actualizarPreview() {
    const fecha = this.datosAutoCargados.fecha || new Date();
    const opts = { day: "numeric", month: "long", year: "numeric" };

    try {
      const partes = new Intl.DateTimeFormat("es-MX", opts).formatToParts(fecha);

      const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };

      setValue("preview-dia", partes.find((p) => p.type === "day")?.value || "__");
      setValue("preview-mes", partes.find((p) => p.type === "month")?.value || "________");
      setValue("preview-anio", partes.find((p) => p.type === "year")?.value || "____");
    } catch (err) {
      console.warn("[EmisionModule] Error formateando fecha:", err);
      ["preview-dia", "preview-mes", "preview-anio"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = "____";
      });
    }

    // Actualizar datos del docente si está seleccionado
    if (this.contexto.docente) {
      const doc = this.datosMaestros.docentes.find(
        (d) => String(d.id) === String(this.contexto.docente),
      );

      if (doc) {
        const tratamiento = doc.tratamiento || "El/La";
        const nombreCompleto = [
          doc.nombres,
          doc.apellido_paterno,
          doc.apellido_materno,
        ]
          .filter(Boolean)
          .join(" ");

        const setDocPreview = (id, value) => {
          const el = document.getElementById(id);
          if (el) el.textContent = value;
        };

        setDocPreview("preview-tratamiento", tratamiento);
        setDocPreview(
          "preview-nombre-docente",
          nombreCompleto || "[NOMBRE]",
        );
        setDocPreview("preview-codigo-docente", doc.codigo || "[CÓDIGO]");
      }
    }

    // Actualizar textos editables en preview
    const saludoEl = document.getElementById("preview-saludo");
    if (saludoEl) {
      saludoEl.textContent =
        this.configuracionPanelDerecho.textosEditables.saludo;
    }
  }

  limpiarAutoCarga() {
    this.contexto.docente = null;

    const fechaActual = this.datosAutoCargados.fecha;
    const firmasActuales = this.datosAutoCargados.firmas;

    this.datosAutoCargados = {
      ee: [],
      fecha: fechaActual,
      firmas: firmasActuales, // Preservar configuración de firmas
    };

    const setPreview = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setPreview("preview-tratamiento", "El/La");
    setPreview("preview-nombre-docente", "[NOMBRE DEL DOCENTE]");
    setPreview("preview-codigo-docente", "[CÓDIGO]");

    const tbody = document.getElementById("preview-tabla-body");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="empty-state">' +
        "Seleccione un docente para cargar asignaciones</td></tr>";
    }

    const selEE = document.getElementById("sel-ee");
    if (selEE) {
      selEE.innerHTML = '<option value="">Ninguna</option>';
      selEE.disabled = true;
      selEE.value = "";
    }

    this.actualizarPreview();
  }

  limpiarTodo() {
    const form = document.getElementById("form-constancia");
    if (form) form.reset();

    this.contexto = {
      tipo: null,
      programa: null,
      periodo: null,
      docente: null,
    };

    this.limpiarAutoCarga();

    const selDoc = document.getElementById("sel-docente");
    if (selDoc) {
      selDoc.disabled = true;
      selDoc.options[0].textContent = "Primero seleccione periodo...";
    }

    this.establecerFechaDefault();

    const folioEl = document.getElementById("preview-folio");
    if (folioEl) folioEl.textContent = "CO/MSICU/POR GENERAR";

    Toast.success("Formulario restablecido", 3000);
  }

  // ============================================================
  // GENERACIÓN DE CONSTANCIA
  // ============================================================

  async generarConstancia(e) {
    e.preventDefault();

    if (this._isGenerando) return;

    const docenteVal = document.getElementById("sel-docente")?.value;
    if (!docenteVal) {
      Toast.warning("Seleccione un docente para continuar.", 6000);
      document.getElementById("sel-docente")?.focus();
      return;
    }

    const btn = document.getElementById("btn-generar");
    if (!btn) return;

    const originalState = {
      disabled: btn.disabled,
      html: btn.innerHTML,
      text: btn.textContent,
    };

    this._isGenerando = true;
    btn.disabled = true;
    btn.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Generando PDF...';

    try {
      const doc = this.datosMaestros.docentes.find(
        (d) => String(d.id) === String(this.contexto.docente),
      );

      if (!doc) {
        throw new Error("Docente no encontrado en catálogos");
      }

      const fecha = this.datosAutoCargados.fecha || new Date();
      const opts = { day: "numeric", month: "long", year: "numeric" };
      const fechaParts = new Intl.DateTimeFormat("es-MX", opts).formatToParts(
        fecha,
      );

      const payload = {
        tipo_constancia_id: parseInt(this.contexto.tipo, 10),
        programa_id: parseInt(this.contexto.programa, 10),
        docente_id: parseInt(docenteVal, 10),
        periodo_id: this.contexto.periodo
          ? parseInt(this.contexto.periodo, 10)
          : null,
        ee_id: this.datosAutoCargados.ee?.[0]?.id || null,
        fecha_emision:
          document.getElementById("input-fecha-emision")?.value ||
          new Date().toISOString().split("T")[0],

        // Campos para el motor de plantillas
        docente_tratamiento: doc.tratamiento || "",
        docente_nombre: [
          doc.nombres,
          doc.apellido_paterno,
          doc.apellido_materno,
        ]
          .filter(Boolean)
          .join(" "),
        docente_codigo: doc.codigo || "",
        periodo_clave:
          this.datosMaestros.periodos.find(
            (p) => String(p.id) === String(this.contexto.periodo),
          )?.clave || "",
        fecha_dia: fechaParts.find((p) => p.type === "day")?.value || "",
        fecha_mes: fechaParts.find((p) => p.type === "month")?.value || "",
        fecha_anio: fechaParts.find((p) => p.type === "year")?.value || "",
        ees: this.datosAutoCargados.ee || [],
        tutorados: [],
        firmas: this.datosAutoCargados.firmas.map((f) => ({ texto: f.texto })),
        texto_saludo: this.configuracionPanelDerecho.textosEditables.saludo,
        texto_mencion_final:
          this.configuracionPanelDerecho.textosEditables.mencion_final,
        ruta_guardado: this.configuracionPanelDerecho.rutaGuardado,
        logotipo_url: this.configuracionPanelDerecho.logotipoUrl,
      };

      if (process?.env?.NODE_ENV === "development") {
        console.log("📤 Payload generarConstancia:", {
          ...payload,
          docente_nombre: payload.docente_nombre,
          firmas: `${payload.firmas.length} firma(s)`,
        });
      }

      if (this._requiereExperienciaEducativa() && !payload.ee_id) {
        Toast.error(
          "Este tipo de constancia requiere seleccionar una Experiencia Educativa. " +
            "Verifique que el docente tenga asignaciones registradas.",
          8000,
        );
        return;
      }

      if (!window.electronAPI?.generarConstanciaPDF) {
        throw new Error("API de generación de PDF no disponible");
      }

      const resp = await window.electronAPI.generarConstanciaPDF(payload);

      if (resp?.success) {
        const folioEl = document.getElementById("preview-folio");
        if (folioEl && resp.folio) {
          folioEl.textContent = resp.folio;
        }

        Toast.success(
          `Constancia emitida exitosamente. Folio: ${resp.folio}`,
          8000,
        );

        setTimeout(() => {
          if (!document.hidden) {
            this.limpiarTodo();
          }
        }, 3000);
      } else {
        const errorMsg = resp?.error || "Error desconocido del servidor";
        console.error("[EmisionModule] Error del servidor:", errorMsg);
        Toast.error(`No se pudo generar la constancia: ${errorMsg}`, 10000);
      }
    } catch (err) {
      console.error("[EmisionModule] Error crítico en generarConstancia:", {
        message: err.message,
        stack: err.stack,
      });

      Toast.error(
        `Error de conexión o procesamiento: ${err.message}. ` +
          "Intente nuevamente o contacte a soporte técnico.",
        10000,
      );
    } finally {
      if (btn && originalState) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
      this._isGenerando = false;
    }
  }

  _requiereExperienciaEducativa() {
    if (!this.contexto.tipo || !this.datosMaestros.tipos.length) {
      return false;
    }

    const tipoSeleccionado = this.datosMaestros.tipos.find(
      (t) => String(t.id) === String(this.contexto.tipo),
    );

    return Boolean(tipoSeleccionado?.requiere_ee);
  }

  // ============================================================
  // UTILIDADES
  // ============================================================

  _escapeHtml(str) {
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

  destroy() {
    this._limpiarListenersPrevios();
    this._limpiarToastsResiduales();

    if (this._previewDebounceTimer) {
      clearTimeout(this._previewDebounceTimer);
      this._previewDebounceTimer = null;
    }

    this.datosMaestros = {};
    this.contexto = {};
    this.datosAutoCargados = {};
    this.configuracionPanelDerecho = {};

    if (process?.env?.NODE_ENV === "development") {
      console.log("♻️ EmisionModule destruido - recursos liberados");
    }
  }
}