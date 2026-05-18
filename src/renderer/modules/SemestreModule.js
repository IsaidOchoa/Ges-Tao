// src/renderer/modules/SemestreModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalSemestreHtml from '../views/partials/modals/modal-semestre.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';

export class SemestreModule {
  constructor() {
    this.data = [];
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
  }

  async init() {
    console.log('📘 [SemestreModule] Sincronizando...');
    if (!document.getElementById('modal-semestre')) {
      const template = document.createElement('div');
      template.innerHTML = modalSemestreHtml;
      document.body.appendChild(template.firstElementChild);
    }

    await this.waitForDOMReady('tabla-semestres-body');
    if (!this.data.length) await this.loadData();

    const tbody = document.getElementById('tabla-semestres-body');
    if (!tbody) return;

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-semestres-body',
        columns: [
          { key: 'orden', label: 'Orden' },
          { key: 'nombre', label: 'Nombre' },
          { key: 'clave', label: 'Clave' },
          { key: 'estado', label: 'Estado', badge: true }
        ],
        actions: true,
        onRowClick: 'semestreModuleInstance.handleRowClick(event)',
        onAction: 'semestreModuleInstance.toggleActionMenu(event)'
      });
      this.table.setData(this.data);
    } else { this.renderEmptyState(); }

    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();
    console.log('✅ [SemestreModule] Listo');
  }

  async waitForDOMReady(id) { for(let i=0;i<40;i++){ if(document.getElementById(id)) return true; await new Promise(r=>setTimeout(r,50)); } return false; }
  async loadData() { try { const res = await window.electronAPI.listarSemestres(); if(res.success) this.data = res.rows || res.data; } catch(e){ console.error(e); } }
  
  setupSearch() {
    const input = document.getElementById('buscador-semestres');
    if(!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', e => {
      const t = e.target.value.toLowerCase();
      this.table?.setData(t ? this.data.filter(i => i.nombre?.toLowerCase().includes(t)) : this.data);
    });
  }

  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-semestre');
    const modal = document.getElementById('modal-semestre');
    if (!btnNuevo || !modal) return;

    btnNuevo.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    // ✅ Función de cierre DEFERIDA para evitar violation warnings
    const intentarCerrar = () => {
      // 1. Verificar si hay cambios SIN bloquear el hilo
      if (this.unsavedGuard?.hasUnsavedChanges) {
        // ✅ Deferir confirm() con setTimeout para liberar el event loop
        setTimeout(() => {
          // Verificar que el guard aún existe (por si se cerró mientras tanto)
          if (!this.unsavedGuard?.hasUnsavedChanges) return;
          
          const confirmado = confirm('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
          
          // ✅ Usar requestAnimationFrame para manipulación del DOM (evita reflow forzado)
          requestAnimationFrame(() => {
            if (confirmado) {
              this._ejecutarCierre(modal);
            }
            // Si canceló: no hacer nada, el modal permanece abierto
          });
        }, 0); // 0ms = next tick, libera el handler actual
        return; // ⚠️ Salir inmediatamente para no ejecutar cierre dos veces
      }
      
      // Sin cambios: cerrar directamente
      this._ejecutarCierre(modal);
    };

    // ✅ Método privado para ejecutar el cierre (reutilizable)
    this._ejecutarCierre = (modal) => {
      // 1. Destruir guard PRIMERO (libera listeners y beforeunload)
      this.unsavedGuard?.destroy();
      this.unsavedGuard = null;
      
      // 2. Limpiar auto-guardado
      this.formAutosave?.clear?.();
      this.formAutosave = null;
      
      // 3. Resetear formulario
      document.getElementById('form-semestre')?.reset();
      
      // 4. Ocultar modal (al final, con transición suave)
      modal.classList.add('hidden');
      
      // 5. Liberar foco explícitamente (evita bloqueo de input)
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };

    // Vincular eventos
    document.getElementById('btn-cerrar-modal-semestre')?.addEventListener('click', intentarCerrar);
    document.getElementById('btn-cancelar-semestre')?.addEventListener('click', intentarCerrar);
    
    // Click fuera del modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault(); // ✅ Prevenir comportamiento default
        e.stopPropagation(); // ✅ Evitar propagación a otros handlers
        intentarCerrar();
      }
    }, true); // ✅ Usar fase de captura para prioridad

    // Guardar
    const btnSave = document.getElementById('btn-guardar-semestre');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.save(modal, () => this._ejecutarCierre(modal));
      });
    }
  }

  openModal(semestre = null) {
    const modal = document.getElementById('modal-semestre');
    const form = document.getElementById('form-semestre');
    if (!modal || !form) return;
    
    form.reset();
    
    // Helper seguro para setear valores
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    
    // Inicializar guard y autosave
    this.unsavedGuard = new UnsavedChangesGuard('#form-semestre');
    this.formAutosave = new FormAutosave('form-semestre', 'semestre-form');

    if (semestre) {
      setVal('semestre-id', semestre.id);
      setVal('semestre-orden', semestre.orden);
      setVal('semestre-nombre', semestre.nombre);
      setVal('semestre-clave', semestre.clave);
      setVal('semestre-estado', semestre.estado);
    } else {
      setVal('semestre-estado', 'activo');
    }
    
    modal.classList.remove('hidden');
    
    // Enfocar con delay para evitar conflicto con transiciones
    setTimeout(() => {
      document.getElementById('semestre-orden')?.focus();
    }, 150);
  }

  async save(modal, onClose) {
    const datos = {
      id: document.getElementById('semestre-id')?.value || null,
      orden: parseInt(document.getElementById('semestre-orden')?.value),
      nombre: document.getElementById('semestre-nombre')?.value?.trim(),
      clave: document.getElementById('semestre-clave')?.value?.trim(),
      estado: document.getElementById('semestre-estado')?.value
    };
    if(!datos.nombre || !datos.clave) return alert('Nombre y Clave son obligatorios');

    try {
      const res = await window.electronAPI.guardarSemestre(datos);
      if(res.success) {
        onClose();
        await this.loadData();
        this.table?.setData(this.data);
      } else alert(`Error: ${res.error}`);
    } catch(e) { console.error(e); alert('Error'); }
  }

  setupGlobalHelpers() { window.semestreModuleInstance = this; }
  
  handleRowClick(e) { const r = e.target.closest('.data-row'); if(!r||e.target.closest('.action-icon-container')) return; document.querySelectorAll('.data-row.selected').forEach(x=>x.classList.remove('selected')); r.classList.add('selected'); }
  toggleActionMenu(e) { e.stopPropagation(); document.querySelectorAll('.context-menu').forEach(m=>m.classList.add('hidden')); const m = e.target.closest('.action-icon-container')?.previousElementSibling; if(m?.classList.contains('context-menu')) m.classList.toggle('hidden'); }
  renderEmptyState() { document.getElementById('tabla-semestres-body').innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted)">No hay semestres registrados</td></tr>'; }
}