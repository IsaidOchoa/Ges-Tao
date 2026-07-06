// src/renderer/components/modals/AssignmentModal/workspace/WorkspaceManager.js

import { PeriodAdhesionCard } from "./PeriodAdhesionCard.js";
import { OptionCardRenderer } from "./OptionCardRenderer.js";

export class WorkspaceManager {
  constructor({ api, stateManager, toast, confirm, uiLoader }) {
    this.api = api;
    this.stateManager = stateManager;
    this.toast = toast;
    this.confirm = confirm;
    this.uiLoader = uiLoader;
    this.periodAdhesion = new PeriodAdhesionCard({
      api,
      stateManager,
      toast,
      confirm,
    });
    this.optionRenderer = new OptionCardRenderer();
    this.activeOption = "ee_asignadas";
    this._renderers = new Map();
    this._abortController = null;
    this._workspaceContent = null;
  }

  registerRenderer(relationType, rendererInstance) {
    this._renderers.set(relationType, rendererInstance);
  }

  async render(container) {
    if (!container) return;

    this._workspaceContent = container;

    await this.periodAdhesion.render(container);
    await this._renderOptionTabs(container);
    await this._renderActiveOptionContent();
  }

  async switchView(tabId) {
    if (!this._workspaceContent) return;

    if (tabId === "gestionar") {
      await this.render(this._workspaceContent);
    } else if (tabId === "consultar") {
      await this._renderConsultView(this._workspaceContent);
    }
  }

  async refresh(relationType = null) {
    if (!relationType) {
      for (const [type, renderer] of this._renderers) {
        await renderer.refresh();
      }
    } else {
      const renderer = this._renderers.get(relationType);
      if (renderer) {
        await renderer.refresh();
      }
    }
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
  }

  async _renderOptionTabs(container) {
    const tabsContainer = container.querySelector("#option-tabs");
    const contentContainer = container.querySelector("#option-content");
    const overlay = container.querySelector("#relations-overlay");

    if (!tabsContainer) return;

    const periodId = this.stateManager.activePeriod;

    if (!periodId) {
      tabsContainer.style.display = "flex";
      tabsContainer.classList.add("blurred");
      if (contentContainer) {
        contentContainer.style.display = "block";
        contentContainer.classList.add("blurred");
      }
      if (overlay) {
        overlay.classList.remove("hidden");
      }
      return;
    }

    tabsContainer.style.display = "flex";
    tabsContainer.classList.remove("blurred");
    if (contentContainer) {
      contentContainer.style.display = "block";
      contentContainer.classList.remove("blurred");
    }
    if (overlay) {
      overlay.classList.add("hidden");
      
    }
    

    if (this._abortController) {
      this._abortController.abort();
    }

    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    tabsContainer.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest(".option-tab-btn");
        if (!btn) return;

        tabsContainer
          .querySelectorAll(".option-tab-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        this.activeOption = btn.dataset.option;
        this._renderActiveOptionContent();
      },
      { signal }
    );
  }

  async _renderActiveOptionContent() {
    if (!this._workspaceContent) return;

    const contentContainer = this._workspaceContent.querySelector("#option-content");
    if (!contentContainer) return;

    const { entityType, entityId } = this.stateManager.context || {};
    const periodId = this.stateManager.activePeriod;

    if (!periodId) {
      this.optionRenderer.renderEmptyState(contentContainer);
      return;
    }

    const renderer = this._renderers.get(this.activeOption);
    if (!renderer) {
      this.optionRenderer.renderErrorState(
        contentContainer,
        "Renderer no encontrado"
      );
      return;
    }

    const cardConfig = this._getCardConfig(this.activeOption, entityId);
    const cardRefs = this.optionRenderer.createCard(cardConfig);

    contentContainer.innerHTML = "";
    contentContainer.appendChild(cardRefs.card);

    await renderer.render({ entityType, entityId }, periodId, cardRefs);
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

  async _renderConsultView(container) {
  if (!container) return;

  const { entityType, entityId } = this.stateManager.context || {};

  container.innerHTML = `
    <div class="workspace-section">
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
    </div>
  `;

  const historialList = container.querySelector("#historial-ee-list");
  if (!historialList) return;

  try {
    let historial = [];

    if (entityType === "docente") {
      const res = await this.api.obtenerEEDelDocente({ docenteId: entityId });
      if (res?.success) {
        historial = res.data || [];
      }
    } else if (entityType === "alumno") {
      const res = await this.api.obtenerEEDeAlumno({ alumnoId: entityId });
      if (res?.success) {
        historial = res.data || [];
      }
    } else if (entityType === "ee") {
      const res = await this.api.obtenerAlumnosDeEE({ eeId: entityId });
      if (res?.success) {
        historial = res.data || [];
      }
    }

    if (historial.length === 0) {
      historialList.innerHTML = '<span class="empty-text">Sin registros históricos</span>';
      return;
    }

    historialList.innerHTML = historial
      .map((item) => {
        const nombre = item.ee || item.nombre || item.nombre_ee || "Sin nombre";
        const clave = item.clave || item.clave_ee || "";
        const periodo = item.periodo || item.descripcion || item.periodo_descripcion || "";
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
  } catch (error) {
    console.error("Error cargando historial:", error);
    historialList.innerHTML = '<span class="error-text">Error al cargar historial</span>';
  }
}
}