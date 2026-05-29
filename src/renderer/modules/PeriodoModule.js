// src/renderer/modules/PeriodoModule.js
import { DataTable } from "../components/DataTable/DataTable.js";
import { globalConfirm } from "../utils/confirmationModal.js";
import {
  generarClavePeriodo,
  validarDuracionPeriodo,
  generarFechasDesdePlantilla,
} from "../utils/periodUtils.js";
import { Toast } from "../components/common/Toast.js";
import { Tooltip } from "../utils/toolTip.js";
import "../styles/modals/modal-periodo.css";

import modalPeriodoHtml from "../views/partials/modals/modal-periodo.html";

export class PeriodoModule {
  constructor() {
    // Estado interno
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.currentPlantilla = "semestre-a";
    this.currentAnio = new Date().getFullYear();
    this.tbodyId = "tabla-periodos-body";
    this.instanceName = "periodoModuleInstance";
    this.expandable = false;
    this.actions = true;
  }

  // =========================================
  // INICIALIZACIÓN PRINCIPAL (Plantilla Canónica)
  // =========================================
  async init() {
    console.log(`📘 [${this.constructor.name}] Iniciando...`);

    // 1. Inyectar modal (idempotente)
    this._injectModal();

    // 2. Esperar que el tbody esté en el DOM
    await this._waitForDOM(this.tbodyId);

    // 3. Cargar datos (lazy load)
    if (!this.data?.length) {
      console.log(`📡 [${this.constructor.name}] Cargando datos desde IPC...`);
      await this._loadData();
    } else {
      console.log(`💾 [${this.constructor.name}] Usando datos en caché...`);
    }

    // 4. Validar tbody
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) {
      console.error(
        `❌ [${this.constructor.name}] tbody "${this.tbodyId}" no encontrado`,
      );
      Toast.error("Error de inicialización: tabla no encontrada", 5000);
      return;
    }

    // 5. Crear y configurar DataTable
    this.table = new DataTable({
      tbodyId: this.tbodyId,
      columns: this._getColumns(),
      expandable: this.expandable,
      actions: this.actions,
      onRowClick: `${this.instanceName}.handleRowClick(event)`,
      onAction: `${this.instanceName}.toggleActionMenu(event)`,
      // onExpand NO se incluye porque expandable: false
      onEdit: `${this.instanceName}.openEditModalFromMenu`,
      onToggleStatus: `${this.instanceName}.togglePeriodoStatus`, // 🔹 Callback para toggle
    });

    // 6. Renderizar datos o estado vacío
    if (this.data?.length) {
      this.table.setData(this.data);
      console.log(
        `✅ [${this.constructor.name}] Tabla renderizada con ${this.data.length} registros`,
      );
    } else {
      this._renderEmptyState();
      console.log(`ℹ️ [${this.constructor.name}] Sin registros para mostrar`);
    }

    // 7. Delegación de eventos para menú contextual (scoped a esta tabla)
    tbody.addEventListener("click", (e) => {
      const menuItem = e.target.closest(".context-item");
      if (!menuItem) return;

      e.preventDefault();
      e.stopPropagation();

      const action = menuItem.dataset.action;
      const rowId = menuItem.dataset.id;

      // Cerrar todos los menús primero
      document
        .querySelectorAll(".context-menu")
        .forEach((m) => m.classList.add("hidden"));

      // Ejecutar acción
      if (
        action === "toggle" &&
        typeof this.togglePeriodoStatus === "function"
      ) {
        this.togglePeriodoStatus(rowId);
      } else if (
        action === "edit" &&
        typeof this.openEditModalFromMenu === "function"
      ) {
        this.openEditModalFromMenu(rowId);
      }
    });

    // 8. Configurar utilidades
    this._setupSearch();
    this._setupModalEvents();

    // 9. Exponer instancia global (CRÍTICO para callbacks inline)
    window[this.instanceName] = this;

    // 10. Marcar como inicializado
    this.initialized = true;
    console.log(`✅ [${this.constructor.name}] Inicialización completa`);
  }

  // =========================================
  // INYECCIÓN DE MODAL (Auto-gestionada)
  // =========================================
  _injectModal() {
    if (this.modalElement || document.getElementById("modal-periodo")) {
      this.modalElement = document.getElementById("modal-periodo");
      return;
    }
    const template = document.createElement("div");
    template.innerHTML = modalPeriodoHtml;
    document.body.appendChild(template.firstElementChild);
    this.modalElement = document.getElementById("modal-periodo");
    console.log("✅ [PeriodoModule] Modal inyectado");
  }

  // =========================================
  // UTILIDAD: Esperar elemento en DOM
  // =========================================
  async _waitForDOM(elementId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(elementId)) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    console.error(
      `❌ [${this.constructor.name}] Timeout: "${elementId}" no encontrado`,
    );
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarPeriodos();
      if (res.success) {
        this.data = res.rows || res.data;
        return true;
      }
      console.warn("⚠️ [PeriodoModule] Error en respuesta IPC:", res.error);
      Toast.warning("No se pudieron cargar los periodos", 4000);
      return false;
    } catch (error) {
      console.error("❌ [PeriodoModule] Error cargando datos:", error);
      Toast.error("Error de conexión al cargar periodos", 5000);
      return false;
    }
  }

  // =========================================
  // COLUMNAS DE TABLA
  // =========================================
  _getColumns() {
    return [
      {
        key: "clave",
        label: "Código",
        format: (v) =>
          `<strong style="font-family:monospace; color:var(--accent-color);">${v}</strong>`,
      },
      { key: "descripcion", label: "Periodo" },
      {
        key: "fecha_inicio",
        label: "Inicio",
        format: (v) => this._formatDate(v),
      },
      { key: "fecha_fin", label: "Fin", format: (v) => this._formatDate(v) },
      {
        key: "estado",
        label: "Estado",
        badge: true,
        format: (v) => {
          const map = {
            activo: { label: "Activo", class: "badge-success" },
            inactivo: { label: "Inactivo", class: "badge-warning" },
            cerrado: { label: "Cerrado", class: "badge-secondary" },
          };
          const config = map[v] || { label: v, class: "badge-secondary" };
          return `<span class="badge ${config.class}">${config.label}</span>`;
        },
      },
    ];
  }

  // =========================================
  // FORMATO DE FECHA (Timezone-Safe)
  // =========================================
  _formatDate(dateStr) {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  _formatDateDisplay(dateStr) {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  _formatMes(monthIndex) {
    const meses = [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ];
    return meses[monthIndex];
  }

  // =========================================
  // BUSCADOR
  // =========================================
  _setupSearch() {
    const input = document.getElementById("buscador-periodos");
    if (!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener("input", (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) {
        this.table?.setData(this.data);
        return;
      }
      const filtered = this.data.filter(
        (item) =>
          (item.clave || "").toLowerCase().includes(txt) ||
          (item.descripcion || "").toLowerCase().includes(txt),
      );
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById("btn-nuevo-periodo");
    const modal = this.modalElement;
    if (!btnNuevo || !modal) {
      console.warn("⚠️ [PeriodoModule] Elementos del modal no encontrados");
      return;
    }

    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this._openModal();
    };

    const cerrar = () => {
      // 1. Restaurar título a "Nuevo Periodo Escolar"
      const modalTitle = this.modalElement?.querySelector(".modal-header h3");
      if (modalTitle) {
        modalTitle.textContent = "Nuevo Periodo Escolar";
      }
      modal.classList.add("hidden");
    };
    document
      .getElementById("btn-cerrar-modal-periodo")
      ?.addEventListener("click", cerrar);
    document
      .getElementById("btn-cancelar-periodo")
      ?.addEventListener("click", cerrar);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) cerrar();
    });

    const btnSave = document.getElementById("btn-guardar-periodo");
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await this._savePeriodo(modal);
      });
    }

    // Listeners para radios de plantilla
    modal.querySelectorAll('input[name="plantilla"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "personalizado") {
          this._activarModoPersonalizado();
        } else {
          this._ocultarFechasPersonalizadas();
          this._actualizarFechasDesdePlantilla();
        }
      });
    });

    document
      .getElementById("periodo-anio-base")
      ?.addEventListener("change", () =>
        this._actualizarFechasDesdePlantilla(),
      );
    document
      .getElementById("periodo-fecha-inicio")
      ?.addEventListener("change", () => this._validarYActualizarClave());
    document
      .getElementById("periodo-fecha-fin")
      ?.addEventListener("change", () => this._validarYActualizarClave());
  }

  // =========================================
  // LÓGICA DE PLANTILLAS (Preservada)
  // =========================================
  _initAnioSelector() {
    const select = document.getElementById("periodo-anio-base");
    if (!select) return;
    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 60;
    const maxYear = currentYear + 1;
    select.innerHTML = "";
    for (let year = maxYear; year >= minYear; year--) {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      if (year === currentYear) option.selected = true;
      select.appendChild(option);
    }
  }

  _actualizarFechasDesdePlantilla() {
    const plantilla = document.querySelector(
      'input[name="plantilla"]:checked',
    )?.value;
    const anioEl = document.getElementById("periodo-anio-base");
    const anio = anioEl ? parseInt(anioEl.value) : new Date().getFullYear();

    if (!plantilla || plantilla === "personalizado") {
      this._activarModoPersonalizado();
      return;
    }

    try {
      const { fechaInicio, fechaFin, clave, descripcion } =
        generarFechasDesdePlantilla(plantilla, anio);
      const inicioHidden = document.getElementById(
        "periodo-fecha-inicio-hidden",
      );
      const finHidden = document.getElementById("periodo-fecha-fin-hidden");
      const claveInput = document.getElementById("periodo-clave");
      const descInput = document.getElementById("periodo-descripcion");

      if (inicioHidden) inicioHidden.value = fechaInicio;
      if (finHidden) finHidden.value = fechaFin;
      if (claveInput) claveInput.value = clave;
      if (descInput) descInput.value = descripcion;

      const resultClave = document.getElementById("result-clave");
      const displayClave = document.getElementById("display-clave");
      const resultRango = document.getElementById("result-rango");
      const displayInicio = document.getElementById("display-fecha-inicio");
      const displayFin = document.getElementById("display-fecha-fin");

      if (resultClave) resultClave.textContent = clave;
      if (displayClave) displayClave.textContent = clave;
      if (resultRango) resultRango.textContent = descripcion;
      if (displayInicio)
        displayInicio.textContent = this._formatDateDisplay(fechaInicio);
      if (displayFin)
        displayFin.textContent = this._formatDateDisplay(fechaFin);

      this._ocultarFechasPersonalizadas();
      this._actualizarEstado("valid", "Periodo válido", "Listo para guardar");
    } catch (error) {
      console.error("Error generando fechas:", error);
      this._actualizarEstado("error", "Error al generar fechas", error.message);
    }
  }

  _activarModoPersonalizado() {
    const sectionPersonalizada = document.getElementById(
      "section-fechas-personalizadas",
    );
    const sectionAutomatica = document.getElementById(
      "section-fechas-automaticas",
    );
    const inicioEl = document.getElementById("periodo-fecha-inicio");
    const finEl = document.getElementById("periodo-fecha-fin");

    if (sectionPersonalizada) sectionPersonalizada.classList.remove("hidden");
    if (sectionAutomatica) sectionAutomatica.classList.add("hidden");
    if (inicioEl) {
      inicioEl.disabled = false;
      inicioEl.required = true;
    }
    if (finEl) {
      finEl.disabled = false;
      finEl.required = true;
    }

    const displayInicio = document.getElementById("display-fecha-inicio");
    const displayFin = document.getElementById("display-fecha-fin");
    if (displayInicio) displayInicio.textContent = "--/--/----";
    if (displayFin) displayFin.textContent = "--/--/----";

    this._actualizarEstado(
      "warning",
      "Modo personalizado",
      "Define las fechas manualmente",
    );
  }

  _ocultarFechasPersonalizadas() {
    const sectionPersonalizada = document.getElementById(
      "section-fechas-personalizadas",
    );
    const sectionAutomatica = document.getElementById(
      "section-fechas-automaticas",
    );
    const inicioEl = document.getElementById("periodo-fecha-inicio");
    const finEl = document.getElementById("periodo-fecha-fin");

    if (sectionPersonalizada) sectionPersonalizada.classList.add("hidden");
    if (sectionAutomatica) sectionAutomatica.classList.remove("hidden");
    if (inicioEl) {
      inicioEl.disabled = true;
      inicioEl.required = false;
    }
    if (finEl) {
      finEl.disabled = true;
      finEl.required = false;
    }
  }

  _validarYActualizarClave() {
    const inicioInput = document.getElementById("periodo-fecha-inicio");
    const finInput = document.getElementById("periodo-fecha-fin");
    const inicio = inicioInput?.value;
    const fin = finInput?.value;

    if (!inicio || !fin) {
      this._actualizarEstado(
        "warning",
        "Fechas pendientes",
        "Selecciona inicio y fin",
      );
      return;
    }
    if (!validarDuracionPeriodo(inicio, fin, 6)) {
      this._actualizarEstado(
        "warning",
        "Duración excedida",
        "Los periodos no pueden exceder 6 meses",
      );
      return;
    }
    if (new Date(fin) < new Date(inicio)) {
      this._actualizarEstado(
        "error",
        "Fechas inválidas",
        "La fecha de fin no puede ser anterior a inicio",
      );
      return;
    }

    const clave = generarClavePeriodo(inicio, fin);
    const claveInput = document.getElementById("periodo-clave");
    const resultClave = document.getElementById("result-clave");
    const displayClave = document.getElementById("display-clave");
    const descInput = document.getElementById("periodo-descripcion");
    const resultRango = document.getElementById("result-rango");
    const displayInicio = document.getElementById("display-fecha-inicio");
    const displayFin = document.getElementById("display-fecha-fin");

    if (claveInput) claveInput.value = clave;
    if (resultClave) resultClave.textContent = clave;
    if (displayClave) displayClave.textContent = clave;

    const descripcion = `${this._formatMes(new Date(inicio).getMonth())} ${new Date(inicio).getFullYear()} - ${this._formatMes(new Date(fin).getMonth())} ${new Date(fin).getFullYear()}`;
    if (descInput) descInput.value = descripcion;
    if (resultRango) resultRango.textContent = descripcion;
    if (displayInicio)
      displayInicio.textContent = this._formatDateDisplay(inicio);
    if (displayFin) displayFin.textContent = this._formatDateDisplay(fin);

    this._actualizarEstado("valid", "Periodo válido", "Listo para guardar");
  }

  _actualizarEstado(tipo, titulo, mensaje) {
    requestAnimationFrame(() => {
      const panel = document.getElementById("panel-estado");
      const badge = document.getElementById("result-validacion");
      const statusTitle = document.getElementById("status-title");
      const statusMessage = document.getElementById("status-message");
      if (!panel || !badge) return;

      panel.className = `status-panel status-${tipo}`;
      badge.className = `result-badge ${tipo}`;
      if (statusTitle) statusTitle.textContent = titulo;
      if (statusMessage) statusMessage.textContent = mensaje;
      badge.textContent =
        tipo === "valid"
          ? "✓ Válido"
          : tipo === "warning"
            ? "⚠ Pendiente"
            : "✕ Inválido";
    });
  }

  // ABRIR MODAL

  _openModal(periodo = null) {
    const modal = this.modalElement;
    const form = document.getElementById("form-periodo");
    if (!modal || !form) return;

    // 1. Resetear formulario y campos ocultos
    form.reset();
    [
      "periodo-id",
      "periodo-clave",
      "periodo-descripcion",
      "periodo-estado",
      "periodo-fecha-inicio-hidden",
      "periodo-fecha-fin-hidden",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    // 2. Ocultar fechas personalizadas e inicializar selector de años
    this._ocultarFechasPersonalizadas();
    this._initAnioSelector();

    // 3. Seleccionar plantilla por defecto (Semestre A)
    const plantillaSemestreA = document.querySelector(
      'input[name="plantilla"][value="semestre-a"]',
    );
    if (plantillaSemestreA) plantillaSemestreA.checked = true;
    this.currentPlantilla = "semestre-a";
    this.currentAnio = new Date().getFullYear();

    const anioSelect = document.getElementById("periodo-anio-base");
    if (anioSelect) {
      anioSelect.value = this.currentAnio;
      anioSelect.dispatchEvent(new Event("change"));
    }

    // 🔹 REFERENCIAS PARA VIGENCIA FORZADA (UI minimalista)
    const chkVigencia = document.getElementById("chk-vigencia-forzada");
    const msgVigencia = document.getElementById("vigencia-status-msg");
    const btnInfoVigencia = document.getElementById("btn-info-vigencia");

    // 🔹 FUNCIÓN: Verificar si ya existe otro periodo forzado (excluyendo el actual)
    const verificarOtroForzado = async (periodoActualId = null) => {
      try {
        const res = await window.electronAPI.listarPeriodos();
        if (res.success && res.data) {
          return (
            res.data.find(
              (p) => p.es_vigente_forzado === 1 && p.id !== periodoActualId,
            ) || null
          );
        }
      } catch (error) {
        console.error("Error verificando periodo forzado:", error);
      }
      return null;
    };

    // 🔹 FUNCIÓN: Evaluar vigencia automática por fechas
    const evaluarVigencia = (inicio, fin) => {
      if (!inicio || !fin) return { esAuto: false, mensaje: "" };
      const hoy = new Date().toISOString().split("T")[0];
      const esAutomaticamenteVigente = inicio <= hoy && fin >= hoy;
      return esAutomaticamenteVigente
        ? { esAuto: true, mensaje: "Vigente por rango de fechas" }
        : { esAuto: false, mensaje: "Fuera de rango actual" };
    };

    // 🔹 FUNCIÓN: Obtener fechas actuales del formulario
    const obtenerFechas = () => ({
      inicio:
        document.getElementById("periodo-fecha-inicio-hidden")?.value ||
        document.getElementById("periodo-fecha-inicio")?.value,
      fin:
        document.getElementById("periodo-fecha-fin-hidden")?.value ||
        document.getElementById("periodo-fecha-fin")?.value,
    });

    // 🔹 FUNCIÓN: Actualizar UI del checkbox (siempre disponible, nunca disabled)
    const actualizarUIVigencia = async (periodoActual = null) => {
      if (!chkVigencia || !msgVigencia) return;

      const { inicio, fin } = obtenerFechas();
      const resultado = evaluarVigencia(inicio, fin);

      // Si es edición y venía forzado, mantenerlo marcado
      if (periodoActual?.es_vigente_forzado === 1) {
        chkVigencia.checked = true;
        chkVigencia.disabled = false;
        msgVigencia.innerHTML = "⚠️ Vigencia forzada manualmente";
        msgVigencia.style.color = "var(--warning-color)";
        return;
      }

      // Verificar si hay OTRO periodo forzado
      const otroForzado = await verificarOtroForzado(periodoActual?.id);
      if (otroForzado) {
        chkVigencia.checked = false;
        chkVigencia.disabled = false;
        msgVigencia.innerHTML = `⚠️ "${otroForzado.descripcion}" ya tiene vigencia forzada. Marcar esta opción la reemplazará.`;
        msgVigencia.style.color = "var(--warning-color)";
        return;
      }

      // Caso normal: mostrar mensaje según vigencia automática
      chkVigencia.checked = false;
      chkVigencia.disabled = false;
      msgVigencia.innerHTML = resultado.mensaje;
      msgVigencia.style.color = resultado.esAuto
        ? "var(--success-color)"
        : "var(--text-muted)";
    };

    // 🔹 EVENTO: Checkbox change (validar reemplazo de otro forzado)
    if (chkVigencia) {
      chkVigencia.addEventListener("change", async () => {
        if (chkVigencia.checked) {
          // Verificar si hay OTRO periodo forzado antes de permitir marcar
          const periodoActualId = document.getElementById("periodo-id")?.value
            ? parseInt(document.getElementById("periodo-id").value)
            : null;
          const otroForzado = await verificarOtroForzado(periodoActualId);

          if (otroForzado) {
            const confirmar = await globalConfirm.ask(
              "¿Reemplazar vigencia forzada?",
              `El periodo <strong>${otroForzado.descripcion}</strong> tiene vigencia forzada actualmente. ¿Deseas reemplazarlo por este periodo?`,
            );
            if (!confirmar) {
              chkVigencia.checked = false;
              return;
            }
          }
          msgVigencia.innerHTML = "⚠️ Vigencia forzada manualmente";
          msgVigencia.style.color = "var(--warning-color)";
        } else {
          const { inicio, fin } = obtenerFechas();
          const resultado = evaluarVigencia(inicio, fin);
          msgVigencia.innerHTML = resultado.mensaje;
          msgVigencia.style.color = resultado.esAuto
            ? "var(--success-color)"
            : "var(--text-muted)";
        }
      });
    }

    if (btnInfoVigencia) {
      new Tooltip({
        target: btnInfoVigencia,
        position: "top",
        delay: 200,
        content: `
      <strong>Forzar vigencia manual</strong>
      <p style="margin: 8px 0;">Úsalo solo si:</p>
      <ul style="margin: 0 0 12px 0; padding-left: 20px;">
        <li>Las fechas no coinciden con el calendario real</li>
        <li>Hay una extensión académica</li>
        <li>El reloj del servidor está desincronizado</li>
      </ul>
      <div class="tooltip-warning">
        ⚠️ Solo UN periodo puede tener esta opción activa.
      </div>
    `,
      });
    }

    // 4. MODO EDICIÓN: Precargar datos existentes
    if (periodo) {
      const idField = document.getElementById("periodo-id");
      if (idField && periodo.id) idField.value = periodo.id;
      const claveField = document.getElementById("periodo-clave");
      if (claveField && periodo.clave) claveField.value = periodo.clave;
      const descField = document.getElementById("periodo-descripcion");
      if (descField && periodo.descripcion)
        descField.value = periodo.descripcion;
      const estadoField = document.getElementById("periodo-estado");
      if (estadoField) estadoField.value = periodo.estado || "activo";

      if (periodo.fecha_inicio) {
        const fechaInicio = periodo.fecha_inicio.split("T")[0];
        const inicioHidden = document.getElementById(
          "periodo-fecha-inicio-hidden",
        );
        if (inicioHidden) inicioHidden.value = fechaInicio;
      }
      if (periodo.fecha_fin) {
        const fechaFin = periodo.fecha_fin.split("T")[0];
        const finHidden = document.getElementById("periodo-fecha-fin-hidden");
        if (finHidden) finHidden.value = fechaFin;
      }

      const resultClave = document.getElementById("result-clave");
      if (resultClave) resultClave.textContent = periodo.clave || "---";
      const displayClave = document.getElementById("display-clave");
      if (displayClave) displayClave.textContent = periodo.clave || "---";
      const resultRango = document.getElementById("result-rango");
      if (resultRango) resultRango.textContent = periodo.descripcion || "---";
      if (periodo.fecha_inicio) {
        const displayInicio = document.getElementById("display-fecha-inicio");
        if (displayInicio)
          displayInicio.textContent = this._formatDateDisplay(
            periodo.fecha_inicio,
          );
      }
      if (periodo.fecha_fin) {
        const displayFin = document.getElementById("display-fecha-fin");
        if (displayFin)
          displayFin.textContent = this._formatDateDisplay(periodo.fecha_fin);
      }

      // Detectar plantilla desde clave existente
      if (periodo.clave) {
        if (periodo.clave.startsWith("FEB-JUL")) {
          const plantillaA = document.querySelector(
            'input[name="plantilla"][value="semestre-a"]',
          );
          if (plantillaA) plantillaA.checked = true;
          this.currentPlantilla = "semestre-a";
        } else if (periodo.clave.startsWith("AGO-ENE")) {
          const plantillaB = document.querySelector(
            'input[name="plantilla"][value="semestre-b"]',
          );
          if (plantillaB) plantillaB.checked = true;
          this.currentPlantilla = "semestre-b";
        } else {
          const plantillaPersonalizado = document.querySelector(
            'input[name="plantilla"][value="personalizado"]',
          );
          if (plantillaPersonalizado) plantillaPersonalizado.checked = true;
          this.currentPlantilla = "personalizado";
          this._activarModoPersonalizado();
          if (periodo.fecha_inicio) {
            const inputInicio = document.getElementById("periodo-fecha-inicio");
            if (inputInicio)
              inputInicio.value = periodo.fecha_inicio.split("T")[0];
          }
          if (periodo.fecha_fin) {
            const inputFin = document.getElementById("periodo-fecha-fin");
            if (inputFin) inputFin.value = periodo.fecha_fin.split("T")[0];
          }
        }
      }

      // 🔹 Evaluar vigencia para modo edición (async)
      setTimeout(() => actualizarUIVigencia(periodo), 100);
      this._actualizarEstado(
        "valid",
        "Editando periodo",
        "Modifica y guarda los cambios",
      );
    } else {
      // 5. MODO NUEVO: Generar fechas automáticamente
      setTimeout(() => {
        this._actualizarFechasDesdePlantilla();
        // 🔹 Evaluar vigencia después de generar fechas (async)
        setTimeout(() => actualizarUIVigencia(null), 150);
      }, 50);
    }

    // 🔹 Listeners para re-evaluar cuando cambian las fechas
    [
      "periodo-fecha-inicio",
      "periodo-fecha-fin",
      "periodo-fecha-inicio-hidden",
      "periodo-fecha-fin-hidden",
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        setTimeout(() => {
          const { inicio, fin } = obtenerFechas();
          const resultado = evaluarVigencia(inicio, fin);
          // Solo actualizar mensaje si el checkbox NO está marcado por el usuario
          if (chkVigencia && !chkVigencia.checked && msgVigencia) {
            msgVigencia.innerHTML = resultado.mensaje;
            msgVigencia.style.color = resultado.esAuto
              ? "var(--success-color)"
              : "var(--text-muted)";
          }
        }, 50);
      });
    });

    // Listener para cambio de plantilla (re-evaluar fechas automáticas)
    document.querySelectorAll('input[name="plantilla"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        setTimeout(() => {
          const { inicio, fin } = obtenerFechas();
          const resultado = evaluarVigencia(inicio, fin);
          if (chkVigencia && !chkVigencia.checked && msgVigencia) {
            msgVigencia.innerHTML = resultado.mensaje;
            msgVigencia.style.color = resultado.esAuto
              ? "var(--success-color)"
              : "var(--text-muted)";
          }
        }, 100);
      });
    });

    // Listener para cambio de año base
    document
      .getElementById("periodo-anio-base")
      ?.addEventListener("change", () => {
        setTimeout(() => {
          const { inicio, fin } = obtenerFechas();
          const resultado = evaluarVigencia(inicio, fin);
          if (chkVigencia && !chkVigencia.checked && msgVigencia) {
            msgVigencia.innerHTML = resultado.mensaje;
            msgVigencia.style.color = resultado.esAuto
              ? "var(--success-color)"
              : "var(--text-muted)";
          }
        }, 100);
      });

    // 6. Mostrar modal y enfocar primer campo
    modal.classList.remove("hidden");
    const primerCampo = document.getElementById("periodo-anio-base");
    if (primerCampo) primerCampo.focus();
  }

  // =========================================
  // GUARDAR PERIODO
  // =========================================
  async _savePeriodo(modal) {
    const datos = {
      id: document.getElementById("periodo-id")?.value
        ? parseInt(document.getElementById("periodo-id").value)
        : null,
      clave: document.getElementById("periodo-clave")?.value?.trim(),
      descripcion: document
        .getElementById("periodo-descripcion")
        ?.value?.trim(),
      fecha_inicio:
        document.getElementById("periodo-fecha-inicio-hidden")?.value ||
        document.getElementById("periodo-fecha-inicio")?.value ||
        null,
      fecha_fin:
        document.getElementById("periodo-fecha-fin-hidden")?.value ||
        document.getElementById("periodo-fecha-fin")?.value ||
        null,
      estado: document.getElementById("periodo-estado")?.value || "activo",

      es_vigente_forzado: document.getElementById("chk-vigencia-forzada")
        ?.checked
        ? 1
        : 0,
    };

    const hoy = new Date().toISOString().split("T")[0];
    const esAutoVigente =
      datos.fecha_inicio &&
      datos.fecha_fin &&
      datos.fecha_inicio <= hoy &&
      datos.fecha_fin >= hoy;
    if (esAutoVigente && datos.es_vigente_forzado === 1) {
      datos.es_vigente_forzado = 0;
    }

    if (!datos.clave || !datos.descripcion) {
      Toast.error("Clave y descripción son obligatorios", 5000);
      return;
    }
    if (datos.fecha_inicio && datos.fecha_fin) {
      if (!validarDuracionPeriodo(datos.fecha_inicio, datos.fecha_fin, 6)) {
        Toast.error("Los periodos no pueden exceder 6 meses de duración", 6000);
        return;
      }
      if (new Date(datos.fecha_fin) < new Date(datos.fecha_inicio)) {
        Toast.error(
          "La fecha de fin no puede ser anterior a la de inicio",
          6000,
        );
        return;
      }
    }

    const btnSave = document.getElementById("btn-guardar-periodo");
    const originalText = btnSave?.innerHTML || "";
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

    try {
      const res = await window.electronAPI.guardarPeriodo(datos);
      if (res.success) {
        const accion = datos.id ? "actualizado" : "registrado";
        Toast.success(
          `Periodo ${accion} correctamente: ${datos.descripcion}`,
          5000,
        );
        modal.classList.add("hidden");
        await this._loadData();
        this.table?.setData(this.data);
      } else {
        Toast.error(`Error: ${res.error}`, 6000);
      }
    } catch (error) {
      console.error("Error guardando periodo:", error);
      Toast.error("Error de conexión al guardar periodo", 6000);
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
      }
    }
  }

  // 🔹 MÉTODO: Activar/Desactivar/Cerrar Periodo
  async togglePeriodoStatus(rowId) {
    console.log("🔍 togglePeriodoStatus llamado con rowId:", rowId);

    // Búsqueda robusta: por id o clave
    const periodo = this.data.find(
      (p) =>
        String(p.id) === String(rowId) ||
        String(p.clave) === String(rowId) ||
        p.id == rowId ||
        p.clave == rowId,
    );

    if (!periodo) {
      console.error("❌ Periodo no encontrado para rowId:", rowId);
      Toast.error("No se encontró el periodo para realizar la acción", 5000);
      return;
    }

    console.log("✅ Periodo encontrado:", {
      id: periodo.id,
      clave: periodo.clave,
      descripcion: periodo.descripcion,
      estado: periodo.estado,
    });

    const estadoActual = periodo.estado;
    let nuevoEstado, accionInfinitivo, accionPasado, mensajeConfirmacion;

    // Lógica para 3 estados: activo ↔ inactivo ↔ cerrado
    if (estadoActual === "activo") {
      nuevoEstado = "inactivo";
      accionInfinitivo = "Desactivar";
      accionPasado = "desactivado";
      mensajeConfirmacion = `El periodo <strong>${periodo.descripcion}</strong> quedará inactivo: no podrá usarse para nuevas asignaciones, pero los registros existentes se preservarán.`;
    } else if (estadoActual === "inactivo") {
      nuevoEstado = "activo";
      accionInfinitivo = "Activar";
      accionPasado = "activado";
      mensajeConfirmacion = `El periodo <strong>${periodo.descripcion}</strong> volverá a estar disponible para asignaciones y emisión de constancias.`;
    } else if (estadoActual === "cerrado") {
      nuevoEstado = "activo";
      accionInfinitivo = "Reabrir";
      accionPasado = "reabierto";
      mensajeConfirmacion = `El periodo <strong>${periodo.descripcion}</strong> se reabrirá: podrá usarse nuevamente, pero verifica que no haya conflictos con periodos activos.`;
    } else {
      Toast.error("Estado no reconocido para toggle", 5000);
      return;
    }

    const nombrePeriodo =
      periodo.descripcion || periodo.clave || "este periodo";

    const confirmado = await globalConfirm.ask(
      `¿${accionInfinitivo} periodo?`,
      mensajeConfirmacion,
    );
    if (!confirmado) {
      console.log("⚠️ Usuario canceló la acción");
      return;
    }

    try {
      console.log("📡 Enviando actualización a backend:", {
        id: periodo.id,
        nuevoEstado,
      });
      const res = await window.electronAPI.actualizarEstadoPeriodo({
        id: periodo.id,
        nuevoEstado,
      });

      if (res.success) {
        Toast.success(
          `Periodo ${accionPasado} correctamente: ${nombrePeriodo}`,
          5000,
        );
        await this._loadData();
        this.table?.setData(this.data);
      } else {
        console.error("❌ Error del backend:", res.error);
        Toast.error(
          `Error: ${res.error || "No se pudo actualizar el estado"}`,
          6000,
        );
      }
    } catch (err) {
      console.error("💥 Error de conexión:", err);
      Toast.error("Error de conexión al actualizar estado", 6000);
    }
  }

  // ESTADO VACÍO
  _renderEmptyState() {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:50px;color:var(--text-muted)">
      <i class="fa-regular fa-calendar-days" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
      <p style="margin:0">No hay periodos registrados</p></td></tr>`;
  }

  // INTERACCIÓN DE FILAS (con bloqueo para inactivos/cerrados)
  handleRowClick(event) {
    const row = event.target.closest(".data-row");
    if (!row) return;
    // 🔹 Bloquear clics en filas que no estén 'activo'
    if (row.dataset.estado !== "activo") return;
    if (event.target.closest(".btn-action-menu")) return;

    document
      .querySelectorAll(".data-row.selected")
      .forEach((r) => r.classList.remove("selected"));
    row.classList.add("selected");
  }

  toggleActionMenu(event) {
    event.stopPropagation();
    document
      .querySelectorAll(".context-menu")
      .forEach((m) => m.classList.add("hidden"));
    const menu = event.target.closest(
      ".action-icon-container",
    )?.previousElementSibling;
    if (menu?.classList.contains("context-menu"))
      menu.classList.toggle("hidden");
  }

  // =========================================
  // ABRIR MODAL DE EDICIÓN (Reutiliza modal de creación)
  // =========================================
  async openEditModalFromMenu(rowId) {
    console.log("🔍 openEditModalFromMenu llamado con rowId:", rowId);

    // 1. Buscar el periodo en los datos locales
    const periodo = this.data.find(
      (p) =>
        String(p.id) === String(rowId) ||
        String(p.clave) === String(rowId) ||
        p.id == rowId ||
        p.clave == rowId,
    );

    if (!periodo) {
      console.error("❌ Periodo no encontrado para editar:", rowId);
      Toast.error("No se encontró el periodo para editar", 5000);
      return;
    }

    console.log("✅ Periodo encontrado para editar:", periodo);

    // 2. Asegurar que el modal esté inyectado
    if (!this.modalElement) {
      this._injectModal();
    }

    const modal = this.modalElement;
    const form = document.getElementById("form-periodo");
    const modalTitle = modal?.querySelector(".modal-header h3");

    if (!form) {
      console.error("❌ Formulario no encontrado");
      return;
    }

    // 3. Cambiar título del modal a "Editar Periodo"
    if (modalTitle) {
      modalTitle.textContent = "Editar Periodo";
    }

    // 4. Resetear formulario y campos ocultos
    form.reset();
    [
      "periodo-id",
      "periodo-clave",
      "periodo-descripcion",
      "periodo-estado",
      "periodo-fecha-inicio-hidden",
      "periodo-fecha-fin-hidden",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    // 5. Ocultar fechas personalizadas e inicializar selector de años
    this._ocultarFechasPersonalizadas();
    this._initAnioSelector();

    // 6. Cargar datos del periodo en el formulario
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };

    // Campos básicos
    setVal("periodo-id", periodo.id);
    setVal("periodo-clave", periodo.clave);
    setVal("periodo-descripcion", periodo.descripcion);
    setVal("periodo-estado", periodo.estado || "activo");

    // Fechas (formato YYYY-MM-DD para inputs type="date")
    if (periodo.fecha_inicio) {
      const fechaInicio = periodo.fecha_inicio.split("T")[0];
      setVal("periodo-fecha-inicio-hidden", fechaInicio);
      // Si está en modo personalizado, cargar también en el input visible
      const inputInicio = document.getElementById("periodo-fecha-inicio");
      if (inputInicio) inputInicio.value = fechaInicio;
    }
    if (periodo.fecha_fin) {
      const fechaFin = periodo.fecha_fin.split("T")[0];
      setVal("periodo-fecha-fin-hidden", fechaFin);
      const inputFin = document.getElementById("periodo-fecha-fin");
      if (inputFin) inputFin.value = fechaFin;
    }

    // Actualizar displays visuales
    const displayClave = document.getElementById("display-clave");
    const displayInicio = document.getElementById("display-fecha-inicio");
    const displayFin = document.getElementById("display-fecha-fin");
    const resultRango = document.getElementById("result-rango");

    if (displayClave) displayClave.textContent = periodo.clave || "---";
    if (displayInicio && periodo.fecha_inicio) {
      displayInicio.textContent = this._formatDateDisplay(periodo.fecha_inicio);
    }
    if (displayFin && periodo.fecha_fin) {
      displayFin.textContent = this._formatDateDisplay(periodo.fecha_fin);
    }
    if (resultRango) resultRango.textContent = periodo.descripcion || "---";

    // 7. Detectar y seleccionar la plantilla correcta según la clave
    // Dentro de openEditModalFromMenu(), en la sección de detectar plantilla:

    if (periodo.clave) {
      if (periodo.clave.startsWith("FEB-JUL")) {
        const plantillaA = document.querySelector(
          'input[name="plantilla"][value="semestre-a"]',
        );
        if (plantillaA) plantillaA.checked = true;
      } else if (periodo.clave.startsWith("AGO-ENE")) {
        const plantillaB = document.querySelector(
          'input[name="plantilla"][value="semestre-b"]',
        );
        if (plantillaB) plantillaB.checked = true;
      } else {
        // 🔹 Clave personalizada → activar modo personalizado
        const plantillaPersonalizado = document.querySelector(
          'input[name="plantilla"][value="personalizado"]',
        );
        if (plantillaPersonalizado) plantillaPersonalizado.checked = true;
        this._activarModoPersonalizado(); // ← Esto faltaba

        // Cargar fechas en inputs visibles si están en modo personalizado
        if (periodo.fecha_inicio) {
          const inputInicio = document.getElementById("periodo-fecha-inicio");
          if (inputInicio)
            inputInicio.value = periodo.fecha_inicio.split("T")[0];
        }
        if (periodo.fecha_fin) {
          const inputFin = document.getElementById("periodo-fecha-fin");
          if (inputFin) inputFin.value = periodo.fecha_fin.split("T")[0];
        }
      }
    }

    // 8. Configurar checkbox de vigencia forzada
    const chkVigencia = document.getElementById("chk-vigencia-forzada");
    const msgVigencia = document.getElementById("vigencia-status-msg");
    if (chkVigencia) {
      chkVigencia.checked = periodo.es_vigente_forzado === 1;
      if (periodo.es_vigente_forzado === 1 && msgVigencia) {
        msgVigencia.innerHTML = "⚠️ Vigencia forzada manualmente";
        msgVigencia.style.color = "var(--warning-color)";
      }
    }

    // 9. Inicializar Tooltip para el botón de info (si no existe)
    const btnInfoVigencia = document.getElementById("btn-info-vigencia");
    if (btnInfoVigencia && !btnInfoVigencia._tooltipInitialized) {
      new Tooltip({
        target: btnInfoVigencia,
        position: "top",
        delay: 200,
        content: `
        <strong>Forzar vigencia manual</strong>
        <p style="margin: 8px 0;">Úsalo solo si:</p>
        <ul style="margin: 0 0 12px 0; padding-left: 20px;">
          <li>Las fechas no coinciden con el calendario real</li>
          <li>Hay una extensión académica</li>
          <li>El reloj del servidor está desincronizado</li>
        </ul>
        <div class="tooltip-warning">
          ⚠️ Solo UN periodo puede tener esta opción activa.
        </div>
      `,
      });
      btnInfoVigencia._tooltipInitialized = true; // Flag para no crear duplicados
    }

    // 10. Actualizar estado del panel
    this._actualizarEstado(
      "valid",
      "Editando periodo",
      "Modifica y guarda los cambios",
    );

    // 11. Mostrar modal y enfocar primer campo
    modal.classList.remove("hidden");
    setTimeout(() => {
      const primerCampo = document.getElementById("periodo-anio-base");
      if (primerCampo) primerCampo.focus();
    }, 100);

    console.log("✅ Modal de edición abierto para periodo:", periodo.clave);
  }

  // CLEANUP
  destroy() {
    this.modalElement = null;
    this.table = null;
    console.log("🧹 [PeriodoModule] Recursos liberados");
  }
}
