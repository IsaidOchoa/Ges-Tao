// src/renderer/modules/GeneracionModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalGeneracionHtml from '../views/partials/modals/modal-generacion.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';

export class GeneracionModule {
  constructor() {
    this.data = [];
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this.cachedSelectData = null;
  }

  async init() {
    console.log('📘 [GeneracionModule] Sincronizando...');
    if (!document.getElementById('modal-generacion')) {
      const template = document.createElement('div');
      template.innerHTML = modalGeneracionHtml;
      document.body.appendChild(template.firstElementChild);
    }

    await this.waitForDOMReady('tabla-generaciones-body');
    
    // Cargar datos para selects (Plan, Periodo)
    if(!this.cachedSelectData) await this.loadSelectData();
    
    if (!this.data.length) await this.loadData();

    const tbody = document.getElementById('tabla-generaciones-body');
    if (!tbody) return;

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-generaciones-body',
        columns: [
          { key: 'clave', label: 'Clave' },
          { key: 'nombre', label: 'Nombre' },
          { key: 'plan', label: 'Plan' },
          { key: 'periodo_ingreso', label: 'Ingreso' },
          { key: 'estado', label: 'Estado', badge: true }
        ],
        actions: true,
        onRowClick: 'generacionModuleInstance.handleRowClick(event)',
        onAction: 'generacionModuleInstance.toggleActionMenu(event)'
      });
      this.table.setData(this.data);
    } else { this.renderEmptyState(); }

    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();
    console.log('✅ [GeneracionModule] Listo');
  }

  async waitForDOMReady(id) { for(let i=0;i<40;i++){ if(document.getElementById(id)) return true; await new Promise(r=>setTimeout(r,50)); } return false; }
  
  async loadData() { try { const res = await window.electronAPI.listarGeneraciones(); if(res.success) this.data = res.rows || res.data; } catch(e){ console.error(e); } }
  
  async loadSelectData() {
    try {
      // Asumiendo que existe un endpoint para obtener datos de selects
      // Si no, ajusta esto a tu lógica real
      const res = await window.electronAPI.obtenerDatosSelectsGeneracion();
      if(res.success) this.cachedSelectData = res.data;
    } catch(e){ console.error(e); }
  }

  setupSearch() {
    const input = document.getElementById('buscador-generaciones');
    if(!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', e => {
      const t = e.target.value.toLowerCase();
      this.table?.setData(t ? this.data.filter(i => i.nombre?.toLowerCase().includes(t)) : this.data);
    });
  }

  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nueva-generacion');
    const modal = document.getElementById('modal-generacion');
    if (!btnNuevo || !modal) return;

    btnNuevo.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    const cerrar = () => {
      this.formAutosave?.clear();
      this.unsavedGuard = null;
      document.getElementById('form-generacion')?.reset();
      modal.classList.add('hidden');
    };

    document.getElementById('btn-cerrar-modal-generacion')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-generacion')?.addEventListener('click', cerrar);
    modal.addEventListener('click', e => { if(e.target === modal) cerrar(); });

    const btnSave = document.getElementById('btn-guardar-generacion');
    if(btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async e => { e.preventDefault(); await this.save(modal, cerrar); });
    }
  }

  openModal(gen = null) {
    const modal = document.getElementById('modal-generacion');
    const form = document.getElementById('form-generacion');
    if(!modal || !form) return;
    
    form.reset();
    document.getElementById('generacion-id').value = '';
    this.formAutosave = new FormAutosave('form-generacion', 'generacion-form');
    this.unsavedGuard = new UnsavedChangesGuard('#form-generacion');

    // Llenar selects si hay datos cacheados
    if(this.cachedSelectData) {
       const planSel = document.getElementById('generacion-plan');
       if(planSel && this.cachedSelectData.planes) {
         planSel.innerHTML = '<option value="">Seleccionar...</option>' + this.cachedSelectData.planes.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
       }
       const perSel = document.getElementById('generacion-periodo');
       if(perSel && this.cachedSelectData.periodos) {
         perSel.innerHTML = '<option value="">Seleccionar...</option>' + this.cachedSelectData.periodos.map(p => `<option value="${p.id}">${p.clave}</option>`).join('');
       }
    }

    if(gen) {
      document.getElementById('generacion-id').value = gen.id;
      document.getElementById('generacion-clave').value = gen.clave;
      document.getElementById('generacion-nombre').value = gen.nombre;
      document.getElementById('generacion-plan').value = gen.plan;
      document.getElementById('generacion-periodo').value = gen.periodo_ingreso;
      document.getElementById('generacion-estado').value = gen.estado;
    } else {
      document.getElementById('generacion-estado').value = 'activa';
    }
    modal.classList.remove('hidden');
  }

  async save(modal, onClose) {
    const datos = {
      id: document.getElementById('generacion-id')?.value || null,
      clave: document.getElementById('generacion-clave')?.value?.trim(),
      nombre: document.getElementById('generacion-nombre')?.value?.trim(),
      plan: document.getElementById('generacion-plan')?.value,
      periodo_ingreso: document.getElementById('generacion-periodo')?.value,
      estado: document.getElementById('generacion-estado')?.value
    };
    if(!datos.nombre || !datos.plan) return alert('Nombre y Plan son obligatorios');

    try {
      const res = await window.electronAPI.guardarGeneracion(datos);
      if(res.success) {
        onClose();
        await this.loadData();
        this.table?.setData(this.data);
      } else alert(`Error: ${res.error}`);
    } catch(e) { console.error(e); alert('Error'); }
  }

  setupGlobalHelpers() { window.generacionModuleInstance = this; }
  
  handleRowClick(e) { const r = e.target.closest('.data-row'); if(!r||e.target.closest('.action-icon-container')) return; document.querySelectorAll('.data-row.selected').forEach(x=>x.classList.remove('selected')); r.classList.add('selected'); }
  toggleActionMenu(e) { e.stopPropagation(); document.querySelectorAll('.context-menu').forEach(m=>m.classList.add('hidden')); const m = e.target.closest('.action-icon-container')?.previousElementSibling; if(m?.classList.contains('context-menu')) m.classList.toggle('hidden'); }
  renderEmptyState() { document.getElementById('tabla-generaciones-body').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No hay generaciones registradas</td></tr>'; }
}