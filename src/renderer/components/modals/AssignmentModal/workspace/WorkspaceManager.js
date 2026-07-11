// src/renderer/components/modals/AssignmentModal/workspace/WorkspaceManager.js

import { PeriodAdhesionCard } from "./PeriodAdhesionCard.js";

export class WorkspaceManager {
  constructor({ api, stateManager, toast, confirm, uiLoader }) {
    this.api = api;
    this.stateManager = stateManager;
    this.toast = toast;
    this.confirm = confirm;
    this.uiLoader = uiLoader;

    this._renderers = new Map();
    this._components = new Map();
    this._abortController = null;
    this._workspaceContent = null;
    this._activeOption = "ee_asignadas";
    this._viewsInitialized = { gestionar: false, consultar: false };
    this._listenersInitialized = false; // ← NUEVO

    this._initComponents();
  }

  _initComponents() {
    this.periodAdhesion = new PeriodAdhesionCard({
      api: this.api,
      stateManager: this.stateManager,
      toast: this.toast,
      confirm: this.confirm,
    });
    this._components.set("adhesion", this.periodAdhesion);
  }

  registerRenderer(relationType, rendererInstance) {
    this._renderers.set(relationType, rendererInstance);
    this._components.set(relationType, rendererInstance);
  }

  async render(container) {
    if (!container) return;
    this._workspaceContent = container;

    await this._ensureGestionarView();
    await this._renderOptionTabs();
    await this._setupOptionTabs();
  }

  async switchView(tabId) {
    if (!this._workspaceContent) return;
    if (this.stateManager.activeTab === tabId) return;

    console.log("switchView llamado con:", tabId); // Debug

    this.stateManager.setActiveTab(tabId);

    if (tabId === "gestionar") {
      await this._showGestionarView();
    } else if (tabId === "consultar") {
      await this._showConsultView();
    }
  }

  async _showGestionarView() {
    const gestionarView =
      this._workspaceContent.querySelector("#view-gestionar");
    const adhesionSection = this._workspaceContent.querySelector(
      ".section-period-adhesion",
    );
    const consultSection = this._workspaceContent.querySelector(
      ".section-consult-view",
    );

    if (gestionarView) gestionarView.style.display = "block";
    if (adhesionSection) adhesionSection.style.display = "block";
    if (consultSection) consultSection.style.display = "none";

    await this._renderActiveOptionContent();
  }

  async _showConsultView() {
    const gestionarView =
      this._workspaceContent.querySelector("#view-gestionar");
    const adhesionSection = this._workspaceContent.querySelector(
      ".section-period-adhesion",
    );
    const consultSection = this._workspaceContent.querySelector(
      ".section-consult-view",
    );

    if (gestionarView) gestionarView.style.display = "none";
    if (adhesionSection) adhesionSection.style.display = "none";

    if (!consultSection) {
      await this._createConsultSection();
    } else {
      consultSection.style.display = "block";
      const consultRenderer = this._components.get("consult");
      if (consultRenderer && !this.stateManager.isCacheValid("consult")) {
        await consultRenderer.render();
      }
    }
  }

  async _createConsultSection() {
    const consultSection = document.createElement("div");
    consultSection.className = "workspace-section section-consult-view";
    consultSection.style.display = "block";

    consultSection.innerHTML = `
      <div class="section-header">
        <h4>Histórico de Experiencias Educativas</h4>
        <span class="section-desc">Todas las EE asignadas en periodos anteriores</span>
      </div>
      <div class="workspace-card">
        <div class="card-body">
          <div id="historial-ee-list" class="assigned-list">
            <span class="loading-text">Cargando...</span>
          </div>
        </div>
      </div>
    `;

    this._workspaceContent.appendChild(consultSection);

    const consultRenderer = new ConsultRenderer({
      api: this.api,
      stateManager: this.stateManager,
      container: consultSection,
    });
    this._components.set("consult", consultRenderer);
    await consultRenderer.render();
  }

  async _ensureGestionarView() {
    if (this._viewsInitialized.gestionar) return;

    await this.periodAdhesion.render(this._workspaceContent);
    this._viewsInitialized.gestionar = true;
  }

  async _setupOptionTabs() {
    if (this._listenersInitialized || !this._workspaceContent) return;

    const tabsContainer = this._workspaceContent.querySelector("#option-tabs");
    if (!tabsContainer) {
      console.warn("No se encontró #option-tabs");
      return;
    }

    this._listenersInitialized = true;

    // Usar event delegation en el contenedor
    tabsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".option-tab-btn");
      if (!btn) return;

      // Actualizar estado visual
      tabsContainer
        .querySelectorAll(".option-tab-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Cambiar la opción activa y renderizar
      this._activeOption = btn.dataset.option;
      console.log("Cambiando a:", this._activeOption); // Debug
      this._renderActiveOptionContent();
    });

    console.log("Listeners de tabs registrados");
  }

  async _renderOptionTabs() {
    if (!this._workspaceContent) return;

    const tabsContainer = this._workspaceContent.querySelector("#option-tabs");
    const contentContainer =
      this._workspaceContent.querySelector("#option-content");
    const overlay = document.getElementById("relations-overlay");

    if (!tabsContainer) return;

    const periodId = this.stateManager.activePeriod;

    if (!periodId) {
      tabsContainer.style.display = "flex";
      tabsContainer.classList.add("blurred");
      if (contentContainer) {
        contentContainer.style.display = "block";
        contentContainer.classList.add("blurred");
      }
      if (overlay) overlay.classList.remove("hidden");
      return;
    }

    tabsContainer.style.display = "flex";
    tabsContainer.classList.remove("blurred");
    if (contentContainer) {
      contentContainer.style.display = "block";
      contentContainer.classList.remove("blurred");
    }
    if (overlay) overlay.classList.add("hidden");

    await this._renderActiveOptionContent();
  }

  async _renderActiveOptionContent() {
    if (!this._workspaceContent) return;

    const contentContainer =
      this._workspaceContent.querySelector("#option-content");
    if (!contentContainer) return;

    const { entityType, entityId } = this.stateManager.context || {};
    const periodId = this.stateManager.activePeriod;

    if (!periodId) {
      contentContainer.innerHTML =
        '<p class="empty-text">Seleccione un periodo para gestionar relaciones</p>';
      return;
    }

    const renderer = this._renderers.get(this._activeOption);
    if (!renderer) {
      contentContainer.innerHTML =
        '<p class="error-text">Renderer no encontrado</p>';
      return;
    }

    const cardConfig = this._getCardConfig(this._activeOption, entityId);
    const cardRefs = this._createOrUpdateCard(contentContainer, cardConfig);

    await renderer.render({ entityType, entityId }, periodId, cardRefs);
    this.stateManager.setCache(this._activeOption, true);
  }

  _createOrUpdateCard(container, config) {
    let card = container.querySelector(
      `.option-card[data-option="${config.selectId}"]`,
    );

    if (!card) {
      const temp = document.createElement("div");
      temp.innerHTML = `
      <div class="option-card" data-option="${config.selectId}" style="display: none;">
        <div class="controls-inline">
          <div class="select-wrapper">
            <label class="form-label">Asignar nuevo ${config.title.toLowerCase()}</label>
            <select id="${config.selectId}" class="form-select">
              <option value="">Cargando...</option>
            </select>
          </div>
          <div class="btn-wrapper">
            <button class="btn btn-primary" data-action="assign">
              <i class="fa-solid fa-plus"></i> Asignar
            </button>
          </div>
        </div>
        <div class="assigned-list-header">
          <h5><i class="fa-solid fa-${config.icon}"></i> ${config.title} asignados</h5>
          <span class="badge badge-counter" id="${config.counterId}">0</span>
        </div>
        <div id="${config.listId}" class="assigned-list">
          <!-- SIN "Cargando..." hardcodeado -->
        </div>
      </div>
    `;
      card = temp.firstElementChild;
      container.appendChild(card);
    }

    container.querySelectorAll(".option-card").forEach((c) => {
      c.style.display = c === card ? "block" : "none";
    });

    return {
      card,
      select: card.querySelector(`#${config.selectId}`),
      assignButton: card.querySelector('[data-action="assign"]'),
      counter: card.querySelector(`#${config.counterId}`),
      listContainer: card.querySelector(`#${config.listId}`),
      body: card,
    };
  }

  _getCardConfig(optionType, entityId) {
    const configs = {
      ee_asignadas: {
        title: "Experiencias Educativas",
        icon: "book-open",
        selectId: `select-ee-${entityId}`,
        listId: `assigned-ee-list-${entityId}`,
        counterId: `counter-ee-${entityId}`,
        removeBtnText: "Desasignar Materia",
      },
      tutorados: {
        title: "Tutorados",
        icon: "user-graduate",
        selectId: `select-tutorado-${entityId}`,
        listId: `assigned-tutorados-list-${entityId}`,
        counterId: `counter-tutorados-${entityId}`,
        removeBtnText: "Remover Tutoría",
      },
    };
    return configs[optionType] || configs.ee_asignadas;
  }

  async refresh(relationType = null) {
    await this._renderOptionTabs();

    if (!relationType) {
      this.stateManager.invalidateAll();

      for (const [type, renderer] of this._renderers) {
        await renderer.refresh();
        this.stateManager.setCache(type, true);
      }
    } else {
      this.stateManager.invalidate(relationType);
      const renderer = this._renderers.get(relationType);
      if (renderer) {
        await renderer.refresh();
        this.stateManager.setCache(relationType, true);
      }
    }
  }

  invalidate(module) {
    this.stateManager.invalidate(module);
  }

  invalidateModules(modules) {
    this.stateManager.invalidateModules(modules);
  }

  cleanup() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    this.periodAdhesion.cleanup();

    for (const [type, renderer] of this._renderers) {
      renderer.destroy();
    }

    const consultSection = this._workspaceContent?.querySelector(
      ".section-consult-view",
    );
    if (consultSection) consultSection.remove();

    this._viewsInitialized = { gestionar: false, consultar: false };
    this._listenersInitialized = false; // ← RESET
  }
}

class ConsultRenderer {
  constructor({ api, stateManager, container }) {
    this.api = api;
    this.stateManager = stateManager;
    this.container = container;
  }

  async render() {
    const historialList = this.container.querySelector("#historial-ee-list");
    if (!historialList) return;

    const { entityType, entityId } = this.stateManager.context || {};

    historialList.innerHTML = '<span class="loading-text">Cargando...</span>';

    try {
      let historial = [];

      if (entityType === "docente") {
        const res = await this.api.obtenerEEDelDocente({ docenteId: entityId });
        if (res?.success) historial = res.data || [];
      } else if (entityType === "alumno") {
        const res = await this.api.obtenerEEDeAlumno({ alumnoId: entityId });
        if (res?.success) historial = res.data || [];
      }

      if (historial.length === 0) {
        historialList.innerHTML =
          '<span class="empty-text">Sin registros históricos</span>';
        return;
      }

      historialList.innerHTML = historial
        .map((item) => {
          const nombre = item.ee || item.nombre || "Sin nombre";
          const clave = item.clave || item.clave_ee || "";
          const periodo = item.periodo || item.descripcion || "";
          const carga = item.carga || item.carga_horaria || 0;

          return `
          <div class="assigned-item">
            <div class="item-content">
              <strong>${nombre}</strong>
              <div class="item-meta">
                ${clave ? `<span>Clave: ${clave}</span>` : ""}
              </div>
            </div>
            <div style="text-align:right;">
              ${periodo ? `<span style="display:block;font-weight:600;color:var(--accent-color);">${periodo}</span>` : ""}
              ${carga ? `<span style="font-size:0.8rem;color:var(--text-muted);">${carga} hrs</span>` : ""}
            </div>
          </div>
        `;
        })
        .join("");

      this.stateManager.setCache("consult", true);
    } catch (error) {
      console.error("Error cargando historial:", error);
      historialList.innerHTML =
        '<span class="error-text">Error al cargar historial</span>';
    }
  }
}
