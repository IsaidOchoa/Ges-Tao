/**
 * Módulo de Emisión de Constancias
 * @module EmisionModule
 * @description Gestiona la interfaz y lógica para la generación de constancias docentes
 * @version 1.1.0
 * @author [Tu Nombre]
 * @license MIT
 */

import { Toast } from "../components/common/Toast.js";

export class EmisionModule {
  /**
   * Crea una instancia del módulo de emisión
   */
  constructor() {
    this.datosMaestros = {
      tipos: [],
      programas: [],
      periodos: [],
      docentes: [],
      directivos: [],
      ee: [], // 🔹 Asegurar que existe desde la inicialización
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
      firmas: {} 
    };
    // 🔹 Referencia para gestión de listeners (patrón idempotente)
    this._listenersCleanup = [];
  }

  /**
   * Inicializa el módulo: carga datos, configura UI y establece estado inicial
   * @async
   * @returns {Promise<void>}
   */
  async init() {
    // 🔹 CORRECCIÓN 1: Limpiar toasts residuales al montar la vista
    this._limpiarToastsResiduales();
    
    // 🔹 CORRECCIÓN 2: Validar que el DOM esté listo antes de manipularlo
    if (!this._verificarElementosCriticos()) {
      Toast.error("Error de inicialización: elementos del formulario no encontrados", 8000);
      console.error("[EmisionModule] DOM incompleto. Verificar HTML de la vista.");
      return;
    }

    try {
      await this.cargarDatosIniciales();
      this.configurarFormulario();
      this.establecerFechaDefault();
      this.actualizarPreview();
      
      // Logging para auditoría (desarrollo)
      if (process?.env?.NODE_ENV === "development") {
        console.log("✅ EmisionModule inicializado correctamente");
      }
    } catch (err) {
      console.error("❌ Error crítico en init():", err);
      Toast.error("No se pudo cargar el módulo de emisión", 10000);
    }
  }

  /**
   * Limpia elementos toast que puedan haber quedado del ciclo de vida anterior
   * @private
   */
  _limpiarToastsResiduales() {
    // Método 1: Usar API del componente Toast si existe
    if (typeof Toast?.clear === "function") {
      Toast.clear();
      return;
    }
    
    // Método 2: Limpieza manual defensiva (fallback)
    const selectoresToast = [
      ".toast-container", 
      ".toast-wrapper", 
      "[data-component='toast']",
      ".notification-area"
    ];
    
    selectoresToast.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        // Animación de salida antes de remover (mejor UX)
        if (el.animate) {
          el.animate(
            [{ opacity: 1 }, { opacity: 0 }], 
            { duration: 200, easing: "ease-out" }
          ).onfinish = () => el.remove();
        } else {
          el.remove();
        }
      });
    });
  }

  /**
   * Verifica que los elementos DOM críticos existan antes de proceder
   * @private
   * @returns {boolean} True si todos los elementos están presentes
   */
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
      "btn-limpiar"
    ];
    
    return elementosRequeridos.every(id => {
      const existe = document.getElementById(id) !== null;
      if (!existe && process?.env?.NODE_ENV === "development") {
        console.warn(`[EmisionModule] Elemento #${id} no encontrado en el DOM`);
      }
      return existe;
    });
  }

  /**
   * Carga los catálogos maestros desde el backend vía Electron API
   * @async
   * @private
   */
  async cargarDatosIniciales() {
    try {
      // Validación de seguridad: verificar API disponible
      if (!window.electronAPI?.obtenerDatosConstancia) {
        throw new Error("API 'obtenerDatosConstancia' no disponible. Verificar preload.js");
      }

      const resp = await window.electronAPI.obtenerDatosConstancia();
      
      if (!resp?.success) {
        throw new Error(resp?.error || "Respuesta inválida del servidor");
      }

      // 🔹 Defensive programming: validar estructura de respuesta
      const data = resp.data || {};
      
      this.datosMaestros = {
        tipos: Array.isArray(data.tipos) ? data.tipos : [],
        programas: Array.isArray(data.programas) ? data.programas : [],
        periodos: Array.isArray(data.periodos) ? data.periodos : [],
        docentes: Array.isArray(data.docentes) ? data.docentes : [],
        directivos: Array.isArray(data.directivos) ? data.directivos : [],
        ee: Array.isArray(data.ee) ? data.ee : [], // 🔹 Incluir EE si viene en la respuesta
      };

      this.llenarSelectores();
      
    } catch (err) {
      // 🔹 Logging estructurado para diagnóstico
      console.error("[EmisionModule] Error en cargarDatosIniciales:", {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
      
      // 🔹 Toast con mensaje amigable al usuario
      Toast.error("Error al cargar catálogos. Verifique su conexión o contacte a soporte.", 8000);
      
      // 🔹 Estado degradado: deshabilitar formulario
      this._deshabilitarFormulario(true);
    }
  }

  /**
   * Habilita/deshabilita los controles del formulario
   * @private
   * @param {boolean} deshabilitar - Estado deseado
   */
  _deshabilitarFormulario(deshabilitar) {
    ["sel-tipo", "sel-programa", "sel-periodo", "sel-docente", "sel-ee"]
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = deshabilitar;
      });
    
    const btn = document.getElementById("btn-generar");
    if (btn) btn.disabled = deshabilitar;
  }

  /**
   * Llena los elementos <select> con los datos maestros cargados
   * @private
   */
  llenarSelectores() {
    /**
     * Función helper para poblar selects de forma segura
     * @param {string} id - ID del elemento select
     * @param {Array} items - Array de objetos a renderizar
     * @param {string} defaultTxt - Texto para la opción por defecto
     * @param {string} valKey - Clave del objeto para usar como value
     * @param {Function|null} txtFn - Función para generar el texto visible
     */
    const fill = (id, items, defaultTxt, valKey = "id", txtFn = null) => {
      const sel = document.getElementById(id);
      if (!sel) {
        // Logging silencioso en producción
        if (process?.env?.NODE_ENV === "development") {
          console.warn(`[EmisionModule] Select #${id} no encontrado`);
        }
        return;
      }

      // Limpiar opciones previas manteniendo estructura
      sel.innerHTML = `<option value="">${defaultTxt}</option>`;

      // Validación defensiva de datos
      if (!Array.isArray(items) || items.length === 0) {
        sel.disabled = true;
        return;
      }

      // Función por defecto para extraer texto legible
      const defaultTextFn = (item) => 
        item.nombre || item.clave || item.codigo || item.descripcion || String(item[valKey] ?? "");

      // Renderizar opciones con DocumentFragment (mejor rendimiento)
      const fragment = document.createDocumentFragment();
      
      items.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item[valKey] ?? "";
        opt.textContent = typeof txtFn === "function" 
          ? txtFn(item) 
          : defaultTextFn(item);
        fragment.appendChild(opt);
      });
      
      sel.appendChild(fragment);
      sel.disabled = false; // 🔹 Habilitar solo si hay datos válidos
    };

    // 1. Tipos de constancia
    fill(
      "sel-tipo",
      this.datosMaestros.tipos,
      "Seleccione un tipo...",
      "id",
      (i) => i.nombre,
    );

    // 2. Programas institucionales
    fill(
      "sel-programa",
      this.datosMaestros.programas,
      "Seleccione un programa...",
      "id",
      (i) => i.nombre,
    );

    // 3. Periodos escolares 🔹 CORRECCIÓN: usar clave+descripcion
    fill(
      "sel-periodo",
      this.datosMaestros.periodos,
      "Seleccione un periodo...",
      "id",
      (p) => `${p.clave || ""} - ${p.descripcion || ""}`.trim(),
    );

    // 4. Docentes (formato: Apellido, Nombre (Código))
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

    // 🔹 CORRECCIÓN CRÍTICA: fillSelect → fill (función definida en este ámbito)
    fill(
      "sel-ee",
      this.datosMaestros.ee,
      "Ninguna",
      "id",
      (i) => `${i.nrc || i.clave_ee || ""} - ${i.nombre || ""}`.trim(),
    );
  }

  /**
   * Configura los event listeners del formulario con gestión de limpieza
   * @private
   */
  configurarFormulario() {
    // 🔹 Patrón: limpiar listeners previos para evitar duplicación
    this._limpiarListenersPrevios();

    // Helper para registrar listeners con cleanup
    const bindWithCleanup = (id, event, handler) => {
      const el = document.getElementById(id);
      if (!el) return;
      
      el.addEventListener(event, handler);
      // Registrar función de limpieza para este listener
      this._listenersCleanup.push(() => {
        el.removeEventListener(event, handler);
      });
    };

    // 1. Selectores de contexto -> Habilitan selector de docente
    ["sel-tipo", "sel-programa", "sel-periodo"].forEach((id) => {
      bindWithCleanup(id, "change", () => this.actualizarContexto());
    });

    // 2. Selector de docente -> Dispara carga automática de datos
    bindWithCleanup("sel-docente", "change", (e) => {
      if (e.target.value) {
        this.cargarDatosDocente(e.target.value);
      } else {
        this.limpiarAutoCarga();
      }
    });

    // 3. Fecha de emisión -> Actualiza preview en tiempo real
    bindWithCleanup("input-fecha-emision", "change", (e) => {
      this.datosAutoCargados.fecha = e.target.value
        ? new Date(e.target.value)
        : new Date();
      this.actualizarPreview();
    });

    // 4. Selector de Experiencia Educativa -> Actualiza preview
    bindWithCleanup("sel-ee", "change", () => {
      this.actualizarPreview();
    });

    // 5. Submit del formulario
    bindWithCleanup("form-constancia", "submit", (e) => {
      e.preventDefault();
      this.generarConstancia(e);
    });

    // 6. Botón limpiar
    bindWithCleanup("btn-limpiar", "click", () => this.limpiarTodo());
  }

  /**
   * Limpia todos los listeners registrados para prevenir memory leaks
   * @private
   */
  _limpiarListenersPrevios() {
    this._listenersCleanup.forEach(cleanup => {
      try {
        cleanup();
      } catch (err) {
        // Ignorar errores en limpieza (elementos ya removidos del DOM)
        if (process?.env?.NODE_ENV === "development") {
          console.warn("[EmisionModule] Error limpiando listener:", err);
        }
      }
    });
    this._listenersCleanup = [];
  }

  /**
   * Actualiza el estado del contexto según los valores seleccionados
   * @private
   */
  actualizarContexto() {
    // Lectura segura con optional chaining
    this.contexto.tipo = document.getElementById("sel-tipo")?.value || null;
    this.contexto.programa = document.getElementById("sel-programa")?.value || null;
    this.contexto.periodo = document.getElementById("sel-periodo")?.value || null;

    // Lógica de habilitación: docente solo disponible con periodo seleccionado
    const selDoc = document.getElementById("sel-docente");
    if (selDoc) {
      if (this.contexto.periodo) {
        selDoc.disabled = false;
        // Restaurar texto por defecto si estaba modificado
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
    
    this.actualizarPreview();
  }

  /**
   * Carga los datos específicos del docente seleccionado
   * @async
   * @private
   * @param {string} docenteId - ID del docente seleccionado
   */
  async cargarDatosDocente(docenteId) {
    // Validación de entrada
    if (!docenteId) {
      this.limpiarAutoCarga();
      return;
    }

    this.contexto.docente = docenteId;
    const tbody = document.getElementById("preview-tabla-body");
    
    // Estado de carga visual
    if (tbody) {
      tbody.innerHTML = 
        '<tr><td colspan="7" class="loading-state">' +
        '<i class="fa-solid fa-spinner fa-spin"></i> Cargando datos...</td></tr>';
    }

    try {
      // 🔹 Verificación de seguridad de la API
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
        throw new Error(resp?.error || "Sin datos disponibles para este docente");
      }

      // 🔹 Mapeo seguro de datos con validación de tipos
      const asignaciones = resp.data.asignaciones || [];
      
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
        firmas: resp.data.firmas || {},
      };

      // Actualizar UI: selector de EE
      const selEE = document.getElementById("sel-ee");
      if (selEE) {
        if (this.datosAutoCargados.ee.length > 0) {
          // Seleccionar primera EE por defecto
          selEE.value = this.datosAutoCargados.ee[0].id;
          selEE.disabled = false;
        } else {
          selEE.value = "";
          selEE.disabled = true;
          selEE.innerHTML = '<option value="">Sin asignaciones</option>';
        }
      }

      // Renderizar tabla y actualizar preview
      this.renderTabla();
      this.actualizarPreview();
      
      // Logging para auditoría (solo desarrollo)
      if (process?.env?.NODE_ENV === "development") {
        console.log("✅ Docente cargado:", {
          id: docenteId,
          eeCount: this.datosAutoCargados.ee.length,
          eeId: this.datosAutoCargados.ee[0]?.id,
        });
      }
      
    } catch (err) {
      // 🔹 Logging estructurado del error
      console.error("[EmisionModule] Error en cargarDatosDocente:", {
        docenteId,
        periodoId: this.contexto.periodo,
        message: err.message,
        stack: err.stack,
      });
      
      // 🔹 Toast con mensaje claro y duración extendida
      Toast.error(
        `No se pudieron cargar los datos del docente: ${err.message}`, 
        8000
      );
      
      // 🔹 Estado de recuperación: limpiar datos parciales
      this.limpiarAutoCarga();
    }
  }

  /**
   * Renderiza la tabla de experiencias educativas en el preview
   * @private
   */
  renderTabla() {
    const tbody = document.getElementById("preview-tabla-body");
    if (!tbody) return;

    // Estado vacío
    if (!this.datosAutoCargados.ee?.length) {
      tbody.innerHTML = 
        '<tr><td colspan="7" class="empty-state">' +
        'Sin asignaciones registradas para este periodo</td></tr>';
      return;
    }

    // Renderizar filas con DocumentFragment (optimización)
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

  /**
   * Establece la fecha actual como valor por defecto en el input
   * @private
   */
  establecerFechaDefault() {
    const input = document.getElementById("input-fecha-emision");
    if (input) {
      const hoy = new Date().toISOString().split("T")[0];
      input.value = hoy;
      this.datosAutoCargados.fecha = new Date();
    }
  }

  /**
   * Actualiza los campos dinámicos del preview de la constancia
   * @private
   */
  actualizarPreview() {
    // 🔹 Formateo de fecha con Intl API (mejor práctica i18n)
    const fecha = this.datosAutoCargados.fecha || new Date();
    const opts = { day: "numeric", month: "long", year: "numeric" };
    
    try {
      const partes = new Intl.DateTimeFormat("es-MX", opts).formatToParts(fecha);
      
      const getElement = (id) => document.getElementById(id);
      
      const setValue = (id, value) => {
        const el = getElement(id);
        if (el) el.textContent = value;
      };

      setValue("preview-dia", partes.find(p => p.type === "day")?.value || "__");
      setValue("preview-mes", partes.find(p => p.type === "month")?.value || "________");
      setValue("preview-anio", partes.find(p => p.type === "year")?.value || "____");
      
    } catch (err) {
      console.warn("[EmisionModule] Error formateando fecha:", err);
      // Fallback seguro
      ["preview-dia", "preview-mes", "preview-anio"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "____";
      });
    }

    // 🔹 Actualización de firmas con validación defensiva
    const firmas = this.datosAutoCargados.firmas || {};
    
    if (firmas.coord?.nombre) {
      const el = document.getElementById("preview-firma1-nombre");
      if (el) el.textContent = firmas.coord.nombre;
    }
    
    if (firmas.director?.nombre) {
      const el = document.getElementById("preview-firma2-nombre");
      if (el) el.textContent = firmas.director.nombre;
    }

    // 🔹 Actualizar datos del docente si está seleccionado
    if (this.contexto.docente) {
      const doc = this.datosMaestros.docentes.find(
        d => String(d.id) === String(this.contexto.docente)
      );
      
      if (doc) {
        const tratamiento = doc.tratamiento || "El/La";
        const nombreCompleto = [doc.nombres, doc.apellido_paterno, doc.apellido_materno]
          .filter(Boolean)
          .join(" ");
        
        const setDocPreview = (id, value) => {
          const el = document.getElementById(id);
          if (el) el.textContent = value;
        };
        
        setDocPreview("preview-tratamiento", tratamiento);
        setDocPreview("preview-nombre-docente", nombreCompleto || "[NOMBRE]");
        setDocPreview("preview-codigo-docente", doc.codigo || "[CÓDIGO]");
      }
    }
  }

  /**
   * Limpia los datos auto-cargados del docente (sin afectar el contexto)
   * @private
   */
  limpiarAutoCarga() {
    this.contexto.docente = null;
    
    // Preservar la fecha actual al limpiar
    const fechaActual = this.datosAutoCargados.fecha;
    
    this.datosAutoCargados = {
      ee: [],
      fecha: fechaActual,
      firmas: {},
    };

    // Resetear UI del preview
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
        'Seleccione un docente para cargar asignaciones</td></tr>';
    }

    // Resetear selector de EE
    const selEE = document.getElementById("sel-ee");
    if (selEE) {
      selEE.innerHTML = '<option value="">Ninguna</option>';
      selEE.disabled = true;
      selEE.value = "";
    }

    this.actualizarPreview();
  }

  /**
   * Limpia todo el formulario y restablece el estado inicial
   * @public
   */
  limpiarTodo() {
    const form = document.getElementById("form-constancia");
    if (form) form.reset();
    
    // Resetear contexto completo
    this.contexto = {
      tipo: null,
      programa: null,
      periodo: null,
      docente: null,
    };
    
    // Limpiar datos auto-cargados
    this.limpiarAutoCarga();
    
    // Deshabilitar selector de docente
    const selDoc = document.getElementById("sel-docente");
    if (selDoc) {
      selDoc.disabled = true;
      selDoc.options[0].textContent = "Primero seleccione periodo...";
    }
    
    // Restaurar fecha por defecto
    this.establecerFechaDefault();
    
    // Resetear folio preview
    const folioEl = document.getElementById("preview-folio");
    if (folioEl) folioEl.textContent = "CO/MSICU/POR GENERAR";
    
    // Feedback visual al usuario
    Toast.success("Formulario restablecido", 3000);
  }

  /**
   * Genera la constancia PDF con los datos del formulario
   * @async
   * @param {Event} e - Evento de submit
   * @private
   */
  async generarConstancia(e) {
    e.preventDefault();
    
    // 🔹 VALIDACIÓN: Lectura directa del DOM para evitar estados desincronizados
    const docenteVal = document.getElementById("sel-docente")?.value;
    if (!docenteVal) {
      Toast.warning("Seleccione un docente para continuar.", 6000);
      // Enfocar el campo para mejor UX
      document.getElementById("sel-docente")?.focus();
      return;
    }

    // 🔹 Estado de carga en botón (feedback visual)
    const btn = document.getElementById("btn-generar");
    if (!btn) return;
    
    const originalState = {
      disabled: btn.disabled,
      html: btn.innerHTML,
      text: btn.textContent,
    };
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando PDF...';

    try {
      // 🔹 Construcción del payload con validación de tipos
      const payload = {
        tipo_constancia_id: this.contexto.tipo 
          ? parseInt(this.contexto.tipo, 10) 
          : null,
        programa_id: this.contexto.programa 
          ? parseInt(this.contexto.programa, 10) 
          : null,
        docente_id: parseInt(docenteVal, 10),
        periodo_id: this.contexto.periodo 
          ? parseInt(this.contexto.periodo, 10) 
          : null,
        
        // Prioridad: ID de EE auto-cargado (garantiza integridad referencial)
        ee_id: this.datosAutoCargados.ee?.[0]?.id || null,
        
        fecha_emision: document.getElementById("input-fecha-emision")?.value 
          || new Date().toISOString().split("T")[0],
        
        cuerpoHtml: this.generarHtmlCuerpo(),
        cierreHtml: this.generarHtmlCierre(),
        eeList: this.datosAutoCargados.ee || [],
        firmaCoord: this.datosAutoCargados.firmas?.coord?.nombre || "",
        firmaDirector: this.datosAutoCargados.firmas?.director?.nombre || "",
      };

      // Logging para auditoría (solo desarrollo)
      if (process?.env?.NODE_ENV === "development") {
        console.log("📤 Payload generarConstancia:", {
          ...payload,
          cuerpoHtml: "[OMITIDO]",
          cierreHtml: "[OMITIDO]",
        });
      }

      // 🔹 Validación de reglas de negocio antes de enviar
      if (this._requiereExperienciaEducativa() && !payload.ee_id) {
        Toast.error(
          "Este tipo de constancia requiere seleccionar una Experiencia Educativa. " +
          "Verifique que el docente tenga asignaciones registradas.", 
          8000
        );
        return;
      }

      // 🔹 Verificación de API disponible
      if (!window.electronAPI?.generarConstanciaPDF) {
        throw new Error("API de generación de PDF no disponible");
      }

      // 🔹 Solicitud al proceso principal de Electron
      const resp = await window.electronAPI.generarConstanciaPDF(payload);

      if (resp?.success) {
        // ✅ Éxito: actualizar UI y notificar
        const folioEl = document.getElementById("preview-folio");
        if (folioEl && resp.folio) {
          folioEl.textContent = resp.folio;
        }
        
        Toast.success(`Constancia emitida exitosamente. Folio: ${resp.folio}`, 8000);
        
        // Auto-limpieza después de confirmar
        setTimeout(() => {
          if (!document.hidden) { // Solo si la pestaña está visible
            this.limpiarTodo();
          }
        }, 3000);
        
      } else {
        // ❌ Error del servidor
        const errorMsg = resp?.error || "Error desconocido del servidor";
        console.error("[EmisionModule] Error del servidor:", errorMsg);
        Toast.error(`No se pudo generar la constancia: ${errorMsg}`, 10000);
      }
      
    } catch (err) {
      // 🔹 Manejo de errores de red o ejecución
      console.error("[EmisionModule] Error crítico en generarConstancia:", {
        message: err.message,
        stack: err.stack,
        payload: { docente_id: payload?.docente_id, ee_id: payload?.ee_id }
      });
      
      Toast.error(
        `Error de conexión o procesamiento: ${err.message}. ` +
        "Intente nuevamente o contacte a soporte técnico.", 
        10000
      );
      
    } finally {
      // 🔹 Restaurar estado del botón (siempre, incluso en error)
      if (btn && originalState) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }

  /**
   * Determina si el tipo de constancia seleccionado requiere EE
   * @private
   * @returns {boolean}
   */
  _requiereExperienciaEducativa() {
    if (!this.contexto.tipo || !this.datosMaestros.tipos.length) {
      return false; // No se puede determinar, permitir envío
    }
    
    const tipoSeleccionado = this.datosMaestros.tipos.find(
      t => String(t.id) === String(this.contexto.tipo)
    );
    
    // Asumir que requiere EE si el flag existe y es verdadero
    return Boolean(tipoSeleccionado?.requiere_ee);
  }

  /**
   * Genera el cuerpo HTML de la constancia con datos del docente
   * @private
   * @returns {string} HTML seguro
   */
  generarHtmlCuerpo() {
    const doc = this.datosMaestros.docentes.find(
      d => String(d.id) === String(this.contexto.docente)
    );
    
    if (!doc) return "";
    
    // 🔹 Escapado de HTML para prevenir XSS (aunque los datos vengan de BD)
    const tratamiento = this._escapeHtml(doc.tratamiento || "El/La");
    const nombres = this._escapeHtml(doc.nombres || "");
    const paterno = this._escapeHtml(doc.apellido_paterno || "");
    const materno = this._escapeHtml(doc.apellido_materno || "");
    const codigo = this._escapeHtml(doc.codigo || "");
    
    return `Que <strong>${tratamiento} ${nombres} ${paterno} ${materno}</strong>, ` +
           `con número de personal <strong>${codigo}</strong>, ` +
           `pertenece al cuerpo docente del Programa Educativo de Posgrado ` +
           `Maestría en Sistemas Interactivos Centrados en el Usuario (16156), ` +
           `programa adscrito a la Facultad de Estadística e Informática (11304) ` +
           `y ha impartido las siguientes experiencias educativas:`;
  }

  /**
   * Genera el cierre HTML con fecha formateada
   * @private
   * @returns {string} HTML seguro
   */
  generarHtmlCierre() {
    const input = document.getElementById("input-fecha-emision");
    const fechaInput = input?.value;
    
    const fecha = fechaInput 
      ? new Date(fechaInput) 
      : (this.datosAutoCargados.fecha || new Date());
    
    const opts = { day: "numeric", month: "long", year: "numeric" };
    
    try {
      const partes = new Intl.DateTimeFormat("es-MX", opts).formatToParts(fecha);
      
      const getPart = (type) => 
        this._escapeHtml(partes.find(p => p.type === type)?.value || "");
      
      const dia = getPart("day") || "__";
      const mes = getPart("month") || "________";
      const anio = getPart("year") || "____";
      
      return `Para los fines que al interesado convenga se extiende la presente ` +
             `en la ciudad de Xalapa, Enríquez, Veracruz a los ` +
             `<strong>${dia}</strong> días del mes de ` +
             `<strong>${mes}</strong> del año ` +
             `<strong>${anio}</strong>.`;
             
    } catch (err) {
      console.warn("[EmisionModule] Error formateando fecha para HTML:", err);
      // Fallback seguro
      return `Para los fines que al interesado convenga se extiende la presente ` +
             `en la ciudad de Xalapa, Enríquez, Veracruz.`;
    }
  }

  /**
   * Escapa caracteres HTML para prevenir inyección XSS
   * @private
   * @param {string} str - Texto a escapar
   * @returns {string} Texto seguro para inserción en HTML
   */
  _escapeHtml(str) {
    if (typeof str !== "string") return String(str ?? "");
    
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    
    return str.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Destructor: limpia recursos al desmontar el módulo
   * @public
   */
  destroy() {
    // Limpiar listeners registrados
    this._limpiarListenersPrevios();
    
    // Limpiar toasts pendientes
    this._limpiarToastsResiduales();
    
    // Resetear referencias para garbage collection
    this.datosMaestros = {};
    this.contexto = {};
    this.datosAutoCargados = {};
    
    if (process?.env?.NODE_ENV === "development") {
      console.log("♻️ EmisionModule destruido - recursos liberados");
    }
  }
}