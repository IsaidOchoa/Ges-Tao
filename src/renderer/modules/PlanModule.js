// src/renderer/modules/PlanModule.js
// 📍 Arquitectura: Módulo autocontenido para gestión de Planes de Estudio
// ✅ Incluye: UnsavedChangesGuard, FormAutosave, globalConfirm, cleanup explícito

import { DataTable } from '../components/DataTable/DataTable.js';
import modalPlanHtml from '../views/partials/modals/modal-plan.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';

export class PlanModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this._modalInjected = false; // ✅ Track para evitar re-inyección
  }

  // =========================================
  // INICIALIZACIÓN PRINCIPAL
  // =========================================
  async init() {
    console.log('📘 [PlanModule] Sincronizando módulo...');

    // 1. Inyectar modal (solo una vez, gestionado por este módulo)
    this._injectModal();

    // 2. Esperar que el tbody esté listo en el DOM
    await this._waitForDOM('tabla-planes-body');

    // 3. Cargar datos (lazy: solo si está vacío)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [PlanModule] Cargando datos desde IPC...');
      await this._loadData();
    } else {
      console.log('💾 [PlanModule] Usando datos en caché...');
    }

    // 4. Renderizar tabla
    const tbody = document.getElementById('tabla-planes-body');
    if (!tbody) {
      console.error('❌ [PlanModule] tbody no encontrado');
      return;
    }

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-planes-body',
        columns: this._getColumns(),
        actions: true,
        onRowClick: 'planModuleInstance.handleRowClick(event)',
        onAction: 'planModuleInstance.toggleActionMenu(event)'
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Planes renderizada con ${this.data.length} registros`);
    } else {
      this._renderEmptyState();
      console.log('ℹ️ [PlanModule] Sin registros para mostrar');
    }

    // 5. Vincular eventos (siempre, porque el DOM puede haber cambiado)
    this._setupSearch();
    this._setupModalEvents();
    this._setupGlobalHelpers();

    this.initialized = true;
    console.log('✅ [PlanModule] Inicialización completa');
  }

  // =========================================
  // INYECCIÓN DE MODAL (Auto-gestionada)
  // =========================================
  _injectModal() {
    if (this._modalInjected || document.getElementById('modal-plan')) {
      this.modalElement = document.getElementById('modal-plan');
      this._modalInjected = true;
      return;
    }

    const template = document.createElement('div');
    template.innerHTML = modalPlanHtml;
    document.body.appendChild(template.firstElementChild);
    
    this.modalElement = document.getElementById('modal-plan');
    this._modalInjected = true;
    console.log('✅ [PlanModule] Modal inyectado');
  }

  // =========================================
  // UTILIDAD: Esperar elemento en DOM
  // =========================================
  async _waitForDOM(elementId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(elementId)) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.error(`❌ [PlanModule] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarPlanes();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log('📄 [PlanModule] Primer registro:', this.data[0]);
        }
        return true;
      }
      console.warn('⚠️ [PlanModule] Error en respuesta IPC:', res.error);
      return false;
    } catch (error) {
      console.error('❌ [PlanModule] Error cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  _getColumns() {
    return [
      { key: 'clave', label: 'Clave', format: v => `<strong style="font-family:monospace">${v}</strong>` },
      { key: 'nombre', label: 'Nombre' },
      { key: 'nivel', label: 'Nivel' },
      { key: 'estado', label: 'Estado', badge: true }
    ];
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  _setupSearch() {
    const input = document.getElementById('buscador-planes');
    if (!input) return;
    
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { 
        this.table?.setData(this.data); 
        return; 
      }
      
      const filtered = this.data.filter(item => 
        (item.nombre || '').toLowerCase().includes(txt) || 
        (item.clave || '').toLowerCase().includes(txt)
      );
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL (CON CONFIRMACIÓN GLOBAL)
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-plan');
    const modal = this.modalElement;
    
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [PlanModule] Elementos del modal no encontrados');
      return;
    }

    // Abrir modal
    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this._openModal();
    };

    // ✅ Función de cierre ASÍNCRONA con confirmación global
    const intentarCerrar = async () => {
      if (this.unsavedGuard?.hasUnsavedChanges) {
        const confirmado = await globalConfirm.ask('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
        if (!confirmado) return; // Usuario canceló → NO cerrar
      }
      this._ejecutarCierre();
    };

    // ✅ CORRECCIÓN: Usar querySelector por clase para el botón "X"
    this.modalElement?.querySelector('.btn-close')?.addEventListener('click', intentarCerrar);
    document.getElementById('btn-cancelar-plan')?.addEventListener('click', intentarCerrar);
    
    // Click en overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault();
        intentarCerrar();
      }
    });

    // Botón guardar
    const btnSave = document.getElementById('btn-guardar-plan');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._savePlan(modal);
      });
    }
  }

  // ✅ Método privado para ejecutar cierre limpio (reutilizable)
  _ejecutarCierre() {
    // 1. Destruir guard PRIMERO (libera listeners y beforeunload)
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    
    // 2. Limpiar auto-guardado
    this.formAutosave?.clear();
    this.formAutosave = null;
    
    // 3. Resetear formulario
    const form = document.getElementById('form-plan');
    if (form) form.reset();
    
    // 4. Ocultar modal
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // ABRIR MODAL
  // =========================================
  _openModal(plan = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-plan');
    if (!modal || !form) return;

    // ✅ NO resetear si FormAutosave va a restaurar datos (modo nuevo)
    if (!plan) {
      const hasAutosave = localStorage.getItem('autosave:plan-form');
      if (!hasAutosave) {
        form.reset();
      }
    } else {
      // En modo edición, siempre resetear primero
      form.reset();
    }
    
    // ✅ Helper seguro para setear valores (evita errores de null)
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    
    // ✅ Inicializar protecciones (FormAutosave restaura AUTOMÁTICAMENTE en su constructor)
    this.unsavedGuard = new UnsavedChangesGuard('#form-plan');
    this.formAutosave = new FormAutosave('form-plan', 'plan-form');

    if (plan) {
      // Modo edición: precargar datos de BD (sobrescribe cualquier autosave)
      setVal('plan-id', plan.id);
      setVal('plan-clave', plan.clave);
      setVal('plan-nombre', plan.nombre);
      setVal('plan-nivel', plan.nivel);
      setVal('plan-estado', plan.estado || 'vigente');
      
      // Limpiar autosave tras precargar datos reales
      this.formAutosave?.clear();
    } else {
      // Modo nuevo: valores por defecto
      setVal('plan-estado', 'vigente');
    }
    // ✅ En modo nuevo: si hay autosave, ya se restauró en el constructor de FormAutosave
    
    modal.classList.remove('hidden');
    
    // Enfocar primer campo con pequeño delay
    setTimeout(() => document.getElementById('plan-nombre')?.focus(), 100);
  }

  // =========================================
  // GUARDAR PLAN
  // =========================================
  async _savePlan(modal) {
    // ✅ Helper seguro para obtener valores
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    
    const datos = {
      id: getVal('plan-id') ? parseInt(getVal('plan-id')) : null,
      clave: getVal('plan-clave'),
      nombre: getVal('plan-nombre'),
      nivel: document.getElementById('plan-nivel')?.value,
      estado: document.getElementById('plan-estado')?.value || 'vigente'
    };

    // Validaciones obligatorias
    if (!datos.nombre || !datos.nivel) {
      alert('⚠️ Campos obligatorios:\n• Nombre\n• Nivel');
      return;
    }

    try {
      const res = await window.electronAPI.guardarPlan(datos);
      
      if (res.success) {
        // ✅ Limpiar y cerrar tras guardar exitosamente
        this._ejecutarCierre();
        
        // Refrescar tabla
        await this._loadData();
        this.table?.setData(this.data);
      } else {
        alert(`❌ Error: ${res.error || 'No se pudo guardar'}`);
      }
    } catch (error) {
      console.error('💥 Error guardando plan:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  _renderEmptyState() {
    const tbody = document.getElementById('tabla-planes-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding: 40px; color:var(--text-muted)">
          <i class="fa-solid fa-graduation-cap" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
          <p style="margin:0">No hay planes de estudio registrados</p>
        </td>
      </tr>
    `;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() {
    window.planModuleInstance = this;
  }

  // =========================================
  // INTERACCIÓN DE FILAS
  // =========================================
  handleRowClick(event) {
    const row = event.target.closest('.data-row');
    if (!row) return;
    if (event.target.closest('.btn-action-menu') || event.target.closest('.context-menu')) return;
    
    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
  }

  // =========================================
  // MENÚ CONTEXTUAL
  // =========================================
  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) menu.classList.toggle('hidden');
  }

  // =========================================
  // CLEANUP (Para liberar recursos si se destruye el módulo)
  // =========================================
  destroy() {
    // Destruir guard y autosave
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    this.formAutosave?.clear();
    this.formAutosave = null;
    
    // Liberar referencias
    this.modalElement = null;
    this._modalInjected = false;
    this.table = null;
    
    console.log('🧹 [PlanModule] Recursos liberados');
  }
}