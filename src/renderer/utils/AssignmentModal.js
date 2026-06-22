// src/renderer/utils/AssignmentModal.js
import { uiLoader } from "./uiLoader";
import { Toast } from "../components/common/Toast.js";
import { globalConfirm } from "./confirmationModal.js";
import modalAsignacionesHtml from "../config/relationships/templates/modal-asignaciones.html";

import { StateManager } from './assignment-modal/StateManager.js';
import { SidebarManager } from './assignment-modal/SidebarManager.js';
import { WorkspaceManager } from './assignment-modal/workspace/WorkspaceManager.js';
import { EEListRenderer } from './assignment-modal/relations/ee/EEListRenderer.js';
import { TutoradoListRenderer } from './assignment-modal/relations/tutorados/TutoradoListRenderer.js';
import { DOMHelpers } from './assignment-modal/utils/DOMHelpers.js';

export class AssignmentModal {
  constructor() {
    this.modal = null;
    this.elements = {};
    this._state = {
      context: null,
      activePeriod: null,
      activeTab: "gestionar",
      isLoading: false,
    };
    this.stateManager = new StateManager();
    this.sidebarManager = new SidebarManager({ 
      api: window.electronAPI, 
      stateManager: this.stateManager 
    });
    this.workspaceManager = new WorkspaceManager({ 
      api: window.electronAPI, 
      stateManager: this.stateManager,
      toast: Toast,
      confirm: globalConfirm,
      uiLoader: uiLoader
    });
    this.eeRenderer = new EEListRenderer({ 
      api: window.electronAPI, 
      toast: Toast, 
      confirm: globalConfirm,
      modalInstance: this
    });
    this.tutoradoRenderer = new TutoradoListRenderer({ 
      api: window.electronAPI, 
      toast: Toast, 
      confirm: globalConfirm,
      modalInstance: this
    });
    this.helpers = new DOMHelpers();
    this._registeredRelations = new Map();
    this._refreshHandlers = new Map();
    this._registerDefaultRefreshHandlers();
    this._initialized = false;
  }

  registerRefreshHandler(entityType, handler) {
    if (typeof handler !== 'function') return;
    this._refreshHandlers.set(entityType, handler);
  }

  _registerDefaultRefreshHandlers() {
    this.registerRefreshHandler('docente', async (entityId, periodId, modal, relationType) => {
      if (relationType === 'ee_asignadas' || !relationType) {
        await modal.eeRenderer.render(entityId, periodId);
        await modal._updateDocenteCounters(entityId, periodId, 'ee');
        await modal._refreshDropdownOptions(entityId, periodId, 'ee');
      }
      if (relationType === 'tutorados' || !relationType) {
        await modal.tutoradoRenderer.render(entityId, periodId);
        await modal._updateDocenteCounters(entityId, periodId, 'tutorados');
        await modal._refreshDropdownOptions(entityId, periodId, 'tutorados');
      }
    });

    this.registerRefreshHandler('ee', async (entityId, periodId, modal) => {
      await modal._updateEECounters(entityId, periodId);
      await modal._refreshEECard(entityId, periodId);
    });

    this.registerRefreshHandler('alumno', async (entityId, periodId, modal) => {
      await modal._updateAlumnoCounters(entityId, periodId);
    });

    this.registerRefreshHandler('default', async (entityId, periodId, modal) => {
      await modal._forceRefreshView();
    });
  }

  _getRefreshHandler(entityType) {
    return this._refreshHandlers.get(entityType) || this._refreshHandlers.get('default');
  }

  _ensureInitialized() {
    if (this._initialized) return;
    document.body.insertAdjacentHTML("beforeend", modalAsignacionesHtml);
    this.elements.overlay = document.getElementById("modal-asignaciones");
    this.elements.sidebarPeriodSelect = document.getElementById("ctx-period-selector");
    this.elements.sidebarContextInfo = document.getElementById("ctx-context-info");
    this.elements.workspaceContent = document.getElementById("workspace-content");
    this.elements.workspaceTabs = document.getElementById("workspace-tabs");
    this.elements.viewGestionar = document.getElementById("view-gestionar");
    this.elements.viewConsultar = document.getElementById("view-consultar");
    this._bindGlobalEvents();
    this._initialized = true;
  }

  open(context) {
    this._ensureInitialized();
    this.stateManager.setContext(context);
    this.stateManager.setActivePeriod(null);
    this.stateManager.setActiveTab("gestionar");
    this.elements.overlay.classList.remove("hidden");
    if (this.elements.viewGestionar) this.elements.viewGestionar.classList.remove("hidden");
    if (this.elements.viewConsultar) this.elements.viewConsultar.classList.add("hidden");
    this._loadInitialData();
  }

  async _loadInitialData() {
    try {
      await this.sidebarManager.loadPeriodsIntoSidebar(this.elements.sidebarPeriodSelect);
      const context = this.stateManager.context;
      if (context) {
        this.sidebarManager.renderContext(this.elements.sidebarContextInfo, context);
      }
      await this.sidebarManager.renderRelationsPanel(
        document.getElementById("sidebar-relations-panel"),
        context?.entityType,
        context?.entityId,
        this.stateManager.activePeriod
      );
      const registered = this._getRegisteredRelations(context?.entityType);
      await this.workspaceManager.renderGestionarView(
        this.elements.viewGestionar,
        registered,
        (ctx, periodId) => this._initializeRelationCards(this._getRegisteredRelations(ctx.entityType), ctx, periodId)
      );
    } catch (error) {
      console.error("Error cargando modal:", error);
      this.elements.workspaceContent.innerHTML = `<p class="error-msg">Error al cargar datos.</p>`;
    }
  }

  _refreshAll(relationType) {
    const { entityType, entityId } = this.stateManager.context || {};
    const periodId = this.stateManager.activePeriod;
    if (!periodId || !entityType) return;

    this.sidebarManager.renderRelationsPanel(
      document.getElementById("sidebar-relations-panel"),
      entityType,
      entityId,
      periodId
    );

    const handler = this._getRefreshHandler(entityType);
    if (handler) {
      handler(entityId, periodId, this, relationType)
        .catch(err => console.error(`Error en refresh handler:`, err));
    } else {
      this._forceRefreshView();
    }
  }

  async _updateDocenteCounters(docenteId, periodId, target) {
    if (target === 'ee' || !target) {
      const eeCounter = document.getElementById(`counter-ee-${docenteId}`);
      if (eeCounter) {
        try {
          const res = await window.electronAPI.obtenerEEDelDocente({ docenteId, periodoId: periodId });
          eeCounter.textContent = res?.data?.length || 0;
        } catch(e) {}
      }
    }
    if (target === 'tutorados' || !target) {
      const tutorCounter = document.getElementById(`counter-tutorados-${docenteId}`);
      if (tutorCounter) {
        try {
          const res = await window.electronAPI.obtenerTutorados({ docenteId, periodoId: periodId });
          tutorCounter.textContent = res?.data?.length || 0;
        } catch(e) {}
      }
    }
  }

  async _refreshDropdownOptions(docenteId, periodId, target) {
    if (target === 'ee' || !target) {
      const eeSelect = document.getElementById(`select-ee-${docenteId}`);
      if (eeSelect) {
        eeSelect.disabled = true;
        try {
          const res = await window.electronAPI.listarEEDisponibles({ periodoId: periodId, excludeAsignadasA: docenteId });
          eeSelect.innerHTML = '<option value="">Seleccionar materia...</option>';
          if (res?.success && res.data?.length > 0) {
            res.data.forEach((ee) => {
              const opt = document.createElement("option");
              opt.value = ee.id;
              opt.textContent = `${ee.nombre} (${ee.clave_ee})`;
              eeSelect.appendChild(opt);
            });
          } else {
            const opt = document.createElement("option");
            opt.value = "";
            opt.text = "Todas asignadas";
            opt.disabled = true;
            eeSelect.appendChild(opt);
          }
        } finally {
          eeSelect.disabled = false;
        }
      }
    }
    if (target === 'tutorados' || !target) {
      const tutSelect = document.getElementById(`select-tutorado-${docenteId}`);
      if (tutSelect) {
        tutSelect.disabled = true;
        try {
          const res = await window.electronAPI.listarAlumnosDisponibles({ periodoId: periodId, excludeDocenteId: docenteId });
          tutSelect.innerHTML = '<option value="">Seleccionar alumno...</option>';
          if (res?.success && res.data?.length > 0) {
            res.data.forEach((al) => {
              const opt = document.createElement("option");
              opt.value = al.id;
              opt.textContent = `${al.nombre_completo} (${al.matricula})`;
              tutSelect.appendChild(opt);
            });
          } else {
            const opt = document.createElement("option");
            opt.value = "";
            opt.text = "Todos tutorados";
            opt.disabled = true;
            tutSelect.appendChild(opt);
          }
        } finally {
          tutSelect.disabled = false;
        }
      }
    }
  }

  async _updateEECounters(eeId, periodId) {
    const alumnosCounter = document.getElementById(`counter-alumnos-inscritos-${eeId}`);
    if (alumnosCounter) {
      try {
        const res = await window.electronAPI.obtenerAlumnosDeEE({ eeId, periodoId: periodId });
        alumnosCounter.textContent = res?.data?.length || 0;
      } catch(e) {}
    }
    const docenteBadge = document.querySelector(`[data-relation="docente_asignado"] .relation-value`);
    if (docenteBadge) {
      try {
        const res = await window.electronAPI.obtenerDocenteDeEE({ eeId, periodoId: periodId });
        const doc = res?.data?.[0];
        docenteBadge.textContent = doc ? `${doc.tratamiento} ${doc.apellido_paterno}` : 'Sin asignar';
        docenteBadge.classList.toggle('empty', !doc);
      } catch(e) {}
    }
  }

  async _updateAlumnoCounters(alumnoId, periodId) {
    const eeCounter = document.getElementById(`counter-ee-inscritas-${alumnoId}`);
    if (eeCounter) {
      try {
        const res = await window.electronAPI.obtenerEEDeAlumno({ alumnoId, periodoId: periodId });
        eeCounter.textContent = res?.data?.length || 0;
      } catch(e) {}
    }
    const tutorBadge = document.querySelector(`[data-relation="tutor_asignado"] .relation-value`);
    if (tutorBadge) {
      try {
        const res = await window.electronAPI.obtenerTutorDeAlumno({ alumnoId, periodoId: periodId });
        const tutor = res?.data?.[0];
        tutorBadge.textContent = tutor ? `${tutor.tratamiento} ${tutor.apellido_paterno}` : 'Sin asignar';
        tutorBadge.classList.toggle('empty', !tutor);
      } catch(e) {}
    }
  }

  async _refreshEECard(eeId, periodId) {
    const card = document.querySelector('.workspace-card[data-relation="alumnos_inscritos"]');
    if (card) {
      try {
        const res = await window.electronAPI.obtenerAlumnosDeEE({ eeId, periodoId: periodId });
        const count = res?.data?.length || 0;
        const body = card.querySelector('.card-body');
        if (body && !body.querySelector('select')) {
          body.innerHTML = `<p class="summary-text"><strong>${count}</strong> alumno${count !== 1 ? 's' : ''} inscrito${count !== 1 ? 's' : ''} en este periodo</p>`;
        }
      } catch(e) {}
    }
  }

  async _forceRefreshView() {
    this.stateManager.invalidateCache(true);
    const { entityType, entityId } = this.stateManager.context || {};
    const registered = this._getRegisteredRelations(entityType);
    await this.workspaceManager.renderGestionarView(
      this.elements.viewGestionar,
      registered,
      (ctx, periodId) => this._initializeRelationCards(registered, ctx, periodId)
    );
  }

  async _initializeRelationCards(relations, context, periodId) {
    for (const rel of relations) {
      if (rel.tabId === "ee_asignadas") {
        await this._loadEESelector(context.entityId, periodId);
        await this.eeRenderer.render(context.entityId, periodId);
      }
      if (rel.tabId === "tutorados") {
        await this._loadTutoradosSelector(context.entityId, periodId);
        await this.tutoradoRenderer.render(context.entityId, periodId);
      }
    }
  }

  async _loadEESelector(docenteId, periodId) {
    const select = document.getElementById(`select-ee-${docenteId}`);
    const card = select?.closest(".workspace-card");
    const btnAssign = card?.querySelector('[data-action="assign"]');
    if (!select || !btnAssign) return;
    select.disabled = true;
    btnAssign.disabled = true;
    btnAssign.textContent = "Verificando...";
    try {
      if (!window.electronAPI?.listarEEDisponibles) throw new Error("API no definida");
      const res = await window.electronAPI.listarEEDisponibles({ periodoId: periodId, excludeAsignadasA: docenteId });
      select.innerHTML = '<option value="">Seleccionar materia...</option>';
      if (res?.success && res.data?.length > 0) {
        res.data.forEach((ee) => {
          const opt = document.createElement("option");
          opt.value = ee.id;
          opt.textContent = `${ee.nombre} (${ee.clave_ee})`;
          select.appendChild(opt);
        });
      } else {
        select.innerHTML = '<option value="" disabled>Se han asignado todas las EE disponibles</option>';
      }
      select.disabled = false;
      btnAssign.disabled = false;
      btnAssign.innerHTML = '<i class="fa-solid fa-link"></i> Asignar Materia';
      
      btnAssign.onclick = async () => {
        const newEeId = select.value;
        if (!newEeId) { Toast.warning("Seleccione una materia", 4000); return; }
        
        const listContainer = document.getElementById(`assigned-ee-list-${docenteId}`);
        let currentEeId = null;
        let currentEeName = null;
        
        if (listContainer) {
          const btnRemove = listContainer.querySelector('.btn-action-remove-ee, [data-action="remove-ee"]');
          if (btnRemove) {
            currentEeId = btnRemove.dataset.eeId || btnRemove.getAttribute('data-ee-id');
            currentEeName = btnRemove.dataset.eeName || btnRemove.getAttribute('data-ee-name');
            if (!currentEeName) {
              const existingItem = btnRemove.closest('.ee-assigned-item');
              currentEeName = existingItem?.querySelector('strong')?.textContent?.trim() || null;
            }
          }
        }
        
        const newEeOption = select.options[select.selectedIndex];
        const newEeName = newEeOption?.text?.split("(")[0]?.trim() || "la nueva materia";

        if (currentEeId && currentEeId !== newEeId) {
          const confirmed = await globalConfirm.ask(
            `¿Reemplazar Experiencia Educativa?`, 
            `Actualmente tienes asignada <strong>"${this.helpers.escapeHtml(currentEeName || "la materia actual")}"</strong>.<br><br>Al continuar, el sistema desasignará automáticamente la actual y asignará <strong>"${this.helpers.escapeHtml(newEeName)}"</strong>.<br>¿Deseas continuar?`
          );
          if (!confirmed) return;

          btnAssign.disabled = true;
          btnAssign.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Desasignando...';
          
          const removeRes = await window.electronAPI.removerDocenteEE({ docenteId, eeId: currentEeId, periodoId: periodId });
          if (!removeRes?.success) {
            Toast.error(`No se pudo desasignar: ${removeRes?.error}`, 8000);
            btnAssign.disabled = false;
            btnAssign.innerHTML = '<i class="fa-solid fa-link"></i> Asignar Materia';
            return;
          }
        }

        btnAssign.disabled = true;
        btnAssign.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Asignando...';
        try {
          const resSave = await window.electronAPI.asignarEEAdocente({ docenteId, eeId: newEeId, periodoId: periodId, cargaHoraria: 0 });
          if (resSave?.success) {
            Toast.success(currentEeId ? "Experiencia Educativa reemplazada correctamente" : "Experiencia Educativa asignada correctamente", 4000);
            this._refreshAll('ee_asignadas');
          } else { Toast.error(resSave?.error || "Error al guardar", 8000); }
        } catch (error) {
          console.error("Error al asignar:", error);
          Toast.error(error.message || "Error de conexión", 8000);
        } finally {
          btnAssign.disabled = false;
          btnAssign.innerHTML = '<i class="fa-solid fa-link"></i> Asignar Materia';
        }
      };
    } catch (error) {
      console.error("[Selector EE] Error Fatal:", error);
      select.innerHTML = `<option value="" disabled>Error: ${error.message}</option>`;
      btnAssign.disabled = true;
    }
  }

  async _loadTutoradosSelector(docenteId, periodId) {
    if (!periodId) return;
    const select = document.getElementById(`select-tutorado-${docenteId}`);
    const card = select?.closest('.workspace-card[data-relation="tutorados"]');
    const btnAssign = card?.querySelector('[data-action="assign"]');
    const counter = document.getElementById(`counter-tutorados-${docenteId}`);
    if (!select || !btnAssign) return;
    select.disabled = true;
    btnAssign.disabled = true;
    btnAssign.textContent = "Verificando...";
    try {
      const countRes = await window.electronAPI.obtenerTutorados({ docenteId, periodoId: periodId });
      if (countRes?.success && counter) counter.textContent = countRes.data.length;
      const listRes = await window.electronAPI.listarAlumnosDisponibles({ periodoId: periodId, excludeDocenteId: docenteId });
      select.innerHTML = '<option value="">Seleccionar alumno...</option>';
      if (listRes?.success && listRes.data?.length > 0) {
        listRes.data.forEach((al) => {
          const opt = document.createElement("option");
          opt.value = al.id;
          opt.textContent = `${al.nombre_completo} (${al.matricula})`;
          select.appendChild(opt);
        });
      } else {
        select.innerHTML = '<option value="" disabled>Se han asignado todos los alumnos disponibles</option>';
      }
      select.disabled = false;
      btnAssign.disabled = false;
      btnAssign.innerHTML = '<i class="fa-solid fa-user-plus"></i> Asignar Tutorado';
      btnAssign.onclick = async () => {
        const alumnoId = select.value;
        if (!alumnoId) { Toast.warning("Seleccione un alumno"); return; }
        btnAssign.disabled = true;
        btnAssign.textContent = "Asignando...";
        const res = await window.electronAPI.asignarTutor({ docenteId, alumnoId, periodoId: periodId });
        if (res?.success) {
          Toast.success("Tutorado asignado correctamente");
          this._refreshAll('tutorados');
        } else { Toast.error(res?.error || "Error al asignar"); }
        btnAssign.disabled = false;
        btnAssign.innerHTML = '<i class="fa-solid fa-user-plus"></i> Asignar Tutorado';
      };
    } catch (error) {
      console.error("Error cargando selector de tutorados:", error);
      select.innerHTML = `<option value="" disabled>Error: ${error.message}</option>`;
      btnAssign.disabled = true;
    }
  }

  async _switchTab(tabId) {
    if (this.stateManager.isLoading) return;
    this.stateManager.setActiveTab(tabId);
    this.elements.workspaceTabs.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    if (this.elements.viewGestionar && this.elements.viewConsultar) {
      this.elements.viewGestionar.classList.toggle("hidden", tabId !== "gestionar");
      this.elements.viewConsultar.classList.toggle("hidden", tabId !== "consultar");
    }
    const registered = this._getRegisteredRelations(this.stateManager.context?.entityType);
    if (tabId === "gestionar") {
      await this.workspaceManager.renderGestionarView(this.elements.viewGestionar, registered);
    } else if (tabId === "consultar") {
      await this.workspaceManager.renderConsultView(this.elements.viewConsultar, registered);
    }
  }

  async _handlePeriodChange() {
    this.stateManager.invalidateCache(true);
    await this.sidebarManager.renderRelationsPanel(
      document.getElementById("sidebar-relations-panel"),
      this.stateManager.context?.entityType,
      this.stateManager.context?.entityId,
      this.stateManager.activePeriod
    );
    const registered = this._getRegisteredRelations(this.stateManager.context?.entityType);
    if (this.stateManager.activeTab === "gestionar") {
      await this.workspaceManager.renderGestionarView(
        this.elements.viewGestionar,
        registered,
        (ctx, periodId) => this._initializeRelationCards(registered, ctx, periodId)
      );
    } else {
      await this.workspaceManager.renderConsultView(this.elements.viewConsultar, registered);
    }
  }

  _bindGlobalEvents() {
    const close = () => this.elements.overlay.classList.add("hidden");
    document.getElementById("btn-close-modal").onclick = close;
    document.getElementById("btn-cancelar-asig").onclick = close;
    this.elements.overlay.addEventListener("click", (e) => { if (e.target === this.elements.overlay) close(); });
    this.elements.workspaceTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      this._switchTab(btn.dataset.tab);
    });
    if (this.elements.sidebarPeriodSelect) {
      this.elements.sidebarPeriodSelect.onchange = async (e) => {
        this.stateManager.setActivePeriod(e.target.value || null);
        await this._handlePeriodChange();
      };
    }
    window.addEventListener('switchTab', (e) => { this._switchTab(e.detail); });
  }

  registerTab(entityType, config) {
    if (!this._registeredRelations.has(entityType)) this._registeredRelations.set(entityType, []);
    this._registeredRelations.get(entityType).push(config);
  }

  _getRegisteredRelations(entityType) {
    return this._registeredRelations?.get(entityType) || [];
  }
  
  _escapeHtml(str) {
    return this.helpers.escapeHtml(str);
  }
}