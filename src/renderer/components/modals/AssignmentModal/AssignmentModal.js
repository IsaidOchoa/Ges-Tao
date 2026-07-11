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
      api: window.electronAPI, 
      toast: Toast, 
      confirm: globalConfirm,
      stateManager: this.stateManager,
      uiLoader: uiLoader
    }));
    
    this.workspaceManager.registerRenderer('tutorados', new TutoradoListRenderer({ 
      api: window.electronAPI, 
      toast: Toast, 
      confirm: globalConfirm,
      stateManager: this.stateManager,
      uiLoader: uiLoader
    }));

    this._initialized = false;
  }

  open(context) {
    // Resetear estado completamente
    this.stateManager = new StateManager();
    this.stateManager.setContext(context);
    this.stateManager.setActivePeriod(null);
    this.stateManager.setActiveTab("gestionar");

    // Re-inicializar managers con nuevo stateManager
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
      api: window.electronAPI, 
      toast: Toast, 
      confirm: globalConfirm,
      stateManager: this.stateManager,
      uiLoader: uiLoader
    }));
    
    this.workspaceManager.registerRenderer('tutorados', new TutoradoListRenderer({ 
      api: window.electronAPI, 
      toast: Toast, 
      confirm: globalConfirm,
      stateManager: this.stateManager,
      uiLoader: uiLoader
    }));

    this._ensureInitialized();
    
    this.elements.overlay.classList.remove("hidden");
    this._loadInitialData();
  }

  close() {
  if (!this.elements.overlay) return;
  
  // Ocultar modal
  this.elements.overlay.classList.add("hidden");

  // Destruir todos los componentes
  this.workspaceManager.cleanup();
  this.sidebarManager.cleanup();

  // Abortar todos los listeners globales
  if (this._abortController) {
    this._abortController.abort();
    this._abortController = null;
  }

  // Eliminar el modal del DOM completamente
  if (this.elements.overlay) {
    this.elements.overlay.remove();
    this.elements = {};
  }

  // Resetear estado
  this._initialized = false;
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

  // Tabs de workspace (Gestionar/Consultar)
  this.elements.workspaceTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;

    const tabId = btn.dataset.tab;
    console.log('Tab principal clickeado:', tabId); // Debug
    
    this._switchTab(tabId);
  }, { signal });

  // Selector de periodo
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
  
  // Actualizar UI de tabs primero
  this.elements.workspaceTabs.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // Cambiar la vista
  await this.workspaceManager.switchView(tabId);
  
  // Actualizar el estado después
  this.stateManager.setActiveTab(tabId);
}

  async _handlePeriodChange(periodId) {
    this.stateManager.setActivePeriod(periodId);
    this.stateManager.invalidateAll();
    
    await this._refreshAll();
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