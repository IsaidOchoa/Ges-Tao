// src/renderer/components/modals/AssignmentModal/core/PeriodAdminManager.js

export class PeriodAdminManager {
  constructor({ api, stateManager, toast, confirm }) {
    this.api = api;
    this.stateManager = stateManager;
    this.toast = toast;
    this.confirm = confirm;
    this._dialog = null;
    this._abortController = null;
    this._assignedPeriods = [];
    this._allPeriods = [];
    this._onSaveCallback = null;
  }

  async open(onSave) {
    this._onSaveCallback = onSave;
    
    // Crear o buscar el diálogo
    this._dialog = document.getElementById('period-admin-dialog');
    
    if (!this._dialog) {
      this._createDialog();
    }

    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Cargar datos
    await this._loadData();
    
    // Renderizar lista
    this._renderList();
    
    // Ocultar formulario de agregar al abrir
    this._hideAddForm();
    
    // Mostrar diálogo
    this._dialog.classList.remove('hidden');
    
    // Bind events
    this._bindEvents(signal);
  }

  _createDialog() {
    const dialog = document.createElement('div');
    dialog.id = 'period-admin-dialog';
    dialog.className = 'period-admin-overlay hidden';
    
    dialog.innerHTML = `
      <div class="period-admin-modal">
        <div class="period-admin-header">
          <h3>Administrar periodos</h3>
          <button class="btn-icon-close" id="btn-close-period-admin">&times;</button>
        </div>

        <div class="period-admin-body">
          <div id="period-admin-list" class="period-admin-list"></div>

          <div id="period-add-form" class="period-add-form" style="display: none">
            <div class="form-group">
              <label class="form-label">Seleccionar periodo</label>
              <select id="period-add-select" class="form-select">
                <option value="">Cargando...</option>
              </select>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" id="btn-cancel-add">Cancelar</button>
              <button class="btn btn-primary" id="btn-confirm-add">
                <i class="fa-solid fa-plus"></i> Agregar
              </button>
            </div>
          </div>

          <button id="btn-show-add-form" class="btn btn-block btn-outline-primary" style="margin-top: 1rem">
            <i class="fa-solid fa-plus"></i> Asociar periodo
          </button>
        </div>

        <div class="period-admin-footer">
          <button class="btn btn-secondary" id="btn-cancel-period-admin">Cerrar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    this._dialog = dialog;
  }

  close() {
    if (!this._dialog) return;
    
    this._dialog.classList.add('hidden');
    
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    
    this._hideAddForm();
  }

  // En PeriodAdminManager.js, método _loadData():

async _loadData() {
  const { entityType, entityId } = this.stateManager.context || {};
  
  console.log('[PeriodAdmin] Contexto:', { entityType, entityId });
  console.log('[PeriodAdmin] Llamando a obtenerPeriodosDeEntidad con:', { entityType, entityId });
  
  try {
    // Verificar que el método exista
    if (!this.api.obtenerPeriodosDeEntidad) {
      console.error('[PeriodAdmin] El método obtenerPeriodosDeEntidad NO existe en la API');
      this.toast.error('Error: Método de API no disponible');
      return;
    }
    
    const assignedRes = await this.api.obtenerPeriodosDeEntidad({ entityType, entityId });
    
    console.log('[PeriodAdmin] Respuesta completa de obtenerPeriodosDeEntidad:', assignedRes);
    console.log('[PeriodAdmin] assignedRes.success:', assignedRes?.success);
    console.log('[PeriodAdmin] assignedRes.data:', assignedRes?.data);
    
    this._assignedPeriods = assignedRes?.success ? assignedRes.data : [];
    
    const allRes = await this.api.listarPeriodos();
    this._allPeriods = allRes?.success ? allRes.data : [];
    
    console.log('[PeriodAdmin] Periodos asignados:', this._assignedPeriods);
    console.log('[PeriodAdmin] Todos los periodos:', this._allPeriods);
    
  } catch (error) {
    console.error('[PeriodAdmin] Error cargando periodos:', error);
    this.toast.error('Error al cargar periodos: ' + error.message);
    this._assignedPeriods = [];
    this._allPeriods = [];
  }
}

  _renderList() {
    const listContainer = document.getElementById('period-admin-list');
    if (!listContainer) return;
    
    if (this._assignedPeriods.length === 0) {
      listContainer.className = 'period-admin-list empty';
      listContainer.innerHTML = `
        <p>Esta entidad aún no pertenece a ningún periodo.</p>
      `;
    } else {
      listContainer.className = 'period-admin-list';
      listContainer.innerHTML = this._assignedPeriods.map(period => `
        <div class="period-item" data-period-id="${period.id}">
          <div class="period-item-info">
            <i class="fa-solid fa-check period-item-check"></i>
            <span class="period-item-name">${period.descripcion}</span>
          </div>
          <button class="period-item-remove" data-period-id="${period.id}" title="Eliminar relación">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `).join('');
    }
  }

  _getAvailablePeriods() {
    const assignedIds = this._assignedPeriods.map(p => p.id);
    return this._allPeriods.filter(p => !assignedIds.includes(p.id));
  }

  _getEntityLabel() {
    const { entityType } = this.stateManager.context || {};
    const labels = {
      docente: 'docente',
      alumno: 'alumno',
      ee: 'experiencia educativa'
    };
    return labels[entityType] || 'entidad';
  }

  _bindEvents(signal) {
    // Cerrar
    document.getElementById('btn-close-period-admin')?.addEventListener('click', () => this.close(), { signal });
    document.getElementById('btn-cancel-period-admin')?.addEventListener('click', () => this.close(), { signal });
    
    // Mostrar formulario de agregar
    document.getElementById('btn-show-add-form')?.addEventListener('click', () => this._showAddForm(), { signal });
    
    // Cancelar agregar
    document.getElementById('btn-cancel-add')?.addEventListener('click', () => this._hideAddForm(), { signal });
    
    // Confirmar agregar
    document.getElementById('btn-confirm-add')?.addEventListener('click', () => this._handleAddPeriod(), { signal });
    
    // Eliminar periodo (usando event delegation)
    const listContainer = document.getElementById('period-admin-list');
    if (listContainer) {
      listContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.period-item-remove');
        if (btn) {
          const periodId = btn.dataset.periodId;
          this._handleRemovePeriod(periodId);
        }
      }, { signal });
    }
    
    // Click fuera del modal
    this._dialog.addEventListener('click', (e) => {
      if (e.target === this._dialog) {
        this.close();
      }
    }, { signal });
  }

  _showAddForm() {
    const availablePeriods = this._getAvailablePeriods();
    
    if (availablePeriods.length === 0) {
      this.toast.info('No hay periodos disponibles para asociar');
      return;
    }
    
    const select = document.getElementById('period-add-select');
    select.innerHTML = '<option value="">Seleccionar periodo...</option>' +
      availablePeriods.map(p => `<option value="${p.id}">${p.descripcion}</option>`).join('');
    
    document.getElementById('period-add-form').style.display = 'block';
    document.getElementById('btn-show-add-form').style.display = 'none';
  }

  _hideAddForm() {
    const addForm = document.getElementById('period-add-form');
    const btnShowAdd = document.getElementById('btn-show-add-form');
    
    if (addForm) addForm.style.display = 'none';
    if (btnShowAdd) btnShowAdd.style.display = 'block';
  }

  async _handleAddPeriod() {
    const select = document.getElementById('period-add-select');
    const periodId = select.value;
    
    if (!periodId) {
      this.toast.warning('Seleccione un periodo');
      return;
    }
    
    const { entityType, entityId } = this.stateManager.context || {};
    
    try {
      const res = await this.api.agregarEntidadAPeriodo({ entityType, entityId, periodId });
      
      if (!res?.success) throw new Error(res?.error || 'Error al asociar periodo');
      
      // Recargar datos
      await this._loadData();
      this._renderList();
      
      // Ocultar formulario
      this._hideAddForm();
      
      this.toast.success('Periodo asociado correctamente');
      
    } catch (error) {
      console.error('Error asociando periodo:', error);
      this.toast.error(`Error: ${error.message}`);
    }
  }

  async _handleRemovePeriod(periodId) {
    const period = this._assignedPeriods.find(p => p.id == periodId);
    if (!period) return;
    
    const confirmed = await this.confirm.ask(
      `¿Eliminar relación con ${period.descripcion}?`,
      `Esta acción no eliminará el periodo, solo la relación con esta entidad.`
    );
    
    if (!confirmed) return;
    
    const { entityType, entityId } = this.stateManager.context || {};
    
    try {
      const res = await this.api.removerEntidadDePeriodo({ entityType, entityId, periodId });
      
      if (!res?.success) throw new Error(res?.error || 'Error al eliminar relación');
      
      // Recargar datos
      await this._loadData();
      this._renderList();
      
      this.toast.success('Relación eliminada correctamente');
      
    } catch (error) {
      console.error('Error eliminando periodo:', error);
      this.toast.error(`Error: ${error.message}`);
    }
  }

  async _handleSave() {
    if (this._onSaveCallback) {
      await this._onSaveCallback(this._assignedPeriods);
    }
    this.close();
  }
}