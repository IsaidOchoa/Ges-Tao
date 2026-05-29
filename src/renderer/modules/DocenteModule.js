// src/renderer/modules/DocenteModule.js
import { DataTable } from "../components/DataTable/DataTable.js";
import modalDocenteHtml from "../views/partials/modals/modal-docente.html";
import { FormAutosave } from "../utils/formAutosave.js";
import { UnsavedChangesGuard } from "../utils/unsavedChanges.js";
import { globalConfirm } from "../utils/confirmationModal.js";
import { Toast } from "../components/common/Toast.js";
import { Tooltip } from "../utils/toolTip.js"; // 🔹 Para tooltips reutilizables

export class DocenteModule {
  constructor() {
    // Estado interno
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this._modalInjected = false;
    
    // 🔹 CONFIGURACIÓN REUTILIZABLE (para estandarización)
    this.tbodyId = "tabla-docentes-body";
    this.instanceName = "docenteModuleInstance";
    this.expandable = true;
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
      console.error(`❌ [${this.constructor.name}] tbody "${this.tbodyId}" no encontrado`);
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
      onExpand: `${this.instanceName}.loadRowSummary(event)`,
      onExpandAction: `${this.instanceName}.openAssignmentModal(this)`,
      onEdit: `${this.instanceName}.openEditModalFromMenu`,  // 🔹 Callback para editar
      onToggleStatus: `${this.instanceName}.toggleDocenteStatus`,  // 🔹 Callback para toggle
    });

    // 6. Renderizar datos o estado vacío
    if (this.data?.length) {
      this.table.setData(this.data);
      console.log(`✅ [${this.constructor.name}] Tabla renderizada con ${this.data.length} registros`);
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
      document.querySelectorAll(".context-menu").forEach((m) => m.classList.add("hidden"));

      // Ejecutar acción según tipo
      if (action === "toggle" && typeof this.toggleDocenteStatus === "function") {
        this.toggleDocenteStatus(rowId);
      } else if (action === "edit" && typeof this.openEditModalFromMenu === "function") {
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
    if (this._modalInjected || document.getElementById("modal-docente")) {
      this.modalElement = document.getElementById("modal-docente");
      this._modalInjected = true;
      return;
    }
    const template = document.createElement("div");
    template.innerHTML = modalDocenteHtml;
    document.body.appendChild(template.firstElementChild);
    this.modalElement = document.getElementById("modal-docente");
    this._modalInjected = true;
    console.log("✅ [DocenteModule] Modal inyectado");
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
    console.error(`❌ [${this.constructor.name}] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarDocentes();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log("📄 [DocenteModule] Primer registro:", this.data[0]);
        }
        return true;
      }
      console.warn("⚠️ [DocenteModule] Error en respuesta IPC:", res.error);
      Toast.warning("No se pudieron cargar los docentes", 4000);
      return false;
    } catch (error) {
      console.error("❌ [DocenteModule] Error cargando datos:", error);
      Toast.error("Error de conexión al cargar docentes", 5000);
      return false;
    }
  }

  // =========================================
  // COLUMNAS DE TABLA
  // =========================================
  _getColumns() {
    return [
      { key: "codigo", label: "Código", format: (v) => `<strong>${v}</strong>` },
      { 
        key: "nombres", 
        label: "Nombre Completo",
        format: (v, row) => [row.apellido_paterno || "", row.apellido_materno || "", v || ""].filter((p) => p).join(" ")
      },
      { key: "correo_contacto", label: "Correo" },
      { key: "estado", label: "Estado", badge: true }
    ];
  }

  // =========================================
  // BUSCADOR
  // =========================================
  _setupSearch() {
    const input = document.getElementById("buscador-docentes");
    if (!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener("input", (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { this.table?.setData(this.data); return; }
      const filtered = this.data.filter((item) => {
        const nombreCompleto = [item.nombres || "", item.apellido_paterno || "", item.apellido_materno || ""].join(" ").toLowerCase();
        return nombreCompleto.includes(txt) || (item.codigo || "").toLowerCase().includes(txt) || (item.correo_contacto || "").toLowerCase().includes(txt);
      });
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById("btn-nuevo-docente");
    const modal = this.modalElement;
    if (!btnNuevo || !modal) { console.warn("⚠️ [DocenteModule] Elementos del modal no encontrados"); return; }
    
    btnNuevo.onclick = (e) => { e.preventDefault(); this._openModal(); };
    
    const intentarCerrar = async () => {
      if (this.unsavedGuard?.hasUnsavedChanges) {
        const confirmado = await globalConfirm.ask("Tienes cambios sin guardar. ¿Deseas salir sin guardar?");
        if (!confirmado) return;
      }
      this._ejecutarCierre();
    };
    
    this.modalElement?.querySelector(".btn-close")?.addEventListener("click", intentarCerrar);
    document.getElementById("btn-cancelar-docente")?.addEventListener("click", intentarCerrar);
    modal.addEventListener("click", (e) => { if (e.target === modal) { e.preventDefault(); intentarCerrar(); } });
    
    const btnSave = document.getElementById("btn-guardar-docente");
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener("click", async (e) => { e.preventDefault(); await this._saveDocente(modal); });
    }
  }

  // =========================================
  // CERRAR MODAL (con restauración de título)
  // =========================================
  _ejecutarCierre() {
    // 🔹 Restaurar título a "Nuevo Docente"
    const modalTitle = this.modalElement?.querySelector(".modal-header h3");
    if (modalTitle) modalTitle.textContent = "Nuevo Docente";
    
    this.unsavedGuard?.destroy(); this.unsavedGuard = null;
    this.formAutosave?.clear(); this.formAutosave = null;
    const form = document.getElementById("form-docente"); if (form) form.reset();
    if (this.modalElement) this.modalElement.classList.add("hidden");
  }

  // =========================================
  // ABRIR MODAL (Creación o Edición)
  // =========================================
  _openModal(doc = null) {
    const modal = this.modalElement;
    const form = document.getElementById("form-docente");
    if (!modal || !form) return;
    
    // 🔹 Restaurar título según modo
    const modalTitle = modal.querySelector(".modal-header h3");
    if (modalTitle) modalTitle.textContent = doc ? "Editar Docente" : "Nuevo Docente";
    
    // Resetear formulario
    form.reset();
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
    setVal("doc-id", "");
    
    // Inicializar protecciones
    this.unsavedGuard = new UnsavedChangesGuard("#form-docente");
    this.formAutosave = new FormAutosave("form-docente", "docente-form");
    
    if (doc) {
      // 🔹 MODO EDICIÓN: Cargar datos existentes
      setVal("doc-id", doc.id);
      setVal("doc-codigo", doc.codigo);
      setVal("doc-ap-paterno", doc.apellido_paterno);
      setVal("doc-ap-materno", doc.apellido_materno);
      setVal("doc-nombres", doc.nombres);
      setVal("doc-correo", doc.correo_contacto);
      setVal("doc-telefono", doc.telefono_contacto);
      setVal("doc-nivel", doc.nivel_academico || "base");
      setVal("doc-tratamiento", doc.tratamiento);
      setVal("doc-articulo", doc.articulo || "El");
      setVal("doc-estado", doc.estado || "activo");
      
      // 🔹 Disparar cambio en tratamiento para actualizar artículo automáticamente
      const tratamientoEl = document.getElementById("doc-tratamiento");
      if (tratamientoEl) tratamientoEl.dispatchEvent(new Event("change"));
      
      this.formAutosave?.clear();
    } else {
      // 🔹 MODO NUEVO: Verificar autosave
      const hasAutosave = localStorage.getItem("autosave:docente-form");
      if (!hasAutosave) form.reset();
    }
    
    modal.classList.remove("hidden");
    setTimeout(() => document.getElementById("doc-codigo")?.focus(), 100);
  }

  // =========================================
  // 🔹 ABRIR MODAL DE EDICIÓN DESDE MENÚ CONTEXTUAL
  // =========================================
  async openEditModalFromMenu(rowId) {
    console.log("🔍 openEditModalFromMenu llamado con rowId:", rowId);
    
    // 1. Buscar el docente en los datos locales
    const docente = this.data.find(d => 
      String(d.id) === String(rowId) || 
      String(d.codigo) === String(rowId) ||
      d.id == rowId || 
      d.codigo == rowId
    );
    
    if (!docente) {
      console.error("❌ Docente no encontrado para editar:", rowId);
      Toast.error("No se encontró el docente para editar", 5000);
      return;
    }
    
    console.log("✅ Docente encontrado para editar:", docente);
    
    // 2. Asegurar que el modal esté inyectado
    if (!this.modalElement) this._injectModal();
    
    // 3. Abrir modal en modo edición (reutiliza _openModal)
    this._openModal(docente);
    
    console.log("✅ Modal de edición abierto para docente:", docente.codigo);
  }

  // =========================================
  // 🔹 MÉTODO: Activar/Desactivar Docente
  // =========================================
  async toggleDocenteStatus(rowId) {
    console.log("🔍 toggleDocenteStatus llamado con rowId:", rowId);
    
    // Búsqueda robusta
    const docente = this.data.find(d => 
      String(d.id) === String(rowId) || 
      String(d.codigo) === String(rowId) ||
      d.id == rowId || 
      d.codigo == rowId
    );
    
    if (!docente) {
      console.error("❌ Docente no encontrado para rowId:", rowId);
      Toast.error("No se encontró el docente para realizar la acción", 5000);
      return;
    }
    
    console.log("✅ Docente encontrado:", { id: docente.id, codigo: docente.codigo, nombres: docente.nombres, estado: docente.estado });

    const nuevoEstado = docente.estado === "activo" ? "inactivo" : "activo";
    const accionInfinitivo = nuevoEstado === "activo" ? "Activar" : "Desactivar";
    const accionPasado = nuevoEstado === "activo" ? "activado" : "desactivado";
    
    // Construir nombre completo
    const nombreCompleto = [docente.nombres, docente.apellido_paterno, docente.apellido_materno].filter(p => p && p.trim()).join(" ").trim() || docente.codigo;

    // Mensaje explicativo detallado
    const mensajeConfirmacion = nuevoEstado === "inactivo" 
      ? `El docente <strong>${nombreCompleto}</strong> quedará oculto en listas, búsquedas y no podrá ser seleccionado para emitir constancias o asignaciones.`
      : `El docente <strong>${nombreCompleto}</strong> volverá a estar disponible en listas, búsquedas y podrá ser seleccionado normalmente.`;

    // Confirmación con título en infinitivo y mensaje detallado
    const confirmado = await globalConfirm.ask(`¿${accionInfinitivo} docente?`, mensajeConfirmacion);
    if (!confirmado) { console.log("⚠️ Usuario canceló la acción"); return; }

    try {
      console.log("📡 Enviando actualización a backend:", { id: docente.id, nuevoEstado });
      const res = await window.electronAPI.actualizarEstadoDocente({ id: docente.id, nuevoEstado });
      
      if (res.success) {
        Toast.success(`Docente ${accionPasado} correctamente: ${nombreCompleto}`, 5000);
        await this._loadData(); this.table?.setData(this.data);
      } else {
        console.error("❌ Error del backend:", res.error);
        Toast.error(`Error: ${res.error || "No se pudo actualizar el estado"}`, 6000);
      }
    } catch (err) {
      console.error("💥 Error de conexión:", err);
      Toast.error("Error de conexión al actualizar estado", 6000);
    }
  }

  // =========================================
  // GUARDAR DOCENTE
  // =========================================
  async _saveDocente(modal) {
    const tratamientoEl = document.getElementById("doc-tratamiento");
    const tratamiento = tratamientoEl?.value?.trim();
    if (!tratamiento) { Toast.warning("Selecciona un tratamiento (Dr./Dra./etc.)", 4000); tratamientoEl?.focus(); return; }

    const tratamientosFemeninos = ["Dra.", "Mtra."];
    const esFemenino = tratamiento.endsWith("a.") || tratamientosFemeninos.includes(tratamiento);
    const articulo = esFemenino ? "La" : "El";

    const datos = {
      id: document.getElementById("doc-id")?.value || null,
      codigo: document.getElementById("doc-codigo")?.value?.trim(),
      apellido_paterno: document.getElementById("doc-ap-paterno")?.value?.trim(),
      apellido_materno: document.getElementById("doc-ap-materno")?.value?.trim(),
      nombres: document.getElementById("doc-nombres")?.value?.trim(),
      correo_contacto: document.getElementById("doc-correo")?.value?.trim(),
      telefono_contacto: document.getElementById("doc-telefono")?.value?.trim(),
      nivel_academico: document.getElementById("doc-nivel")?.value || "base",
      tratamiento,
      articulo,
      estado: "activo"
    };

    if (!datos.codigo || !datos.apellido_paterno || !datos.nombres) {
      Toast.error("Campos obligatorios: Código, Apellido Paterno y Nombres", 6000); return;
    }

    const btnSave = document.getElementById("btn-guardar-docente");
    const originalText = btnSave?.innerHTML || "";
    if (btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; }

    try {
      const res = await window.electronAPI.guardarDocente(datos);
      if (res.success) {
        const accion = datos.id ? "actualizado" : "registrado";
        Toast.success(`Docente ${accion} correctamente: ${datos.nombres} ${datos.apellido_paterno}`, 5000);
        this._ejecutarCierre(); await this._loadData(); this.table?.setData(this.data);
      } else { Toast.error(`Error: ${res.error || "No se pudo guardar el docente"}`, 7000); }
    } catch (error) {
      console.error("💥 Error guardando docente:", error);
      Toast.error("Error de conexión: no se pudo comunicar con el servidor", 6000);
    } finally {
      if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = originalText; }
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  _renderEmptyState() {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:50px;color:var(--text-muted)">
      <i class="fa-solid fa-chalkboard-user" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
      <p style="margin:0">No hay docentes registrados</p></td></tr>`;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() { window.docenteModuleInstance = this; }

  // =========================================
  // INTERACCIÓN DE FILAS
  // =========================================
  handleRowClick(event) {
    const row = event.target.closest(".data-row");
    if (!row || row.dataset.estado === "inactivo") return;
    if (event.target.closest(".btn-action-menu") || event.target.closest(".context-menu")) return;
    
    row.classList.toggle("expanded");
    const detailsRow = row.nextElementSibling;
    if (detailsRow?.classList.contains("sub-row-details")) {
      detailsRow.classList.toggle("hidden");
      if (!detailsRow.classList.contains("hidden")) { this.loadRowSummary(event); }
    }
    document.querySelectorAll(".data-row.selected").forEach(r => r.classList.remove("selected"));
    row.classList.add("selected");
  }

  loadRowSummary(event) {
    const row = event.target?.closest(".data-row");
    if (!row) return;
    const detailsRow = row.nextElementSibling;
    if (!detailsRow?.classList.contains("sub-row-details")) return;
    const chips = detailsRow.querySelector(".summary-chips");
    if (!chips) return;
    chips.innerHTML = '<span class="chip">⏳ Cargando...</span>';
    try {
      setTimeout(() => {
        chips.innerHTML = `<span class="chip accent">📚 3 EE</span><span class="chip">👥 12 Alumnos</span><span class="chip">📅 2024-A</span>`;
      }, 300);
    } catch (error) {
      chips.innerHTML = '<span class="chip" style="color:var(--danger-color)">Error</span>';
    }
  }

  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll(".context-menu").forEach(m => m.classList.add("hidden"));
    const menu = event.target.closest(".action-icon-container")?.previousElementSibling;
    if (menu?.classList.contains("context-menu")) menu.classList.toggle("hidden");
  }

  openAssignmentModal(buttonEl) {
    const row = buttonEl?.closest(".sub-row-details")?.previousElementSibling || buttonEl?.closest(".data-row");
    if (!row?.classList.contains("data-row")) return;
    
    const identificador = row.dataset.id?.trim();
    if (!identificador || !this.data?.length) return;
    
    const docente = this.data.find(d => d.codigo === identificador);
    if (!docente) { console.error(`❌ Docente no encontrado: ${identificador}`); Toast.error("No se encontró el docente seleccionado", 4000); return; }
    
    const nombreCompleto = [docente.nombres?.trim(), docente.apellido_paterno?.trim(), docente.apellido_materno?.trim()].filter(p => p && p.length > 0).join(" ");
    
    window.assignmentModal.open({
      entityType: "docente", entityId: docente.id, entityName: nombreCompleto, codigo: docente.codigo
    });
    console.log(`✅ [DocenteModule] Modal abierto para: ${nombreCompleto}`);
  }

  // =========================================
  // ACTUALIZAR ARTÍCULO SEGÚN TRATAMIENTO
  // =========================================
  actualizarArticuloTratamiento() {
    const tratamiento = document.getElementById("doc-tratamiento")?.value;
    const articuloInput = document.getElementById("doc-articulo");
    if (!tratamiento || !articuloInput) return;
    const tratamientosFemeninos = ["Dra.", "Mtra."];
    const esFemenino = tratamiento.endsWith("a.") || tratamientosFemeninos.includes(tratamiento);
    articuloInput.value = esFemenino ? "La" : "El";
  }

  // =========================================
  // CLEANUP
  // =========================================
  destroy() {
    this.unsavedGuard?.destroy(); this.unsavedGuard = null;
    this.formAutosave?.clear(); this.formAutosave = null;
    this.modalElement = null; this._modalInjected = false; this.table = null;
    console.log("🧹 [DocenteModule] Recursos liberados");
  }
}