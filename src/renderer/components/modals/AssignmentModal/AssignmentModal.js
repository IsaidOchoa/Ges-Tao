// src/renderer/components/modals/AssignmentModal/AssignmentModal.js

import { uiLoader } from "../../../utils/uiLoader.js";
import { Toast } from "../../common/Toast.js";
import { globalConfirm } from "../../../utils/confirmationModal.js";
import modalAsignacionesHtml from "../../../config/relationships/templates/modal-asignaciones.html";

import { StateManager } from './core/StateManager.js';
import { SidebarManager } from './sidebar/SidebarManager.js';
import { WorkspaceManager } from './workspace/WorkspaceManager.js';
import { EEListRenderer } from './relations/ee/EEListRenderer.js';
import { TutoradoListRenderer } from './relations/tutorados/TutoradoListRenderer.js';

export class AssignmentModal {
  constructor() {
    this.elements = {};
    this._abortController = null;
    this._registeredRelations = new Map();
    
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

    this.workspaceManager.registerRenderer('ee_asignadas', new EEListRenderer({ 
      api: window.electronAPI, toast: Toast, confirm: globalConfirm 
    }));
    
    this.workspaceManager.registerRenderer('tutorados', new TutoradoListRenderer({ 
      api: window.electronAPI, toast: Toast, confirm: globalConfirm 
    }));

    this._initialized = false;
  }

  open(context) {
    this._ensureInitialized();
    this.stateManager.setContext(context);
    this.stateManager.setActivePeriod(null);
    this.stateManager.setActiveTab("gestionar");
    
    this.elements.overlay.classList.remove("hidden");
    this._loadInitialData();
  }

  close() {
    if (!this.elements.overlay) return;
    this.elements.overlay.classList.add("hidden");
    
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    
    this.workspaceManager.cleanup(); 
  }

  _ensureInitialized() {
    if (this._initialized) return;
    
    document.body.insertAdjacentHTML("beforeend", modalAsignacionesHtml);
    this._cacheDOMElements();
    this._bindGlobalEvents();
    
    this._initialized = true;
  }

  _cacheDOMElements() {
    this.elements.overlay = document.getElementById("modal-asignaciones");
    this.elements.sidebarPeriodSelect = document.getElementById("ctx-period-selector");
    this.elements.sidebarContextInfo = document.getElementById("ctx-context-info");
    this.elements.sidebarRelationsPanel = document.getElementById("sidebar-relations-panel");
    this.elements.workspaceTabs = document.getElementById("workspace-tabs");
    this.elements.workspaceContent = document.getElementById("workspace-content");
  }

  _bindGlobalEvents() {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const closeHandler = () => this.close();

    document.getElementById("btn-close-modal").addEventListener("click", closeHandler, { signal });
    document.getElementById("btn-cancelar-asig").addEventListener("click", closeHandler, { signal });
    
    this.elements.overlay.addEventListener("click", (e) => { 
      if (e.target === this.elements.overlay) closeHandler(); 
    }, { signal });

    this.elements.workspaceTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) this._switchTab(btn.dataset.tab);
    }, { signal });

    this.elements.sidebarPeriodSelect.addEventListener("change", (e) => {
      this._handlePeriodChange(e.target.value || null);
    }, { signal });
  }

  async _loadInitialData() {
    try {
      await this.sidebarManager.loadPeriods(this.elements.sidebarPeriodSelect);
      this.sidebarManager.renderContext(this.elements.sidebarContextInfo, this.stateManager.context);
      
      await this.workspaceManager.render(this.elements.workspaceContent);
      
      await this.sidebarManager.renderRelationsPanel(this.elements.sidebarRelationsPanel);
      
    } catch (error) {
      console.error("Error cargando modal:", error);
      Toast.error("Error al cargar datos del modal.");
    }
  }

  async _switchTab(tabId) {
    if (this.stateManager.isLoading || this.stateManager.activeTab === tabId) return;
    
    this.stateManager.setActiveTab(tabId);
    
    this.elements.workspaceTabs.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    await this.workspaceManager.switchView(tabId);
  }

  async _handlePeriodChange(periodId) {
  this.stateManager.setActivePeriod(periodId);
  this.stateManager.invalidateCache();
  
  // Refrescar panel lateral
  await this.sidebarManager.renderRelationsPanel(this.elements.sidebarRelationsPanel);
  
  // Re-renderizar el workspace completo para que se actualice el overlay
  if (this.elements.workspaceContent) {
    await this.workspaceManager.render(this.elements.workspaceContent);
  }
}

  async _refreshAll(relationType = null) {
    await this.sidebarManager.renderRelationsPanel(this.elements.sidebarRelationsPanel);
    
    await this.workspaceManager.refresh(relationType);
  }

  registerTab(entityType, config) {
    if (!this._registeredRelations.has(entityType)) {
      this._registeredRelations.set(entityType, []);
    }
    this._registeredRelations.get(entityType).push(config);
  }

  _getRegisteredRelations(entityType) {
    return this._registeredRelations?.get(entityType) || [];
  }
}