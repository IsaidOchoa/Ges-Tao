// src/renderer/modules/PlanModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalPlanHtml from '../views/partials/modals/modal-plan.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';

export class PlanModule {
  constructor() {
    // ✅ Constructor simple, igual que EEModule
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
  }

  // =========================================
  // INICIALIZACIÓN (Patrón idéntico a EEModule)
  // =========================================
  async init() {
    console.log('[PlanModule] Sincronizando módulo...');

    // 1. Inyectar Modal (solo si no existe)
    if (!document.getElementById('modal-plan')) {
      const template = document.createElement('div');
      template.innerHTML = modalPlanHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-plan');
      console.log('Modal Plan inyectado');
    }

    // 2. Esperar que el tbody exista (ID hardcodeado, igual que EEModule)
    await this.waitForDOMReady('tabla-planes-body');

    // 3. Cargar datos SOLO si está vacío (Lazy Load)
    if (!this.data || this.data.length === 0) {
      console.log('[PlanModule] Cargando datos desde IPC...');
      await this.loadData();
    } else {
      console.log('[PlanModule] Usando datos en caché...');
    }

    // 4. Renderizar: Tabla con datos O estado vacío
    const tbody = document.getElementById('tabla-planes-body');
    if (!tbody) {
      console.error('[PlanModule] tbody no encontrado');
      return;
    }

    if (this.data && this.data.length > 0) {
      // ✅ ID hardcodeado directamente, igual que EEModule
      this.table = new DataTable({
        tbodyId: 'tabla-planes-body',
        columns: this.getColumns(),
        expandable: false,
        actions: true,
        onAction: 'planModuleInstance.toggleActionMenu(event)'
      });
      this.table.setData(this.data);
      console.log(`Tabla Planes renderizada con ${this.data.length} registros`);
    } else {
      this.renderEmptyState();
      console.log('[PlanModule] Sin registros para mostrar');
    }

    // 5. Re-vincular eventos (SIEMPRE, porque el DOM es nuevo)
    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    console.log('[PlanModule] Inicialización completa');
  }

  // =========================================
  // UTILIDAD: Esperar tbody (ID hardcodeado)
  // =========================================
  async waitForDOMReady(tbodyId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const tbody = document.getElementById(tbodyId);
      if (tbody) {
        console.log(`[PlanModule] tbody "${tbodyId}" encontrado en DOM`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.error(`[PlanModule] Timeout: tbody "${tbodyId}" no encontrado en ${timeout}ms`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async loadData() {
    try {
      console.log('[PlanModule] Solicitando datos a IPC...');
      const res = await window.electronAPI.listarPlanes();
      
      if (res.success) {
        this.data = res.rows || res.data;
        return true;
      } else {
        console.warn('[PlanModule] Error en respuesta IPC:', res.error);
        return false;
      }
    } catch (error) {
      console.error('[PlanModule] Error crítico cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // COLUMNAS (Adaptar a tus campos)
  // =========================================
  getColumns() {
    return [
      { key: 'clave', label: 'Clave', format: (v) => `<strong>${v}</strong>` },
      { key: 'nombre', label: 'Nombre', format: (v) => v.length > 30 ? v.substring(0, 30) + '...' : v },
      { 
        key: 'nivel', 
        label: 'Nivel',
        format: (v) => {
          const map = { licenciatura: '🎓 Licenciatura', maestria: '🎓 Maestría', doctorado: '🎓 Doctorado' };
          return map[v] || v;
        }
      },
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

  // =========================================
  // BUSCADOR
  // =========================================
  setupSearch() {
    const input = document.getElementById('buscador-planes');
    if (!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { this.table?.setData(this.data); return; }
      const filtered = this.data.filter(item => 
        [item.clave, item.nombre, item.nivel].filter(v => v).join(' ').toLowerCase().includes(txt)
      );
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // MODALES
  // =========================================
  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-plan');
    const modal = document.getElementById('modal-plan');
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
      newBtn.addEventListener('click', async (e) => { e.preventDefault(); await this.savePlan(modal); });
    }
  }

  openModal(plan = null) {
    const modal = document.getElementById('modal-plan');
    const form = document.getElementById('form-plan');
    if (!modal || !form) return;
    form.reset();
    this.formAutosave = new FormAutosave('form-plan', 'plan-form');
    this.unsavedGuard = new UnsavedChangesGuard('#form-plan');
    if (plan) {
      // Modo edición: prellenar
      form.querySelector('[name="clave"]').value = plan.clave || '';
      form.querySelector('[name="nombre"]').value = plan.nombre || '';
      form.querySelector('[name="nivel"]').value = plan.nivel || '';
    } else {
      // Modo nuevo: valores por defecto
      form.querySelector('[name="nivel"]').value = 'licenciatura';
    }
    modal.classList.remove('hidden');
  }

  async savePlan(modal) {
    const form = document.getElementById('form-plan');
    const datos = {
      id: form.querySelector('[name="id"]')?.value || null,
      clave: form.querySelector('[name="clave"]')?.value?.trim(),
      nombre: form.querySelector('[name="nombre"]')?.value?.trim(),
      nivel: form.querySelector('[name="nivel"]')?.value,
      estado: 'activo'
    };
    if (!datos.clave || !datos.nombre) { alert('Clave y nombre son obligatorios'); return; }
    try {
      const res = await window.electronAPI.guardarPlan(datos);
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
      console.error('[PlanModule] Error guardando plan:', error);
      alert('Error de conexión');
    }
  }

  // =========================================
  // UTILIDADES
  // =========================================
  setupGlobalHelpers() { window.planModuleInstance = this; }
  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) menu.classList.toggle('hidden');
  }
  renderEmptyState() {
    const tbody = document.getElementById('tabla-planes-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:50px;color:var(--text-muted)">
      <i class="fa-solid fa-book-open" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
      <p style="margin:0">No hay planes de estudio registrados</p></td></tr>`;
  }
}