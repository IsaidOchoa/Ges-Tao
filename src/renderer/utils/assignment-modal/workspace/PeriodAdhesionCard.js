// src/renderer/utils/assignment-modal/workspace/PeriodAdhesionCard.js
export class PeriodAdhesionCard {
  constructor({ api, stateManager, toast, confirm }) {
    this.api = api;
    this.stateManager = stateManager;
    this.toast = toast;
    this.confirm = confirm;
  }

  async render(container) {
    const { entityType, entityId, entityName } = this.stateManager.context || {};
    const listContainer = document.getElementById("adhesion-list");
    const select = document.getElementById("adhesion-period-select");
    const btnAdd = document.getElementById("btn-add-adhesion");

    if (!listContainer || !select) return;

    try {
      const resAssigned = await this.api.obtenerPeriodosDeEntidad({ entityType, entityId });
      const assignedPeriods = resAssigned?.success ? resAssigned.data : [];

      const resAll = await this.api.listarPeriodos();
      const allPeriods = resAll?.success ? resAll.data : [];

      const MAX_VISIBLE = 5;
      const visiblePeriods = assignedPeriods.slice(0, MAX_VISIBLE);
      const remainingCount = assignedPeriods.length - MAX_VISIBLE;

      let html = "";
      visiblePeriods.forEach((p) => {
        html += `<span class="adhesion-item" data-period-id="${p.id}" data-period-clave="${p.clave}" title="${p.descripcion}">
          ${p.descripcion}
          <button class="remove-btn" data-period="${p.id}" title="Quitar">&times;</button>
        </span>`;
      });
      
      if (remainingCount > 0) {
        html += `<span class="adhesion-item adhesion-counter" title="Ver más en Consultar" data-action="view-all">+${remainingCount}</span>`;
      }
      
      if (assignedPeriods.length === 0) {
        html = '<span class="adhesion-item empty">Sin periodos asignados</span>';
      }

      listContainer.innerHTML = html;

      listContainer.querySelectorAll(".remove-btn").forEach((btn) => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          await this._handleRemovePeriod(btn, entityType, entityId, entityName);
        };
      });

      const counterChip = listContainer.querySelector('[data-action="view-all"]');
      if (counterChip) {
        counterChip.onclick = () => {
          const event = new CustomEvent('switchTab', { detail: 'consultar' });
          window.dispatchEvent(event);
        };
      }

      const availablePeriods = allPeriods.filter(
        (p) => !assignedPeriods.some((ap) => ap.id == p.id)
      );
      
      if (availablePeriods.length === 0) {
        select.innerHTML = '<option value="" disabled>Se han asignado todos los periodos</option>';
        if (btnAdd) btnAdd.disabled = true;
      } else {
        select.innerHTML = '<option value="">Seleccionar periodo...</option>';
        availablePeriods.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${p.descripcion}`;
          select.appendChild(opt);
        });
        if (btnAdd) btnAdd.disabled = false;
      }

      if (btnAdd) {
        btnAdd.title = availablePeriods.length === 0
          ? "No hay periodos disponibles"
          : "Asignar periodo seleccionado";
          
        btnAdd.onclick = async () => {
          const periodId = select.value;
          if (!periodId) {
            this.toast.warning("Seleccione un periodo");
            return;
          }
          const selected = allPeriods.find((p) => p.id == periodId);
          await this._addEntityToPeriod(entityType, entityId, periodId);
          await this.render(container);
          this.toast.success(`Vinculado a ${selected?.descripcion}`);
          this.stateManager.invalidateCache();
        };
      }
    } catch (error) {
      console.error("Error en PeriodAdhesionCard:", error);
      listContainer.innerHTML = `<span class="adhesion-item empty">Error</span>`;
    }
  }

  async _handleRemovePeriod(btn, entityType, entityId, entityName) {
    const periodId = btn.dataset.period;
    const periodChip = btn.closest(".adhesion-item");
    const periodClave = periodChip?.dataset.periodClave || "este periodo";
    
    const entityLabel = entityType === "docente" ? "al docente" : entityType === "alumno" ? "al alumno" : "a la EE";
    const message = `¿Desvincular ${entityLabel} "${entityName}" del periodo "${periodClave}"?`;

    const confirmed = await this.confirm.ask(message, 0);
    
    if (confirmed) {
      await this._removeEntityFromPeriod(entityType, entityId, periodId);
      await this.render(document.getElementById("adhesion-list").parentElement.parentElement);
      
      if (this.stateManager.activePeriod == periodId) {
        this.stateManager.setActivePeriod(null);
        const periodSelector = document.getElementById("ctx-period-selector");
        if (periodSelector) periodSelector.value = "";
      }
      
      this.toast.success(`${entityName} desvinculado de ${periodClave}`);
      this.stateManager.invalidateCache();
    }
  }

  async _fetchAssignedPeriods(entityType, entityId) {
    try {
      const res = await this.api.obtenerPeriodosDeEntidad({ entityType, entityId });
      return res?.success ? res.data : [];
    } catch (error) {
      console.error("Error cargando periodos asignados:", error);
      return [];
    }
  }

  async _addEntityToPeriod(entityType, entityId, periodId) {
    const res = await this.api.agregarEntidadAPeriodo({ entityType, entityId, periodId });
    if (!res?.success) throw new Error(res?.error || "No se pudo vincular al periodo");
    return res;
  }

  async _removeEntityFromPeriod(entityType, entityId, periodId) {
    const res = await this.api.removerEntidadDePeriodo({ entityType, entityId, periodId });
    if (!res?.success) throw new Error(res?.error || "No se pudo desvincular del periodo");
    return res;
  }
}