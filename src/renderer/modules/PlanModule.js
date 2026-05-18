// src/renderer/modules/PlanModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalPlanHtml from '../views/partials/modals/modal-plan.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';

export class PlanModule {
  constructor() {
    this.data = [];
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
  }

  async init() {
    console.log('📘 [PlanModule] Sincronizando...');
    
    // 1. Inyectar Modal
    if (!document.getElementById('modal-plan')) {
      const template = document.createElement('div');
      template.innerHTML = modalPlanHtml;
      document.body.appendChild(template.firstElementChild);
    }

    // 2. Esperar DOM
    await this.waitForDOMReady('tabla-planes-body');

    // 3. Cargar Datos
    if (!this.data.length) await this.loadData();

    // 4. Renderizar Tabla
    const tbody = document.getElementById('tabla-planes-body');
    if (!tbody) return;

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-planes-body',
        columns: this.getColumns(),
        actions: true,
        onRowClick: 'planModuleInstance.handleRowClick(event)',
        onAction: 'planModuleInstance.toggleActionMenu(event)'
      });
      this.table.setData(this.data);
    } else {
      this.renderEmptyState();
    }

    // 5. Vincular Eventos
    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();
    console.log('✅ [PlanModule] Listo');
  }

  async waitForDOMReady(id) {
    for (let i = 0; i < 40; i++) {
      if (document.getElementById(id)) return true;
      await new Promise(r => setTimeout(r, 50));
    }
    return false;
  }

  async loadData() {
    try {
      const res = await window.electronAPI.listarPlanes();
      if (res.success) this.data = res.rows || res.data;
    } catch (e) { console.error('Error cargando planes:', e); }
  }

  getColumns() {
    return [
      { key: 'clave', label: 'Clave', format: v => `<strong style="font-family:monospace">${v}</strong>` },
      { key: 'nombre', label: 'Nombre' },
      { key: 'nivel', label: 'Nivel' },
      { key: 'estado', label: 'Estado', badge: true }
    ];
  }

  setupSearch() {
    const input = document.getElementById('buscador-planes');
    if (!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase();
      this.table?.setData(txt ? this.data.filter(i => i.nombre?.toLowerCase().includes(txt) || i.clave?.toLowerCase().includes(txt)) : this.data);
    });
  }

  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-plan');
    const modal = document.getElementById('modal-plan');
    if (!btnNuevo || !modal) return;

    // Abrir
    btnNuevo.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    // Función de cierre segura (Evita congelamiento)
    const cerrarModal = () => {
      // 1. Limpiar recursos primero
      this.formAutosave?.clear();
      this.unsavedGuard = null;
      
      // 2. Resetear formulario
      const form = document.getElementById('form-plan');
      if (form) form.reset();
      
      // 3. Ocultar modal al final
      modal.classList.add('hidden');
    };

    document.getElementById('btn-cerrar-modal-plan')?.addEventListener('click', cerrarModal);
    document.getElementById('btn-cancelar-plan')?.addEventListener('click', cerrarModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });

    // Guardar
    const btnSave = document.getElementById('btn-guardar-plan');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.savePlan(modal, cerrarModal);
      });
    }
  }

  openModal(plan = null) {
    const modal = document.getElementById('modal-plan');
    const form = document.getElementById('form-plan');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('plan-id').value = '';

    // Activar protecciones
    this.formAutosave = new FormAutosave('form-plan', 'plan-form');
    this.unsavedGuard = new UnsavedChangesGuard('#form-plan');

    if (plan) {
      document.getElementById('plan-id').value = plan.id || '';
      document.getElementById('plan-clave').value = plan.clave || '';
      document.getElementById('plan-nombre').value = plan.nombre || '';
      document.getElementById('plan-nivel').value = plan.nivel || '';
      document.getElementById('plan-estado').value = plan.estado || 'vigente';
    } else {
      document.getElementById('plan-estado').value = 'vigente';
    }

    modal.classList.remove('hidden');
    document.getElementById('plan-nombre')?.focus();
  }

  async savePlan(modal, onClose) {
    const datos = {
      id: document.getElementById('plan-id')?.value || null,
      clave: document.getElementById('plan-clave')?.value?.trim(),
      nombre: document.getElementById('plan-nombre')?.value?.trim(),
      nivel: document.getElementById('plan-nivel')?.value,
      estado: document.getElementById('plan-estado')?.value || 'vigente'
    };

    if (!datos.nombre || !datos.nivel) { alert('Nombre y Nivel son obligatorios'); return; }

    try {
      const res = await window.electronAPI.guardarPlan(datos);
      if (res.success) {
        // Limpiar y cerrar
        onClose(); 
        await this.loadData();
        this.table?.setData(this.data);
      } else {
        alert(`Error: ${res.error}`);
      }
    } catch (error) { console.error(error); alert('Error de conexión'); }
  }

  setupGlobalHelpers() { window.planModuleInstance = this; }

  handleRowClick(e) {
    const row = e.target.closest('.data-row');
    if (!row || e.target.closest('.action-icon-container')) return;
    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
  }

  toggleActionMenu(e) {
    e.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    const menu = e.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) menu.classList.toggle('hidden');
  }

  renderEmptyState() {
    document.getElementById('tabla-planes-body').innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">No hay planes registrados</td></tr>`;
  }
}