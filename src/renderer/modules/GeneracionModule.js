// src/renderer/modules/GeneracionModule.js
import { DataTable } from "../components/DataTable/DataTable.js";
import modalGeneracionHtml from "../views/partials/modals/modal-generacion.html";
import { FormAutosave } from "../utils/formAutosave.js";
import { UnsavedChangesGuard } from "../utils/unsavedChanges.js";
import { globalConfirm } from "../utils/confirmationModal.js";
import { Toast } from "../components/common/Toast.js";

export class GeneracionModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this.cachedSelectData = null;
    this._modalInjected = false;
    this._cleanup = [];
    this._editMode = false;
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
    await this._waitForDOM("tabla-generaciones-body");
    if (!this.cachedSelectData) await this._loadSelectData();
    if (!this.data || this.data.length === 0) await this._loadData();
    this._renderTable();
    this._setupTableEvents();
    this._setupSearch();
    this._setupModalEvents();
    window.generacionModuleInstance = this;
    this.initialized = true;
  }

  _injectModal() {
    if (this._modalInjected || document.getElementById("modal-generacion")) {
      this.modalElement = document.getElementById("modal-generacion");
      this._modalInjected = true;
      return;
    }
    const template = document.createElement("div");
    template.innerHTML = modalGeneracionHtml;
    document.body.appendChild(template.firstElementChild);
    this.modalElement = document.getElementById("modal-generacion");
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
      const res = await window.electronAPI.listarGeneraciones();
      if (res.success) {
        this.data = res.rows || res.data || [];
        return true;
      }
      console.warn("[GeneracionModule] Error IPC:", res.error);
      return false;
    } catch (error) {
      console.error("[GeneracionModule] Error cargando datos:", error);
      return false;
    }
  }

  async _loadSelectData() {
    try {
      const res = await window.electronAPI.obtenerDatosSelectsGeneracion();
      if (res && res.success) {
        this.cachedSelectData = res.data;
        return true;
      }
      const planos = await window.electronAPI.listarPlanes();
      const periodos = await window.electronAPI.listarPeriodos();
      this.cachedSelectData = {
        planes: planos && planos.success ? planos.rows || planos.data : [],
        periodos:
          periodos && periodos.success ? periodos.rows || periodos.data : [],
      };
      return true;
    } catch (error) {
      console.warn("[GeneracionModule] Sin datos para selects:", error);
      this.cachedSelectData = { planes: [], periodos: [] };
      return false;
    }
  }

  _renderTable() {
    const tbody = document.getElementById("tabla-generaciones-body");
    if (!tbody) return;

    if (!this.data || this.data.length === 0) {
      this.table = null;
      this._renderEmptyState();
      return;
    }

    if (!this.table) {
      this.table = new DataTable({
        tbodyId: "tabla-generaciones-body",
        columns: this._getColumns(),
        expandable: true,
        actions: true,
        onExpand: "generacionModuleInstance.loadRowSummary(event)",
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
          '<strong style="font-family:monospace">' + (v || "-") + "</strong>",
      },
      { key: "nombre", label: "Nombre" },
      { key: "plan_nombre", label: "Plan" },
      { key: "periodo_desc", label: "Ingreso" },
      { key: "estado", label: "Estado", badge: true },
    ];
  }

  loadRowSummary(event) {
    const row = event.target ? event.target.closest(".data-row") : null;
    if (!row) return;
    const detailsRow = row.nextElementSibling;
    if (!detailsRow || !detailsRow.classList.contains("sub-row-details"))
      return;
    const chips = detailsRow.querySelector(".summary-chips");
    if (!chips) return;
    const gen = this.data.find((g) => String(g.id) === String(row.dataset.id));
    if (!gen) {
      chips.innerHTML = '<span class="chip">Sin datos</span>';
      return;
    }
    chips.innerHTML =
      '<span class="chip accent">Plan: ' +
      (gen.plan_nombre || "Sin plan") +
      "</span>" +
      '<span class="chip">Ingreso: ' +
      (gen.periodo_desc || "Sin periodo") +
      "</span>" +
      '<span class="chip">Clave: ' +
      (gen.clave || "-") +
      "</span>";
  }

  handleRowClick(event) {
    const row = event.target.closest(".data-row");
    if (!row) return;
    if (
      event.target.closest(".btn-action-menu") ||
      event.target.closest(".context-menu")
    )
      return;
    row.classList.toggle("expanded");
    const detailsRow = row.nextElementSibling;
    if (detailsRow && detailsRow.classList.contains("sub-row-details")) {
      detailsRow.classList.toggle("hidden");
      if (!detailsRow.classList.contains("hidden")) this.loadRowSummary(event);
    }
    document
      .querySelectorAll(".data-row.selected")
      .forEach((r) => r.classList.remove("selected"));
    row.classList.add("selected");
  }

  _setupTableEvents() {
    const tbody = document.getElementById("tabla-generaciones-body");
    this._on(tbody, "click", (e) => {
      const item = e.target.closest(".context-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      document
        .querySelectorAll(".context-menu")
        .forEach((m) => m.classList.add("hidden"));
      const action = item.dataset.action;
      const id = item.dataset.id;

      console.log("[GeneracionModule] Click en menú contextual:", {
        action,
        id,
      });
      console.log(
        "[GeneracionModule] Datos disponibles:",
        this.data.map((g) => ({ id: g.id, nombre: g.nombre })),
      );

      if (action === "edit") this._openEditFromMenu(id);
      if (action === "toggle") this._toggleEstado(id);
    });
  }

  _findGeneracion(rowId) {
    return this.data.find(
      (g) =>
        String(g.id) === String(rowId) ||
        String(g.clave) === String(rowId) ||
        g.id == rowId ||
        g.clave == rowId,
    );
  }

  _openEditFromMenu(id) {
    const gen = this._findGeneracion(id);
    if (!gen) {
      Toast.error("Generación no encontrada", 4000);
      return;
    }
    this._openModal(gen);
  }

  async _toggleEstado(id) {
    const gen = this._findGeneracion(id);
    if (!gen) return;
    const nuevo = gen.estado === "activa" ? "inactiva" : "activa";
    const pregunta =
      nuevo === "activa"
        ? "¿Activar la generación " + gen.nombre + "?"
        : "¿Desactivar la generación " + gen.nombre + "?";
    const ok = await globalConfirm.ask(pregunta);
    if (!ok) return;
    const res = await window.electronAPI.cambiarEstadoGeneracion({
      id: gen.id,
      nuevoEstado: nuevo,
    });
    if (res && res.success) {
      Toast.success(
        "Generación " + (nuevo === "activa" ? "activada" : "desactivada"),
        4000,
      );
      await this._loadData();
      this._renderTable();
    } else {
      Toast.error((res && res.error) || "No se pudo cambiar el estado", 6000);
    }
  }

  _setupSearch() {
    const input = document.getElementById("buscador-generaciones");
    this._on(input, "input", (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) {
        if (this.table) this.table.setData(this.data);
        return;
      }
      const filtered = this.data.filter((item) => {
        const nombre = (item.nombre || "").toLowerCase();
        const clave = (item.clave || "").toLowerCase();
        const plan = (item.plan_nombre || "").toLowerCase();
        return (
          nombre.includes(txt) || clave.includes(txt) || plan.includes(txt)
        );
      });
      if (this.table) this.table.setData(filtered);
    });
  }

  _setupModalEvents() {
    const btnNuevo = document.getElementById("btn-nueva-generacion");
    this._on(btnNuevo, "click", (e) => {
      e.preventDefault();
      this._openModal();
    });

    const intentarCerrar = async () => {
      if (this.unsavedGuard && this.unsavedGuard.hasUnsavedChanges) {
        const confirmado = await globalConfirm.ask(
          "Tienes cambios sin guardar. ¿Deseas salir sin guardar?",
        );
        if (!confirmado) return;
      }
      this._ejecutarCierre();
    };

    const btnClose = this.modalElement
      ? this.modalElement.querySelector(".btn-close")
      : null;
    this._on(btnClose, "click", intentarCerrar);
    this._on(
      document.getElementById("btn-cancelar-generacion"),
      "click",
      intentarCerrar,
    );
    this._on(this.modalElement, "click", (e) => {
      if (e.target === this.modalElement) intentarCerrar();
    });

    const btnSave = document.getElementById("btn-guardar-generacion");
    this._on(btnSave, "click", async (e) => {
      e.preventDefault();
      await this._saveGeneracion();
    });
  }

  _ejecutarCierre() {
    if (this.unsavedGuard) this.unsavedGuard.destroy();
    this.unsavedGuard = null;
    if (this.formAutosave) this.formAutosave.clear();
    this.formAutosave = null;
    const form = document.getElementById("form-generacion");
    if (form) form.reset();
    if (this.modalElement) this.modalElement.classList.add("hidden");
  }

  _openModal(gen) {
    const modal = this.modalElement;
    const form = document.getElementById("form-generacion");
    if (!modal || !form) return;

    this._editMode = Boolean(gen);
    form.reset();
    this.unsavedGuard = new UnsavedChangesGuard("#form-generacion");
    this.formAutosave = new FormAutosave("form-generacion", "generacion-form");
    this._populateSelects();

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val == null ? "" : val;
    };

    if (gen) {
      setVal("generacion-id", gen.id);
      setVal("generacion-clave", gen.clave);
      setVal("generacion-nombre", gen.nombre);
      setVal("generacion-plan", gen.plan_id);
      setVal("generacion-periodo", gen.periodo_ingreso_id);
      setVal("generacion-estado", gen.estado || "activa");
      if (this.formAutosave) this.formAutosave.clear();
    } else {
      setVal("generacion-id", "");
      setVal("generacion-clave", "");
      setVal("generacion-estado", "activa");
    }

    modal.classList.remove("hidden");
    setTimeout(() => {
      const el = document.getElementById("generacion-nombre");
      if (el) el.focus();
    }, 100);
  }

  _populateSelects() {
    if (!this.cachedSelectData) return;

    const planSel = document.getElementById("generacion-plan");
    if (planSel && this.cachedSelectData.planes) {
      const cur = planSel.value;
      let html = '<option value="">Seleccionar...</option>';
      this.cachedSelectData.planes.forEach((p) => {
        html += '<option value="' + p.id + '">' + p.nombre + "</option>";
      });
      planSel.innerHTML = html;
      if (cur) planSel.value = cur;
    }

    const perSel = document.getElementById("generacion-periodo");
    if (perSel && this.cachedSelectData.periodos) {
      const cur = perSel.value;
      let html = '<option value="">Seleccionar...</option>';
      this.cachedSelectData.periodos.forEach((p) => {
        html +=
          '<option value="' +
          p.id +
          '">' +
          p.clave +
          " - " +
          p.descripcion +
          "</option>";
      });
      perSel.innerHTML = html;
      if (cur) perSel.value = cur;
    }
  }

  async _saveGeneracion() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el && el.value ? el.value.trim() : "";
    };

    const nombre = getVal("generacion-nombre");
    const plan = getVal("generacion-plan");
    const periodo = getVal("generacion-periodo");

    if (!nombre || !plan) {
      Toast.warning("Campos obligatorios: Nombre y Plan de Estudio", 4000);
      return;
    }

    const datos = {
      id:
        this._editMode && getVal("generacion-id")
          ? parseInt(getVal("generacion-id"), 10)
          : null,
      clave: getVal("generacion-clave") || null,
      nombre: nombre,
      plan_id: parseInt(plan, 10),
      periodo_ingreso_id: periodo ? parseInt(periodo, 10) : null,
      estado:
        (document.getElementById("generacion-estado") || {}).value || "activa",
    };

    const btnSave = document.getElementById("btn-guardar-generacion");
    const original = btnSave ? btnSave.innerHTML : "";
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

    try {
      const res = await window.electronAPI.guardarGeneracion(datos);
      if (res && res.success) {
        Toast.success(
          datos.id
            ? "Generación actualizada correctamente"
            : "Generación creada correctamente",
          4000,
        );
        this._ejecutarCierre();
        await this._loadData();
        this._renderTable();
      } else {
        Toast.error(
          (res && res.error) || "No se pudo guardar la generación",
          6000,
        );
      }
    } catch (error) {
      console.error("Error guardando generación:", error);
      Toast.error("Error de conexión con la base de datos", 6000);
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = original;
      }
    }
  }

  _renderEmptyState() {
    const tbody = document.getElementById("tabla-generaciones-body");
    if (!tbody) return;
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:50px 20px; color:var(--text-muted);">' +
      '<i class="fa-solid fa-users" style="font-size:2.5rem; margin:0 auto 15px auto; display:block; opacity:0.6;"></i>' +
      '<p style="margin:0; font-size:1rem;">No hay generaciones registradas</p>' +
      "</td></tr>";
  }

  destroy() {
    this._cleanup.forEach((fn) => fn());
    this._cleanup = [];
    if (this.unsavedGuard) this.unsavedGuard.destroy();
    this.unsavedGuard = null;
    if (this.formAutosave) this.formAutosave.clear();
    this.formAutosave = null;
    delete window.generacionModuleInstance;
    this.table = null;
    this.modalElement = null;
    this._modalInjected = false;
    this.cachedSelectData = null;
    this.initialized = false;
  }
}
