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
    this._listenersInitialized = false;

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

    // Verificar cache con clave específica
    const cacheKey = `${this._activeOption}_${entityId}_${periodId}`;

    if (!this.stateManager.isCacheValid(cacheKey)) {
      console.log(`[${this._activeOption}] Cache inválido, renderizando...`);
      await renderer.render({ entityType, entityId }, periodId, cardRefs);
    } else {
      console.log(`[${this._activeOption}] Cache válido, no se re-renderiza`);
    }
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
          <div id="${config.listId}" class="assigned-list"></div>
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
    if (!tabsContainer) return;

    this._listenersInitialized = true;

    tabsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".option-tab-btn");
      if (!btn) return;

      tabsContainer
        .querySelectorAll(".option-tab-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      this._activeOption = btn.dataset.option;

      this._renderActiveOptionContent();
    });
  }

  async _renderOptionTabs() {
    if (!this._workspaceContent) return;

    const tabsContainer = this._workspaceContent.querySelector("#option-tabs");
    const contentContainer =
      this._workspaceContent.querySelector("#option-content");
    const overlay = document.getElementById("relations-overlay");

    if (!tabsContainer || !overlay) return;

    const periodId = this.stateManager.activePeriod;
    const { entityType, entityId } = this.stateManager.context || {};

    console.log(
      "[DEBUG] _renderOptionTabs - Periodo:",
      periodId,
      "Entidad:",
      entityType,
      entityId,
    );

    // Caso 1: No hay periodo seleccionado
    if (!periodId) {
      tabsContainer.style.display = "flex";
      tabsContainer.classList.add("blurred");
      if (contentContainer) {
        contentContainer.style.display = "block";
        contentContainer.classList.add("blurred");
      }

      this._updateOverlayContent(overlay, {
        icon: "fa-circle-info",
        title: "Seleccione un periodo académico",
        message:
          "Seleccione un periodo para habilitar las relaciones operativas",
        showButton: false,
      });

      overlay.classList.remove("hidden");
      console.log("[DEBUG] Caso 1: Sin periodo seleccionado");
      return;
    }

    // Caso 2: Verificar si la entidad pertenece al periodo
    const belongsToPeriod = await this._checkEntityBelongsToPeriod(
      entityType,
      entityId,
      periodId,
    );

    if (!belongsToPeriod) {
      console.log("[DEBUG] Caso 2: Entidad NO pertenece al periodo");

      this._updateOverlayContent(overlay, {
        icon: "fa-circle-exclamation",
        title: "Entidad no asociada al periodo",
        message: `Este ${this._getEntityLabel()} no pertenece al periodo seleccionado.`,
        showButton: true,
        buttonText: "Asociar al periodo",
        buttonAction: () => this._handleAddToPeriod(periodId),
      });

      overlay.classList.remove("hidden");

      tabsContainer.style.display = "flex";
      tabsContainer.classList.add("blurred");
      if (contentContainer) {
        contentContainer.style.display = "block";
        contentContainer.classList.add("blurred");
      }

      return;
    }

    // Caso 3: Todo OK - habilitar
    console.log("[DEBUG] Caso 3: Todo OK, habilitando workspace");

    tabsContainer.style.display = "flex";
    tabsContainer.classList.remove("blurred");
    if (contentContainer) {
      contentContainer.style.display = "block";
      contentContainer.classList.remove("blurred");
    }

    overlay.classList.add("hidden");

    await this._renderActiveOptionContent();
  }

  _updateOverlayContent(overlay, config) {
    const overlayContent = overlay.querySelector(".overlay-content");
    if (!overlayContent) return;

    let html = `
      <i class="fa-solid ${config.icon}"></i>
      <p style="font-weight: 600; margin-bottom: 0.5rem;">${config.title}</p>
      <p style="margin: 0 0 1rem 0; opacity: 0.9;">${config.message}</p>
    `;

    if (config.showButton) {
      html += `
        <button class="btn btn-primary" id="overlay-action-btn" style="margin-top: 0.5rem;">
          <i class="fa-solid fa-plus"></i> ${config.buttonText}
        </button>
      `;
    }

    overlayContent.innerHTML = html;

    if (config.showButton && config.buttonAction) {
      const btn = overlayContent.querySelector("#overlay-action-btn");
      btn?.addEventListener("click", () => config.buttonAction());
    }
  }

  async _checkEntityBelongsToPeriod(entityType, entityId, periodId) {
    try {
      const res = await this.api.obtenerPeriodosDeEntidad({
        entityType,
        entityId,
      });
      const periods = res?.success ? res.data : [];

      // DEBUG: Ver qué devuelve la API
      console.log("[DEBUG] Periodos de la entidad:", periods);
      console.log("[DEBUG] Periodo seleccionado:", periodId, typeof periodId);

      // Usar comparación laxa (==) porque los IDs pueden ser string o number
      const belongs = periods.some((p) => p.id == periodId);

      console.log("[DEBUG] ¿Pertenece al periodo?", belongs);

      return belongs;
    } catch (error) {
      console.error("Error verificando pertenencia:", error);
      return false;
    }
  }

  _getEntityLabel() {
    const { entityType } = this.stateManager.context || {};
    const labels = {
      docente: "docente",
      alumno: "alumno",
      ee: "experiencia educativa",
    };
    return labels[entityType] || "entidad";
  }

  async _handleAddToPeriod(periodId) {
    const { entityType, entityId } = this.stateManager.context || {};

    try {
      const res = await this.api.agregarEntidadAPeriodo({
        entityType,
        entityId,
        periodId,
      });

      if (!res?.success) throw new Error(res?.error || "Error al agregar");

      this.toast.success("Entidad asociada al periodo correctamente");

      // Invalidar TODO el caché para forzar re-verificación
      this.stateManager.invalidateAll();

      // Re-renderizar tabs para actualizar overlay
      await this._renderOptionTabs();

      // Actualizar sidebar
      if (this.sidebarManager) {
        await this.sidebarManager.renderRelationsPanel(
          document.getElementById("sidebar-relations-panel"),
        );
      }
    } catch (error) {
      console.error("Error agregando al periodo:", error);
      this.toast.error(`Error: ${error.message}`);
    }
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
    this._listenersInitialized = false;
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
