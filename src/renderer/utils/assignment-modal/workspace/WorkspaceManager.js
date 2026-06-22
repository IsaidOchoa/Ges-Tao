// src/renderer/utils/assignment-modal/workspace/WorkspaceManager.js
import { PeriodAdhesionCard } from './PeriodAdhesionCard.js';

export class WorkspaceManager {
  constructor({ api, stateManager, toast, confirm, uiLoader }) {
    this.api = api;
    this.stateManager = stateManager;
    this.toast = toast;
    this.confirm = confirm;
    this.uiLoader = uiLoader;
    this.periodAdhesion = new PeriodAdhesionCard({ api, stateManager, toast, confirm });
  }

  async renderGestionarView(container, registeredRelations, onInitializeCards) {
    if (!container) return;

    const cacheKey = this.stateManager.getCacheKey();
    
    if (this.stateManager.isCached('gestionar', cacheKey) && !this.stateManager._forceRefresh) {
      return;
    }

    await this.periodAdhesion.render(container);
    await this._renderOperationalRelations(container, registeredRelations);

    if (onInitializeCards && this.stateManager.activePeriod) {
      await new Promise(resolve => setTimeout(resolve, 50));
      await onInitializeCards(this.stateManager.context, this.stateManager.activePeriod);
    }

    this.stateManager.setCached('gestionar', cacheKey);
  }

  async _renderOperationalRelations(container, registeredRelations) {
    const { entityType, entityId, entityName } = this.stateManager.context || {};
    const periodId = this.stateManager.activePeriod;
    
    const grid = document.getElementById("operational-relations-grid");
    const overlay = document.getElementById("relations-overlay");
    
    if (!grid) return;

    if (!periodId) {
      overlay?.classList.remove("hidden");
      grid.innerHTML = '';
      return;
    } else {
      overlay?.classList.add("hidden");
    }

    const compatibleRelations = registeredRelations.filter(
      (rel) => rel.workspaceConfig?.modes?.includes("gestionar")
    );

    if (compatibleRelations.length === 0) {
      grid.innerHTML = '<div class="empty-state">No hay relaciones configuradas</div>';
      return;
    }

    grid.innerHTML = compatibleRelations.map((rel) => {
      if (typeof rel.renderOperationalCard === "function") {
        return rel.renderOperationalCard(
          { entityType, entityId, entityName },
          periodId,
          {}
        );
      }
      return `<section class="workspace-card relation-card" data-relation="${rel.tabId}">
        <header class="card-header"><h4>${rel.label || rel.tabId}</h4></header>
        <div class="card-body"><p class="summary-text">${rel.description || "Operación disponible"}</p></div>
      </section>`;
    }).join("");
  }

  async renderConsultView(container, registeredRelations) {
    if (!container) return;

    const { entityType, entityId, entityName } = this.stateManager.context || {};
    const cacheKey = this.stateManager.getCacheKey();

    if (this.stateManager.isCached('consultar', cacheKey)) {
      return;
    }

    const consultRelations = registeredRelations.filter(
      (rel) => rel.workspaceConfig?.modes?.includes("consultar")
    );

    if (consultRelations.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No hay relaciones configuradas para consultar</p></div>`;
      return;
    }

    let html = `<div class="workspace-grid">`;
    for (const relation of consultRelations) {
      if (typeof relation.renderWorkspace === "function") {
        const cardHtml = relation.renderWorkspace(
          { entityType, entityId, entityName },
          null,
          "consultar"
        );
        if (cardHtml) html += cardHtml;
      }
    }
    html += `</div>`;
    container.innerHTML = html;

    for (const relation of consultRelations) {
      if (relation.tabId === "ee_asignadas" && typeof relation.loadHistorialData === "function") {
        const historialList = container.querySelector("#historial-ee-list");
        if (historialList) {
          try {
            const historial = await relation.loadHistorialData(entityType, entityId);
            historialList.innerHTML = historial.length === 0
              ? '<span class="empty-text">Sin registros históricos</span>'
              : `<div style="display:flex;flex-direction:column;gap:0.75rem;">
                  ${historial.map((item) => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid var(--accent-color);">
                      <div>
                        <div style="font-weight:600;color:var(--text-light);">${item.ee}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);">${item.clave}</div>
                      </div>
                      <div style="text-align:right;">
                        <span style="display:block;font-weight:600;color:var(--accent-color);">${item.periodo}</span>
                        <span style="font-size:0.8rem;color:var(--text-muted);">${item.carga} hrs</span>
                      </div>
                    </div>
                  `).join("")}
                </div>`;
          } catch (error) {
            console.warn("Error cargando historial EE:", error);
            historialList.innerHTML = '<span class="error-text">Error al cargar</span>';
          }
        }
      }
    }

    this.stateManager.setCached('consultar', cacheKey);
  }
}