/** src/renderer/modules/EmisionModule.js */
/**
 * @description Gestiona la interfaz y lógica para la generación de constancias docentes
 * @version 2.2.0
 */

import { Toast } from "../components/common/Toast.js";

export class EmisionModule {
  constructor() {
    this.datosMaestros = {
      tipos: [],
      programas: [],
      periodos: [],
      docentes: [],
      firmantes: [],
      ee: [],
    };

    this.contexto = {
      tipo: null,
      programa: null,
      periodo: null,
      docente: null,
    };

    this.datosAutoCargados = {
      ee: [],
      fecha: new Date(),
      firmas: [],
    };

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

    this.periodosAsignadosDocente = [];
    this.periodosIncluidos = new Set();
    this._listenersCleanup = [];
    this._previewDebounceTimer = null;
    this._firmaSlotIdCounter = 0;
    this._isGenerando = false;
    this._previewZoom = 1;
  }

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
      "sel-docente",
      "input-fecha-emision",
      "preview-frame",
      "preview-placeholder",
      "btn-generar",
      "btn-limpiar",
      "panel-derecho",
      "btn-toggle-panel-derecho",
    ];

    return elementosRequeridos.every((id) => {
      const existe = document.getElementById(id) !== null;
      if (!existe && process?.env?.NODE_ENV === "development") {
        console.warn(`[EmisionModule] Elemento #${id} no encontrado en el DOM`);
      }
      return existe;
    });
  }

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
    [
      "sel-tipo",
      "sel-programa",
      "sel-periodo",
      "sel-docente",
      "sel-ee",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.disabled = deshabilitar;
    });

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

    fill(
      "sel-tipo",
      this.datosMaestros.tipos,
      "Seleccione un tipo...",
      "id",
      (i) => i.nombre,
    );
    fill(
      "sel-programa",
      this.datosMaestros.programas,
      "Seleccione un programa...",
      "id",
      (i) => i.nombre,
    );
    fill(
      "sel-periodo",
      this.datosMaestros.periodos,
      "Seleccione un periodo...",
      "id",
      (p) => `${p.clave || ""} - ${p.descripcion || ""}`.trim(),
    );
    fill(
      "sel-docente",
      this.datosMaestros.docentes,
      "Seleccione un docente...",
      "id",
      (d) => {
        const apellido = d.apellido_paterno || "";
        const nombre = d.nombres || "";
        const codigo = d.codigo ? `(${d.codigo})` : "";
        return `${apellido}, ${nombre} ${codigo}`.trim();
      },
    );
    fill("sel-ee", this.datosMaestros.ee, "Ninguna", "id", (i) =>
      `${i.nrc || i.clave_ee || ""} - ${i.nombre || ""}`.trim(),
    );
  }

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

    bindWithCleanup("sel-tipo", "change", () => this.actualizarContexto());
    bindWithCleanup("sel-programa", "change", () => this.actualizarContexto());
    bindWithCleanup("sel-periodo", "change", () => this.actualizarContexto());

    bindWithCleanup("sel-docente", "change", async (e) => {
      this.contexto.docente = e.target.value || null;
      if (this.contexto.docente) {
        await this.cargarPeriodosDocente();
        this.renderControlPeriodos();
        if (this._tipoRequiereEE()) await this.cargarAsignacionesMulti();
      } else {
        this.periodosAsignadosDocente = [];
        this.periodosIncluidos = new Set();
        this.renderControlPeriodos();
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

    bindWithCleanup("btn-zoom-in", "click", () =>
      this._setZoom(this._previewZoom + 0.1),
    );
    bindWithCleanup("btn-zoom-out", "click", () =>
      this._setZoom(this._previewZoom - 0.1),
    );
    bindWithCleanup("btn-zoom-reset", "click", () => this._setZoom(1));

    bindWithCleanup("btn-limpiar", "click", () => this.limpiarTodo());

    const search = document.getElementById("chips-search");
    if (search) {
      const abrir = () => this.renderChipsDropdown(search.value);

      bindWithCleanup("chips-search", "input", abrir);
      bindWithCleanup("chips-search", "focus", abrir);
      bindWithCleanup("chips-search", "click", abrir); // tap con el input ya enfocado

      bindWithCleanup("chips-search", "blur", () => {
        setTimeout(() => this._cerrarChipsDropdown(), 150);
      });
      bindWithCleanup("chips-search", "keydown", (e) => {
        if (e.key === "Escape") this._cerrarChipsDropdown();
      });
    }
  }

  _setZoom(z) {
    this._previewZoom = Math.min(2, Math.max(0.5, Math.round(z * 10) / 10));
    const label = document.getElementById("zoom-level");
    if (label) label.textContent = `${Math.round(this._previewZoom * 100)}%`;
    this._aplicarZoom();
  }

  _aplicarZoom() {
    try {
      const frame = document.getElementById("preview-frame");
      const doc = frame?.contentDocument;
      if (doc?.body) doc.body.style.zoom = this._previewZoom;
    } catch (e) {
      /* el iframe aún no está listo */
    }
  }

  async configurarPanelDerecho() {
    try {
      const config = (await window.electronAPI?.obtenerConfig?.()) || {};
      this.configuracionPanelDerecho.rutaGuardado =
        config.rutaConstancias || "";
      this.actualizarDisplayRuta();
      this._actualizarResumenRuta();
    } catch (err) {
      console.warn("[EmisionModule] No se pudo cargar configuración:", err);
    }

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

    const btnAgregarFirma = document.getElementById("btn-agregar-firma");
    if (btnAgregarFirma) {
      btnAgregarFirma.addEventListener("click", () => this.agregarSlotFirma());
    }

    ["uv", "msicu"].forEach((clave) => {
      const btn = document.getElementById(`btn-cambiar-logo-${clave}`);
      if (!btn) return;

      btn.addEventListener("click", async () => {
        try {
          const ruta = await window.electronAPI.seleccionarArchivoImagen();
          if (!ruta) return;

          const resp = await window.electronAPI.guardarLogotipo({
            clave,
            rutaOrigen: ruta,
          });

          if (resp?.success) {
            Toast.success("Logotipo actualizado", 3000);
            await this.cargarPreviewLogotipos();
            this.actualizarPreview();
          } else {
            Toast.error(resp?.error || "Error al guardar el logotipo", 5000);
          }
        } catch (err) {
          Toast.error("Error al seleccionar la imagen", 5000);
        }
      });
    });

    const btnToggle = document.getElementById("btn-toggle-panel-derecho");
    if (btnToggle) {
      btnToggle.addEventListener("click", () => this.togglePanelDerecho());
    }

    await this.cargarFirmasPorDefecto();
    await this.cargarPreviewLogotipos();
  }

  async cargarPreviewLogotipos() {
    try {
      const resp = await window.electronAPI.obtenerLogotipos();
      if (!resp?.success) return;

      const pintar = (id, item, etiqueta) => {
        const box = document.getElementById(id);
        if (!box) return;
        box.innerHTML = item?.dataUri
          ? `<img src="${item.dataUri}" alt="${etiqueta}">`
          : `<i class="fa-solid fa-image"></i>`;
        box.title = item?.ruta || "Sin logotipo";
      };

      pintar("logo-uv-preview", resp.data.uv, "UV");
      pintar("logo-msicu-preview", resp.data.msicu, "MSICU");
    } catch (err) {
      console.warn("[EmisionModule] No se pudieron cargar logotipos:", err);
    }
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
        this.actualizarPreview();
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

    window.electronAPI
      ?.guardarConfig?.({
        key: "panelDerechoColapsado",
        value: this.configuracionPanelDerecho.panelColapsado,
      })
      .catch((err) =>
        console.warn("[EmisionModule] No se pudo guardar preferencia:", err),
      );
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
            if (icon)
              icon.classList.replace("fa-chevron-right", "fa-chevron-left");
          }
        }
      })
      .catch((err) =>
        console.warn("[EmisionModule] No se pudo restaurar estado:", err),
      );
  }

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

  _tipoRequiereEE() {
    const t = this.datosMaestros.tipos.find(
      (x) => String(x.id) === String(this.contexto.tipo),
    );
    return Boolean(t?.requiere_ee);
  }

  actualizarContexto() {
    this.contexto.tipo = document.getElementById("sel-tipo")?.value || null;
    this.contexto.programa =
      document.getElementById("sel-programa")?.value || null;
    this.contexto.periodo =
      document.getElementById("sel-periodo")?.value || null;
    this.renderControlPeriodos();
    if (this.contexto.tipo) {
      this.cargarFirmasPorDefecto();
    }
    this.actualizarPreview();
  }

  async cargarPeriodosDocente() {
    if (!this.contexto.docente) {
      this.periodosAsignadosDocente = [];
      return;
    }
    const resp = await window.electronAPI.obtenerPeriodosConAsignacion({
      docenteId: this.contexto.docente,
    });
    this.periodosAsignadosDocente = resp?.success ? resp.data : [];
    this.periodosIncluidos = this.periodosAsignadosDocente.length
      ? new Set([String(this.periodosAsignadosDocente[0].id)])
      : new Set();
  }

  renderControlPeriodos() {
    const t = this.datosMaestros.tipos.find(
      (x) => String(x.id) === String(this.contexto.tipo),
    );
    const gEE = document.getElementById("group-periodos-ee");
    const gSingle = document.getElementById("group-periodo-single");
    if (!gEE || !gSingle) return;

    if (t?.requiere_ee) {
      gEE.style.display = "block";
      gSingle.style.display = "none";
      this.renderChips();
    } else if (t?.requiere_periodo) {
      gEE.style.display = "none";
      gSingle.style.display = "block";
    } else {
      gEE.style.display = "none";
      gSingle.style.display = "none";
    }
  }

  renderChips() {
    const box = document.getElementById("chips-container");
    if (!box) return;
    box.innerHTML = "";

    [...this.periodosIncluidos].forEach((id) => {
      const p = this.periodosAsignadosDocente.find((x) => String(x.id) === id);
      if (!p) return;

      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${p.clave} <button type="button" title="Quitar">&times;</button>`;
      chip.querySelector("button").addEventListener("click", async () => {
        this.periodosIncluidos.delete(id);
        this.renderChips();
        await this.cargarAsignacionesMulti();
      });
      box.appendChild(chip);
    });

    this._cerrarChipsDropdown();
  }

  renderChipsDropdown(query = "") {
    const dd = document.getElementById("chips-dropdown");
    if (!dd) return;
    const q = (query || "").toLowerCase();
    const opciones = this.periodosAsignadosDocente.filter(
      (p) =>
        !this.periodosIncluidos.has(String(p.id)) &&
        `${p.clave} ${p.descripcion}`.toLowerCase().includes(q),
    );
    dd.innerHTML = "";
    if (opciones.length === 0) {
      dd.classList.add("hidden");
      return;
    }
    opciones.forEach((p) => {
  const item = document.createElement("div");
  item.className = "dd-item";
  item.textContent = `${p.clave} - ${p.descripcion}`;

  item.addEventListener("mousedown", (e) => e.preventDefault());

  item.addEventListener("click", async () => {
    this.periodosIncluidos.add(String(p.id));
    const s = document.getElementById("chips-search");
    if (s) s.value = "";
    this.renderChips();
    await this.cargarAsignacionesMulti();
  });

  dd.appendChild(item);
});
    dd.classList.remove("hidden");
  }

  _cerrarChipsDropdown() {
    const dd = document.getElementById("chips-dropdown");
    if (dd) dd.classList.add("hidden");
  }

  async cargarAsignacionesMulti() {
    if (!this.contexto.docente) return;
    const ids = [...this.periodosIncluidos].map(Number).filter(Boolean);

    if (ids.length === 0) {
      this.datosAutoCargados.ee = [];
      this.actualizarPreview();
      return;
    }

    const resp = await window.electronAPI.obtenerAsignacionesMulti({
      docenteId: this.contexto.docente,
      periodoIds: ids,
    });

    if (resp?.success) {
      this.datosAutoCargados.ee = resp.data.map((a) => ({
        id: a.ee_id,
        nombre: a.ee_nombre,
        nrc: a.nrc,
        hsm: a.carga_horaria,
        horas: (Number(a.carga_horaria) || 0) * 16,
        creditos: 8,
        periodo: a.periodo_clave,
        alumnos: Number(a.alumnos) || 0,
      }));
      this.actualizarPreview();
    }
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
    clearTimeout(this._previewDebounceTimer);
    this._previewDebounceTimer = setTimeout(async () => {
      const frame = document.getElementById("preview-frame");
      const placeholder = document.getElementById("preview-placeholder");
      if (!frame || !placeholder) return;

      if (!this.contexto.tipo) {
        frame.classList.remove("visible");
        placeholder.style.display = "flex";
        return;
      }

      try {
        const payload = this._buildPayload();
        const resp = await window.electronAPI.previsualizarConstancia(payload);
        if (resp?.success) {
          frame.srcdoc = resp.html;
          frame.classList.add("visible");
          placeholder.style.display = "none";
          frame.onload = () => this._habilitarEditables(frame);
        }
      } catch (err) {
        console.warn("[EmisionModule] Error en preview:", err);
      }
    }, 250);
  }

  _habilitarEditables(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      doc.querySelectorAll("[data-editable-key]").forEach((el) => {
        el.setAttribute("contenteditable", "true");
        el.addEventListener("blur", () => {
          const key = el.getAttribute("data-editable-key");
          const nuevo = el.textContent.trim();
          if (nuevo !== this.configuracionPanelDerecho.textosEditables[key]) {
            this.configuracionPanelDerecho.textosEditables[key] = nuevo;
            console.log(`[EmisionModule] Texto editado: ${key}`);
          }
        });
      });
      this._aplicarZoom();
    } catch (e) {
      console.warn("[EmisionModule] No se pudieron habilitar editables:", e);
    }
  }

  _buildPayload() {
    const doc = this.datosMaestros.docentes.find(
      (d) => String(d.id) === String(this.contexto.docente),
    );

    const fecha = this.datosAutoCargados.fecha || new Date();
    const opts = { day: "numeric", month: "long", year: "numeric" };
    const fechaParts = new Intl.DateTimeFormat("es-MX", opts).formatToParts(
      fecha,
    );

    const idsEE = [...this.periodosIncluidos].map(Number).filter(Boolean);

    return {
      tipo_constancia_id: this.contexto.tipo
        ? parseInt(this.contexto.tipo, 10)
        : null,
      programa_id: this.contexto.programa
        ? parseInt(this.contexto.programa, 10)
        : null,
      docente_id: this.contexto.docente
        ? parseInt(this.contexto.docente, 10)
        : null,
      periodo_id: this._tipoRequiereEE()
        ? idsEE[0] || null
        : this.contexto.periodo
          ? parseInt(this.contexto.periodo, 10)
          : null,
      periodo_ids: this._tipoRequiereEE() ? idsEE : [],
      ee_id: this.datosAutoCargados.ee?.[0]?.id || null,
      fecha_emision:
        document.getElementById("input-fecha-emision")?.value ||
        new Date().toISOString().split("T")[0],

      docente_tratamiento: doc?.tratamiento || "",
      docente_articulo: doc?.articulo || "",
      docente_nombre: [
        doc?.nombres,
        doc?.apellido_paterno,
        doc?.apellido_materno,
      ]
        .filter(Boolean)
        .join(" "),
      docente_codigo: doc?.codigo || "",
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
      textos_overrides: this.configuracionPanelDerecho.textosEditables,
      ruta_guardado: this.configuracionPanelDerecho.rutaGuardado,
      logotipo_url: this.configuracionPanelDerecho.logotipoUrl,
    };
  }

  limpiarAutoCarga() {
    this.contexto.docente = null;

    const fechaActual = this.datosAutoCargados.fecha;
    const firmasActuales = this.datosAutoCargados.firmas;

    this.datosAutoCargados = {
      ee: [],
      fecha: fechaActual,
      firmas: firmasActuales,
    };

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

    this.periodosIncluidos = new Set();
    this.periodosAsignadosDocente = [];

    this.limpiarAutoCarga();

    this.establecerFechaDefault();

    const frame = document.getElementById("preview-frame");
    const placeholder = document.getElementById("preview-placeholder");
    if (frame) {
      frame.srcdoc = "";
      frame.classList.remove("visible");
    }
    if (placeholder) {
      placeholder.style.display = "flex";
    }

    Toast.success("Formulario restablecido", 3000);
  }

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
      const payload = this._buildPayload();

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
