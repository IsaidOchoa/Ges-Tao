// src/renderer/components/modals/AssignmentModal/workspace/PeriodAdhesionCard.js

export class PeriodAdhesionCard {
  constructor({ api, stateManager, toast, confirm }) {
    this.api = api;
    this.stateManager = stateManager;
    this.toast = toast;
    this.confirm = confirm;
    this._abortController = null;
    this._elements = {};
  }

  async render(container) {
    this._cacheElements(container);
    
    if (!this._elements.listContainer || !this._elements.select) return;

    this.cleanup();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const { entityType, entityId, entityName } = this.stateManager.context || {};

    try {
      const [resAssigned, resAll] = await Promise.all([
        this.api.obtenerPeriodosDeEntidad({ entityType, entityId }),
        this.api.listarPeriodos()
      ]);

      const assignedPeriods = resAssigned?.success ? resAssigned.data : [];
      const allPeriods = resAll?.success ? resAll.data : [];

      this._renderAssignedPeriods(assignedPeriods, entityType, entityId, entityName, signal);
      this._renderAvailablePeriods(assignedPeriods, allPeriods, entityType, entityId, signal);
    } catch (error) {
      console.error('Error en PeriodAdhesionCard:', error);
      this._elements.listContainer.innerHTML = '<span class="adhesion-item empty">Error</span>';
    }
  }

  cleanup() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  _cacheElements(container) {
    this._elements = {
      listContainer: container.querySelector('#adhesion-list') || document.getElementById('adhesion-list'),
      select: container.querySelector('#adhesion-period-select') || document.getElementById('adhesion-period-select'),
      btnAdd: container.querySelector('#btn-add-adhesion') || document.getElementById('btn-add-adhesion')
    };
  }

  _renderAssignedPeriods(assignedPeriods, entityType, entityId, entityName, signal) {
    const MAX_VISIBLE = 5;
    const visiblePeriods = assignedPeriods.slice(0, MAX_VISIBLE);
    const remainingCount = assignedPeriods.length - MAX_VISIBLE;

    let html = '';
    visiblePeriods.forEach((p) => {
      html += `
        <span class="adhesion-item" data-period-id="${p.id}" data-period-clave="${p.clave}" title="${p.descripcion}">
          ${p.descripcion}
          <button class="remove-btn" data-period="${p.id}" title="Quitar">&times;</button>
        </span>
      `;
    });
    
    if (remainingCount > 0) {
      html += `<span class="adhesion-item adhesion-counter" title="Ver más en Consultar" data-action="view-all">+${remainingCount}</span>`;
    }
    
    if (assignedPeriods.length === 0) {
      html = '<span class="adhesion-item empty">Sin periodos asignados</span>';
    }

    this._elements.listContainer.innerHTML = html;

    this._elements.listContainer.querySelectorAll('.remove-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._handleRemovePeriod(btn, entityType, entityId, entityName);
      }, { signal });
    });

    const counterChip = this._elements.listContainer.querySelector('[data-action="view-all"]');
    if (counterChip) {
      counterChip.addEventListener('click', () => {
        const event = new CustomEvent('switchTab', { detail: 'consultar' });
        window.dispatchEvent(event);
      }, { signal });
    }
  }

  _renderAvailablePeriods(assignedPeriods, allPeriods, entityType, entityId, signal) {
    const availablePeriods = allPeriods.filter(
      (p) => !assignedPeriods.some((ap) => ap.id == p.id)
    );
    
    if (availablePeriods.length === 0) {
      this._elements.select.innerHTML = '<option value="" disabled>Se han asignado todos los periodos</option>';
      if (this._elements.btnAdd) this._elements.btnAdd.disabled = true;
    } else {
      this._elements.select.innerHTML = '<option value="">Seleccionar periodo...</option>';
      availablePeriods.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.descripcion;
        this._elements.select.appendChild(opt);
      });
      if (this._elements.btnAdd) this._elements.btnAdd.disabled = false;
    }

    if (this._elements.btnAdd) {
      this._elements.btnAdd.title = availablePeriods.length === 0
        ? 'No hay periodos disponibles'
        : 'Asignar periodo seleccionado';
        
      this._elements.btnAdd.addEventListener('click', async () => {
        const periodId = this._elements.select.value;
        if (!periodId) {
          this.toast.warning('Seleccione un periodo');
          return;
        }
        const selected = allPeriods.find((p) => p.id == periodId);
        await this._addEntityToPeriod(entityType, entityId, periodId);
        await this.render(this._elements.listContainer.parentElement.parentElement);
        this.toast.success(`Vinculado a ${selected?.descripcion}`);
        this.stateManager.invalidateCache();
      }, { signal });
    }
  }

  async _handleRemovePeriod(btn, entityType, entityId, entityName) {
    const periodId = btn.dataset.period;
    const periodChip = btn.closest('.adhesion-item');
    const periodClave = periodChip?.dataset.periodClave || 'este periodo';
    
    const entityLabel = entityType === 'docente' ? 'al docente' : entityType === 'alumno' ? 'al alumno' : 'a la EE';
    const message = `¿Desvincular ${entityLabel} "${entityName}" del periodo "${periodClave}"?`;

    const confirmed = await this.confirm.ask(message, 0);
    
    if (confirmed) {
      await this._removeEntityFromPeriod(entityType, entityId, periodId);
      await this.render(this._elements.listContainer.parentElement.parentElement);
      
      if (this.stateManager.activePeriod == periodId) {
        this.stateManager.setActivePeriod(null);
        const periodSelector = document.getElementById('ctx-period-selector');
        if (periodSelector) periodSelector.value = '';
      }
      
      this.toast.success(`${entityName} desvinculado de ${periodClave}`);
      this.stateManager.invalidateCache();
    }
  }

  async _addEntityToPeriod(entityType, entityId, periodId) {
    const res = await this.api.agregarEntidadAPeriodo({ entityType, entityId, periodId });
    if (!res?.success) throw new Error(res?.error || 'No se pudo vincular al periodo');
    return res;
  }

  async _removeEntityFromPeriod(entityType, entityId, periodId) {
    const res = await this.api.removerEntidadDePeriodo({ entityType, entityId, periodId });
    if (!res?.success) throw new Error(res?.error || 'No se pudo desvincular del periodo');
    return res;
  }
}