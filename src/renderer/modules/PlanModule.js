// src/renderer/modules/PlanModule.js

import { DataTable } from '../components/DataTable/DataTable.js';
import { waitForDOMReady } from '../utils/uiHelpers.js';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';

export default class PlanModule {
  constructor(config = {}) {
    this.tbodyId = config.tbodyId || 'tbody-planes';
    this.modalId = config.modalId || 'modal-plan';
    this.formId = config.formId || 'form-plan';
    this.searchInputId = config.searchInputId || 'search-planes';
    
    this.data = [];
    this.filteredData = [];
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this.editingId = null;
    
    // Exponer instancia global para onclicks en HTML inyectado
    window.PlanModuleInstance = this;
  }

  async init() {
    console.log('[PlanModule] Iniciando...');
    await waitForDOMReady();
    await this._loadData();
    this._renderTable();
    this._bindEvents();
    this._initUtilities();
    console.log('[PlanModule] ✅ Inicializado');
  }

  async _loadData() {
    try {
      // 🔄 Llamada directa a IPC (sin servicio intermedio)
      const response = await window.api.ipc.invoke('obtener-planes');
      if (response.success) {
        this.data = response.data;
        this._applySearchFilter();
      } else {
        console.error('[PlanModule] Error:', response.error);
        this.data = [];
        this.filteredData = [];
      }
    } catch (error) {
      console.error('[PlanModule] Excepción:', error);
      this.data = [];
      this.filteredData = [];
    }
  }

  _renderTable() {
    const tbody = document.getElementById(this.tbodyId);
    const emptyState = document.getElementById('empty-planes');
    
    if (!tbody) return;
    
    if (emptyState) {
      emptyState.classList.toggle('hidden', this.filteredData.length > 0);
    }
    
    if (this.filteredData.length === 0) {
      tbody.innerHTML = '';
      return;
    }
    
    if (!this.table) {
      this.table = new DataTable({
        tbodyId: this.tbodyId,
        columns: this.getColumns(),
        expandable: false,
        actions: true,
        onAction: `window.PlanModuleInstance?.showContextMenu(event)`
      });
    }
    this.table.setData(this.filteredData);
  }

  getColumns() {
    return [
      { key: 'clave', title: 'Clave', format: (val) => `<strong>${val || '-'}</strong>` },
      { 
        key: 'nombre', 
        title: 'Nombre',
        format: (val) => val?.length > 40 ? `${val.substring(0, 37)}...` : val || '-'
      },
      { 
        key: 'nivel', 
        title: 'Nivel',
        format: (val) => {
          const map = { 
            licenciatura: '🎓 Lic.', 
            maestria: '🎓 Maest.', 
            doctorado: '🎓 Doc.',
            especialidad: '🎓 Esp.'
          };
          return map[val] || val || '-';
        }
      },
      { key: 'estado', title: 'Estado' } // Se renderiza como status-dot automáticamente
    ];
  }

  setupSearch() {
    const searchInput = document.getElementById(this.searchInputId);
    const clearBtn = document.getElementById('btn-clear-search-planes');
    
    if (!searchInput) return;
    
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    
    newInput.addEventListener('input', (e) => {
      this._applySearchFilter(e.target.value.toLowerCase());
      this._renderTable();
      if (clearBtn) clearBtn.classList.toggle('hidden', !e.target.value);
    });
    
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        newInput.value = '';
        this._applySearchFilter('');
        this._renderTable();
        clearBtn.classList.add('hidden');
        newInput.focus();
      });
    }
  }

  _applySearchFilter(term = '') {
    if (!term) {
      this.filteredData = [...this.data];
      return;
    }
    this.filteredData = this.data.filter(item => 
      item.clave?.toLowerCase().includes(term) ||
      item.nombre?.toLowerCase().includes(term) ||
      item.nivel?.toLowerCase().includes(term) ||
      item.estado?.toLowerCase().includes(term)
    );
  }

  _bindEvents() {
    const newBtn = document.getElementById('btn-new-plan');
    if (newBtn) newBtn.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    const emptyNewBtn = document.getElementById('btn-empty-new-plan');
    if (emptyNewBtn) emptyNewBtn.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    this.setupSearch();
    this.setupModalEvents();
  }

  _initUtilities() {
    this.formAutosave = new FormAutosave(this.formId, { debounceMs: 2000, maxAgeHours: 24 });
    this.unsavedGuard = new UnsavedChangesGuard(this.formId, { preventTabClose: true });
  }

  setupModalEvents() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;
    
    modal.querySelector('.modal-close')?.addEventListener('click', () => this.closeModal());
    modal.querySelector('.btn-cancel')?.addEventListener('click', (e) => { e.preventDefault(); this.closeModal(); });
    
    const form = document.getElementById(this.formId);
    if (form) {
      form.onsubmit = async (e) => { e.preventDefault(); await this.savePlan(); };
    }
    
    modal.onclick = (e) => { if (e.target === modal) this.closeModal(); };
  }

  openModal(plan = null) {
    const modal = document.getElementById(this.modalId);
    const form = document.getElementById(this.formId);
    const title = document.getElementById('modal-plan-title');
    
    if (!modal || !form) return;
    
    form.reset();
    this.formAutosave?.clear();
    this.unsavedGuard?.reset();
    
    if (plan) {
      this.editingId = plan.id;
      title.textContent = 'Editar Plan de Estudio';
      form.querySelector('[name="clave"]').value = plan.clave || '';
      form.querySelector('[name="nombre"]').value = plan.nombre || '';
      form.querySelector('[name="nivel"]').value = plan.nivel || '';
      form.querySelector('[name="estado"]').value = plan.estado || 'activo';
    } else {
      this.editingId = null;
      title.textContent = 'Nuevo Plan de Estudio';
      form.querySelector('[name="estado"]').value = 'activo';
    }
    
    modal.classList.remove('hidden');
    this.formAutosave?.start();
    this.unsavedGuard?.enable();
  }

  closeModal() {
    const modal = document.getElementById(this.modalId);
    if (!modal) return;
    
    this.formAutosave?.stop();
    this.unsavedGuard?.disable();
    modal.classList.add('hidden');
    this.editingId = null;
  }

  async savePlan() {
    const form = document.getElementById(this.formId);
    if (!form) return;
    
    const clave = form.querySelector('[name="clave"]').value.trim();
    const nombre = form.querySelector('[name="nombre"]').value.trim();
    const nivel = form.querySelector('[name="nivel"]').value;
    
    if (!clave || !nombre || !nivel) {
      this._showToast('error', 'Clave, nombre y nivel son obligatorios.');
      return;
    }
    
    const payload = {
      id: this.editingId,
      clave,
      nombre,
      nivel,
      estado: form.querySelector('[name="estado"]').value
    };
    
    try {
      const saveBtn = document.getElementById('btn-save-plan');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
      }
      
      // 🔄 Llamada directa a IPC
      const response = await window.api.ipc.invoke('guardar-plan', payload);
      
      if (response.success) {
        this.formAutosave?.clear();
        this.unsavedGuard?.reset();
        this.closeModal();
        await this._loadData();
        this._renderTable();
        this._showToast('success', `Plan ${this.editingId ? 'actualizado' : 'creado'} exitosamente.`);
      } else {
        this._showToast('error', response.error || 'Error al guardar.');
      }
    } catch (error) {
      console.error('[PlanModule] Error en savePlan:', error);
      this._showToast('error', 'Error de conexión.');
    } finally {
      const saveBtn = document.getElementById('btn-save-plan');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Guardar Plan';
      }
    }
  }

  showContextMenu(event) {
    const row = event.target.closest('tr.data-row');
    if (!row) return;
    
    const id = row.dataset.id;
    const estado = row.dataset.estado;
    const plan = this.data.find(p => p.id == id);
    if (!plan) return;
    
    const nuevoEstado = estado === 'activo' ? 'inactivo' : 'activo';
    if (confirm(`¿Cambiar estado de "${plan.clave}" a "${nuevoEstado}"?`)) {
      this._toggleEstado(plan.id, nuevoEstado);
    }
  }

  async _toggleEstado(id, nuevoEstado) {
    try {
      const response = await window.api.ipc.invoke('cambiar-estado-plan', id, nuevoEstado);
      if (response.success) {
        await this._loadData();
        this._renderTable();
        this._showToast('success', 'Estado actualizado.');
      } else {
        this._showToast('error', response.error);
      }
    } catch (error) {
      console.error('[PlanModule] Error:', error);
      this._showToast('error', 'Error al actualizar estado.');
    }
  }

  _showToast(type, message) {
    if (window.Toast) {
      window.Toast[type](message);
      return;
    }
    alert(`${type.toUpperCase()}: ${message}`);
  }
}