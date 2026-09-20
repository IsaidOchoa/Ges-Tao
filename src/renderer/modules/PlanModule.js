// src/renderer/modules/PlanModule.js
import { DataTable } from "../components/DataTable/DataTable.js";
import modalPlanHtml from "../views/partials/modals/modal-plan.html";
import { FormAutosave } from "../utils/formAutosave.js";
import { UnsavedChangesGuard } from "../utils/unsavedChanges.js";
import { globalConfirm } from "../utils/confirmationModal.js";
import { Toast } from "../components/common/Toast.js";

export class PlanModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this._modalInjected = false;
    this._cleanup = [];
  }

  _on(el, event, fn) {
    if (!el) return;
    el.addEventListener(event, fn);
    this._cleanup.push(() => el.removeEventListener(event, fn));
  }

  async init() {
    if (this.initialized) {
      this._cleanup.forEach((fn) => fn());
      this._cleanup = [];
    }
    this._injectModal();
    await this._waitForDOM("tabla-planes-body");
    if (!this.data?.length) await this._loadData();
    this._renderTable();
    this._setupTableEvents();
    this._setupSearch();
    this._setupModalEvents();
    window.planModuleInstance = this;
    this.initialized = true;
  }

  _injectModal() {
    if (this._modalInjected || document.getElementById("modal-plan")) {
      this.modalElement = document.getElementById("modal-plan");
      this._modalInjected = true;
      return;
    }
    const template = document.createElement("div");
    template.innerHTML = modalPlanHtml;
    document.body.appendChild(template.firstElementChild);
    this.modalElement = document.getElementById("modal-plan");
    this._modalInjected = true;
  }

  async _waitForDOM(elementId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(elementId)) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }

  async _loadData() {
    try {
      const res = await window.electronAPI.listarPlanes();
      if (res.success) {
        this.data = res.rows || res.data || [];
        return true;
      }
      console.warn("⚠️ [PlanModule] Error IPC:", res.error);
      return false;
    } catch (error) {
      console.error("❌ [PlanModule] Error cargando datos:", error);
      return false;
    }
  }

  _renderTable() {
    const tbody = document.getElementById("tabla-planes-body");
    if (!tbody) return;

    if (!this.data?.length) {
      this.table = null;
      this._renderEmptyState();
      return;
    }

    if (!this.table) {
      this.table = new DataTable({
        tbodyId: "tabla-planes-body",
        columns: this._getColumns(),
        expandable: false, // ✅ catálogo de solo consumo, sin fila de relaciones
        actions: true,
      });
    }
    this.table.setData(this.data);
  }

  _getColumns() {
    return [
      {
        key: "clave",
        label: "Clave",
        format: (v) =>
          `<strong style="font-family:monospace">${v || "-"}</strong>`,
      },
      { key: "nombre", label: "Nombre" },
      { key: "nivel", label: "Nivel" },
      { key: "estado", label: "Estado", badge: true },
    ];
  }

  _setupTableEvents() {
    const tbody = document.getElementById("tabla-planes-body");
    this._on(tbody, "click", (e) => {
      const item = e.target.closest(".context-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      document
        .querySelectorAll(".context-menu")
        .forEach((m) => m.classList.add("hidden"));
      const { action, id } = item.dataset;
      if (action === "edit") this._openEditFromMenu(id);
      else if (action === "toggle") this._toggleEstado(id);
    });
  }

  _findPlan(rowId) {
    return this.data.find(
      (p) =>
        String(p.id) === String(rowId) || String(p.clave) === String(rowId),
    );
  }

  _openEditFromMenu(id) {
    const plan = this._findPlan(id);
    if (!plan) return Toast.error("Plan no encontrado", 4000);
    this._openModal(plan);
  }

  async _toggleEstado(id) {
    const plan = this._findPlan(id);
    if (!plan) return;
    const nuevo = plan.estado === "activo" ? "inactivo" : "activo";
    const ok = await globalConfirm.ask(
      `¿${nuevo === "activo" ? "Activar" : "Desactivar"} el plan "${plan.nombre}"?`,
    );
    if (!ok) return;

    if (typeof window.electronAPI.cambiarEstadoPlan !== "function") {
      return Toast.error(
        "API cambiarEstadoPlan no disponible en preload",
        6000,
      );
    }
    const res = await window.electronAPI.cambiarEstadoPlan(plan.id, nuevo);
    if (res?.success) {
      Toast.success(
        `Plan ${nuevo === "activo" ? "activado" : "desactivado"}`,
        4000,
      );
      await this._loadData();
      this._renderTable();
    } else {
      Toast.error(res?.error || "No se pudo cambiar el estado", 6000);
    }
  }

  _setupSearch() {
    const input = document.getElementById("buscador-planes");
    if (!input) return;
    this._on(input, "input", (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) return this.table?.setData(this.data);
      this.table?.setData(
        this.data.filter(
          (item) =>
            (item.nombre || "").toLowerCase().includes(txt) ||
            (item.clave || "").toLowerCase().includes(txt) ||
            (item.nivel || "").toLowerCase().includes(txt),
        ),
      );
    });
  }

  _setupModalEvents() {
    const btnNuevo = document.getElementById("btn-nuevo-plan");
    this._on(btnNuevo, "click", (e) => {
      e.preventDefault();
      this._openModal();
    });

    const intentarCerrar = async () => {
      if (this.unsavedGuard?.hasUnsavedChanges) {
        const confirmado = await globalConfirm.ask(
          "Tienes cambios sin guardar. ¿Deseas salir sin guardar?",
        );
        if (!confirmado) return;
      }
      this._ejecutarCierre();
    };

    this._on(
      this.modalElement?.querySelector(".btn-close"),
      "click",
      intentarCerrar,
    );
    this._on(
      document.getElementById("btn-cancelar-plan"),
      "click",
      intentarCerrar,
    );
    this._on(this.modalElement, "click", (e) => {
      if (e.target === this.modalElement) intentarCerrar();
    });

    const btnSave = document.getElementById("btn-guardar-plan");
    this._on(btnSave, "click", async (e) => {
      e.preventDefault();
      await this._savePlan();
    });
  }

  _ejecutarCierre() {
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    this.formAutosave?.clear();
    this.formAutosave = null;
    document.getElementById("form-plan")?.reset();
    this.modalElement?.classList.add("hidden");
  }

  _openModal(plan = null) {
    const modal = this.modalElement;
    const form = document.getElementById("form-plan");
    if (!modal || !form) return;

    this._editMode = Boolean(plan);
    form.reset();
    this.unsavedGuard = new UnsavedChangesGuard("#form-plan");
    this.formAutosave = new FormAutosave("form-plan", "plan-form");

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? "";
    };

    if (plan) {
      setVal("plan-id", plan.id);
      setVal("plan-clave", plan.clave);
      setVal("plan-nombre", plan.nombre);
      setVal("plan-nivel", plan.nivel);
      setVal("plan-estado", plan.estado || "activo");
      this.formAutosave?.clear();
    } else {
      setVal("plan-id", "");
      setVal("plan-clave", "");
      setVal("plan-estado", "activo");
    }

    modal.classList.remove("hidden");
    setTimeout(() => document.getElementById("plan-nombre")?.focus(), 100);
  }

  async _savePlan() {
    const getVal = (id) => document.getElementById(id)?.value?.trim();

    const datos = {
      id:
        this._editMode && getVal("plan-id")
          ? parseInt(getVal("plan-id"), 10)
          : null,
      clave: getVal("plan-clave") || null,
      nombre: getVal("plan-nombre"),
      nivel: document.getElementById("plan-nivel")?.value,
      estado: document.getElementById("plan-estado")?.value || "activo",
    };

    if (!datos.nombre || !datos.nivel) {
      Toast.warning("Campos obligatorios: Nombre y Nivel", 4000);
      return;
    }

    const btnSave = document.getElementById("btn-guardar-plan");
    const original = btnSave?.innerHTML || "";
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

    try {
      const res = await window.electronAPI.guardarPlan(datos);
      if (res?.success) {
        Toast.success(
          datos.id
            ? "Plan actualizado correctamente"
            : "Plan creado correctamente",
          4000,
        );
        this._ejecutarCierre();
        await this._loadData();
        this._renderTable(); // ✅ ahora sí refresca (crea la tabla si hacía falta)
      } else {
        Toast.error(res?.error || "No se pudo guardar el plan", 6000);
      }
    } catch (error) {
      console.error("💥 Error guardando plan:", error);
      Toast.error("Error de conexión con la base de datos", 6000);
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = original;
      }
    }
  }

  _renderEmptyState() {
    const tbody = document.getElementById("tabla-planes-body");
    if (!tbody) return;
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 40px; color:var(--text-muted)">
          <i class="fa-solid fa-graduation-cap" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
          <p style="margin:0">No hay planes de estudio registrados</p>
        </td>
      </tr>`;
  }

  destroy() {
    this._cleanup.forEach((fn) => fn());
    this._cleanup = [];
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    this.formAutosave?.clear();
    this.formAutosave = null;
    delete window.planModuleInstance;
    this.table = null;
    this.modalElement = null;
    this._modalInjected = false;
    this.initialized = false;
  }
}
