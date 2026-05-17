import { DataTable } from '../components/DataTable/DataTable.js';
import modalSemestreHtml from '../views/partials/modals/modal-semestre.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';

export class SemestreModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
  }

  async init() {
    console.log('[SemestreModule] Sincronizando módulo...');

    if (!document.getElementById('modal-semestre')) {
      const template = document.createElement('div');
      template.innerHTML = modalSemestreHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-semestre');
    }

    await this.waitForDOMReady('tabla-semestres-body');

    if (!this.data || this.data.length === 0) {
      await this.loadData();
    }

    const tbody = document.getElementById('tabla-semestres-body');
    if (!tbody) return;

    if (this.data && this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-semestres-body',
        columns: this.getColumns(),
        expandable: false,
        actions: true,
        onAction: 'semestreModuleInstance.toggleActionMenu(event)'
      });
      this.table.setData(this.data);
    } else {
      this.renderEmptyState();
    }

    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    console.log('[SemestreModule] Inicialización completa');
  }

  async waitForDOMReady(tbodyId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(tbodyId)) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.error(`[SemestreModule] Timeout: tbody "${tbodyId}" no encontrado`);
    return false;
  }

  async loadData() {
    try {
      const res = await window.electronAPI.listarSemestres();
      if (res.success) {
        this.data = res.rows || res.data;
        return true;
      }
      return false;
    } catch (error) {
      console.error('[SemestreModule] Error cargando datos:', error);
      return false;
    }
  }

  getColumns() {
    return [
      { key: 'orden', label: 'Orden', format: (v) => `<strong>${v}</strong>` },
      { key: 'nombre', label: 'Nombre', format: (v) => v.length > 30 ? v.substring(0, 30) + '...' : v },
      { key: 'clave', label: 'Clave', format: (v) => `<span class="badge badge-secondary">${v}</span>` },
      { 
        key: 'estado', 
        label: 'Estado',
        badge: true,
        format: (v) => {
          const map = { activo: { label: 'Activo', class: 'badge-success' }, inactivo: { label: 'Inactivo', class: 'badge-warning' } };
          const m = map[v] || { label: v, class: 'badge-secondary' };
          return `<span class="badge ${m.class}">${m.label}</span>`;
        }
      }
    ];
  }

  setupSearch() {
    const input = document.getElementById('buscador-semestres');
    if (!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { this.table?.setData(this.data); return; }
      const filtered = this.data.filter(item => 
        [item.clave, item.nombre, item.orden].filter(v => v).join(' ').toLowerCase().includes(txt)
      );
      this.table?.setData(filtered);
    });
  }

  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-semestre');
    const modal = document.getElementById('modal-semestre');
    if (!btnNuevo || !modal) return;
    
    btnNuevo.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    const cerrarModal = () => {
      this.formAutosave?.clear();
      this.unsavedGuard = null;
      modal.classList.add('hidden');
    };
    
    modal.querySelector('.btn-close')?.addEventListener('click', cerrarModal);
    modal.querySelector('.btn-cancel')?.addEventListener('click', cerrarModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
    
    const btnSave = modal.querySelector('.btn-primary');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => { e.preventDefault(); await this.saveSemestre(modal); });
    }
  }

  openModal(semestre = null) {
    const modal = document.getElementById('modal-semestre');
    const form = document.getElementById('form-semestre');
    if (!modal || !form) return;
    
    form.reset();
    this.formAutosave = new FormAutosave('form-semestre', 'semestre-form');
    this.unsavedGuard = new UnsavedChangesGuard('#form-semestre');
    
    if (semestre) {
      form.querySelector('[name="orden"]').value = semestre.orden || '';
      form.querySelector('[name="nombre"]').value = semestre.nombre || '';
      form.querySelector('[name="clave"]').value = semestre.clave || '';
    }
    
    modal.classList.remove('hidden');
  }

  async saveSemestre(modal) {
    const form = document.getElementById('form-semestre');
    const datos = {
      id: form.querySelector('[name="id"]')?.value || null,
      orden: parseInt(form.querySelector('[name="orden"]')?.value) || 1,
      nombre: form.querySelector('[name="nombre"]')?.value?.trim(),
      clave: form.querySelector('[name="clave"]')?.value?.trim(),
      estado: 'activo'
    };
    
    if (!datos.nombre || !datos.clave) { alert('Nombre y clave son obligatorios'); return; }
    
    try {
      const res = await window.electronAPI.guardarSemestre(datos);
      if (res.success) {
        this.formAutosave?.clear();
        this.unsavedGuard = null;
        modal.classList.add('hidden');
        await this.loadData();
        this.table?.setData(this.data);
      } else {
        alert(`Error: ${res.error}`);
      }
    } catch (error) {
      console.error('[SemestreModule] Error guardando:', error);
      alert('Error de conexión');
    }
  }

  setupGlobalHelpers() { window.semestreModuleInstance = this; }
  
  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) menu.classList.toggle('hidden');
  }
  
  renderEmptyState() {
    const tbody = document.getElementById('tabla-semestres-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:50px;color:var(--text-muted)">
      <i class="fa-solid fa-layer-group" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
      <p style="margin:0">No hay semestres registrados</p></td></tr>`;
  }
}