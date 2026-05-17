import { DataTable } from '../components/DataTable/DataTable.js';
import modalGeneracionHtml from '../views/partials/modals/modal-generacion.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';

export class GeneracionModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this.planesCache = [];
    this.periodosCache = [];
  }

  async init() {
    console.log('[GeneracionModule] Sincronizando módulo...');

    if (!document.getElementById('modal-generacion')) {
      const template = document.createElement('div');
      template.innerHTML = modalGeneracionHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-generacion');
    }

    await this.waitForDOMReady('tabla-generaciones-body');

    if (!this.data || this.data.length === 0) {
      await this.loadData();
    }

    const tbody = document.getElementById('tabla-generaciones-body');
    if (!tbody) return;

    if (this.data && this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-generaciones-body',
        columns: this.getColumns(),
        expandable: false,
        actions: true,
        onAction: 'generacionModuleInstance.toggleActionMenu(event)'
      });
      this.table.setData(this.data);
    } else {
      this.renderEmptyState();
    }

    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    console.log('[GeneracionModule] Inicialización completa');
  }

  async waitForDOMReady(tbodyId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(tbodyId)) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.error(`[GeneracionModule] Timeout: tbody "${tbodyId}" no encontrado`);
    return false;
  }

  async loadData() {
    try {
      const res = await window.electronAPI.listarGeneraciones();
      if (res.success) {
        this.data = res.rows || res.data;
        return true;
      }
      return false;
    } catch (error) {
      console.error('[GeneracionModule] Error cargando datos:', error);
      return false;
    }
  }

  async loadSelectData() {
    try {
      const [planesRes, periodosRes] = await Promise.all([
        window.electronAPI.listarPlanes(),
        window.electronAPI.listarPeriodos()
      ]);
      if (planesRes.success) this.planesCache = planesRes.rows || planesRes.data;
      if (periodosRes.success) this.periodosCache = periodosRes.rows || periodosRes.data;
    } catch (error) {
      console.error('[GeneracionModule] Error cargando selects:', error);
    }
  }

  getColumns() {
    return [
      { key: 'clave', label: 'Clave', format: (v) => `<strong>${v}</strong>` },
      { key: 'nombre', label: 'Nombre', format: (v) => v.length > 30 ? v.substring(0, 30) + '...' : v },
      { key: 'plan_nombre', label: 'Plan', format: (v) => v || '-' },
      { key: 'periodo_desc', label: 'Periodo', format: (v) => v || '-' },
      { 
        key: 'estado', 
        label: 'Estado',
        badge: true,
        format: (v) => {
          const map = { activa: { label: 'Activa', class: 'badge-success' }, inactiva: { label: 'Inactiva', class: 'badge-warning' } };
          const m = map[v] || { label: v, class: 'badge-secondary' };
          return `<span class="badge ${m.class}">${m.label}</span>`;
        }
      }
    ];
  }

  setupSearch() {
    const input = document.getElementById('buscador-generaciones');
    if (!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { this.table?.setData(this.data); return; }
      const filtered = this.data.filter(item => 
        [item.clave, item.nombre, item.plan_nombre, item.periodo_desc].filter(v => v).join(' ').toLowerCase().includes(txt)
      );
      this.table?.setData(filtered);
    });
  }

  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nueva-generacion');
    const modal = document.getElementById('modal-generacion');
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
      newBtn.addEventListener('click', async (e) => { e.preventDefault(); await this.saveGeneracion(modal); });
    }
  }

  async openModal(generacion = null) {
    const modal = document.getElementById('modal-generacion');
    const form = document.getElementById('form-generacion');
    if (!modal || !form) return;
    
    await this.loadSelectData();
    
    form.reset();
    this.formAutosave = new FormAutosave('form-generacion', 'generacion-form');
    this.unsavedGuard = new UnsavedChangesGuard('#form-generacion');
    
    const planSelect = form.querySelector('[name="plan_id"]');
    const periodoSelect = form.querySelector('[name="periodo_ingreso_id"]');
    
    if (planSelect) {
      planSelect.innerHTML = '<option value="">Seleccionar plan...</option>' + 
        this.planesCache.map(p => `<option value="${p.id}">${p.clave} - ${p.nombre}</option>`).join('');
    }
    if (periodoSelect) {
      periodoSelect.innerHTML = '<option value="">Seleccionar periodo...</option>' + 
        this.periodosCache.map(p => `<option value="${p.id}">${p.clave} - ${p.descripcion}</option>`).join('');
    }
    
    if (generacion) {
      form.querySelector('[name="clave"]').value = generacion.clave || '';
      form.querySelector('[name="nombre"]').value = generacion.nombre || '';
      if (planSelect) planSelect.value = generacion.plan_id || '';
      if (periodoSelect) periodoSelect.value = generacion.periodo_ingreso_id || '';
    }
    
    modal.classList.remove('hidden');
  }

  async saveGeneracion(modal) {
    const form = document.getElementById('form-generacion');
    const datos = {
      id: form.querySelector('[name="id"]')?.value || null,
      clave: form.querySelector('[name="clave"]')?.value?.trim(),
      nombre: form.querySelector('[name="nombre"]')?.value?.trim(),
      plan_id: parseInt(form.querySelector('[name="plan_id"]')?.value) || null,
      periodo_ingreso_id: parseInt(form.querySelector('[name="periodo_ingreso_id"]')?.value) || null,
      estado: 'activa'
    };
    
    if (!datos.clave || !datos.nombre || !datos.plan_id || !datos.periodo_ingreso_id) {
      alert('Todos los campos son obligatorios'); return;
    }
    
    try {
      const res = await window.electronAPI.guardarGeneracion(datos);
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
      console.error('[GeneracionModule] Error guardando:', error);
      alert('Error de conexión');
    }
  }

  setupGlobalHelpers() { window.generacionModuleInstance = this; }
  
  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) menu.classList.toggle('hidden');
  }
  
  renderEmptyState() {
    const tbody = document.getElementById('tabla-generaciones-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:50px;color:var(--text-muted)">
      <i class="fa-solid fa-users" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
      <p style="margin:0">No hay generaciones registradas</p></td></tr>`;
  }
}