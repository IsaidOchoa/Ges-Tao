// src/renderer/modules/GeneracionModule.js
// 📍 Arquitectura: Módulo autocontenido para gestión de Generaciones
// ✅ Incluye: UnsavedChangesGuard, FormAutosave, globalConfirm, cleanup explícito
// 🔄 Manejo especial de selects dinámicos (plan, periodo)

import { DataTable } from '../components/DataTable/DataTable.js';
import modalGeneracionHtml from '../views/partials/modals/modal-generacion.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';

export class GeneracionModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this.cachedSelectData = null;
    this._modalInjected = false; // ✅ Track para evitar re-inyección
  }

  // =========================================
  // INICIALIZACIÓN PRINCIPAL
  // =========================================
  async init() {
    console.log('📘 [GeneracionModule] Sincronizando módulo...');

    // 1. Inyectar modal (solo una vez, gestionado por este módulo)
    this._injectModal();

    // 2. Esperar que el tbody esté listo en el DOM
    await this._waitForDOM('tabla-generaciones-body');

    // 3. Cargar datos para selects (plan, periodo) - solo una vez
    if (!this.cachedSelectData) {
      console.log('📡 [GeneracionModule] Cargando datos para selects...');
      await this._loadSelectData();
    }

    // 4. Cargar datos de la tabla (lazy: solo si está vacío)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [GeneracionModule] Cargando datos desde IPC...');
      await this._loadData();
    } else {
      console.log('💾 [GeneracionModule] Usando datos en caché...');
    }

    // 5. Renderizar tabla
    const tbody = document.getElementById('tabla-generaciones-body');
    if (!tbody) {
      console.error('❌ [GeneracionModule] tbody no encontrado');
      return;
    }

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-generaciones-body',
        columns: this._getColumns(),
        actions: true,
        onRowClick: 'generacionModuleInstance.handleRowClick(event)',
        onAction: 'generacionModuleInstance.toggleActionMenu(event)'
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Generaciones renderizada con ${this.data.length} registros`);
    } else {
      this._renderEmptyState();
      console.log('ℹ️ [GeneracionModule] Sin registros para mostrar');
    }

    // 6. Vincular eventos (siempre, porque el DOM puede haber cambiado)
    this._setupSearch();
    this._setupModalEvents();
    this._setupGlobalHelpers();

    this.initialized = true;
    console.log('✅ [GeneracionModule] Inicialización completa');
  }

  // =========================================
  // INYECCIÓN DE MODAL (Auto-gestionada)
  // =========================================
  _injectModal() {
    if (this._modalInjected || document.getElementById('modal-generacion')) {
      this.modalElement = document.getElementById('modal-generacion');
      this._modalInjected = true;
      return;
    }

    const template = document.createElement('div');
    template.innerHTML = modalGeneracionHtml;
    document.body.appendChild(template.firstElementChild);
    
    this.modalElement = document.getElementById('modal-generacion');
    this._modalInjected = true;
    console.log('✅ [GeneracionModule] Modal inyectado');
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
    console.error(`❌ [GeneracionModule] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS: Tabla principal
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarGeneraciones();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log('📄 [GeneracionModule] Primer registro:', this.data[0]);
        }
        return true;
      }
      console.warn('⚠️ [GeneracionModule] Error en respuesta IPC:', res.error);
      return false;
    } catch (error) {
      console.error('❌ [GeneracionModule] Error cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CAPA DE DATOS: Selects dinámicos (Plan, Periodo)
  // =========================================
  async _loadSelectData() {
    try {
      // Ajusta este endpoint a tu implementación real del backend
      const res = await window.electronAPI.obtenerDatosSelectsGeneracion?.();
      if (res?.success) {
        this.cachedSelectData = res.data;
        console.log('✅ [GeneracionModule] Datos para selects cargados');
        return true;
      }
      // Fallback: intentar cargar por separado si el endpoint combinado no existe
      const [planes, periodos] = await Promise.all([
        window.electronAPI.listarPlanes?.(),
        window.electronAPI.listarPeriodos?.()
      ]);
      this.cachedSelectData = {
        planes: planes?.success ? planes.rows || planes.data : [],
        periodos: periodos?.success ? periodos.rows || periodos.data : []
      };
      console.log('✅ [GeneracionModule] Datos para selects cargados (fallback)');
      return true;
    } catch (error) {
      console.warn('⚠️ [GeneracionModule] No se pudieron cargar datos para selects:', error);
      this.cachedSelectData = { planes: [], periodos: [] };
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  _getColumns() {
    return [
      { key: 'clave', label: 'Clave' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'plan', label: 'Plan' },
      { key: 'periodo_ingreso', label: 'Ingreso' },
      { key: 'estado', label: 'Estado', badge: true }
    ];
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  _setupSearch() {
    const input = document.getElementById('buscador-generaciones');
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
        (item.clave || '').toLowerCase().includes(txt) ||
        (item.plan || '').toLowerCase().includes(txt)
      );
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL (CON CONFIRMACIÓN GLOBAL)
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nueva-generacion');
    const modal = this.modalElement;
    
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [GeneracionModule] Elementos del modal no encontrados');
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
    document.getElementById('btn-cancelar-generacion')?.addEventListener('click', intentarCerrar);
    
    // Click en overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault();
        intentarCerrar();
      }
    });

    // Botón guardar
    const btnSave = document.getElementById('btn-guardar-generacion');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._saveGeneracion(modal);
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
    const form = document.getElementById('form-generacion');
    if (form) form.reset();
    
    // 4. Ocultar modal
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // ABRIR MODAL (con manejo especial de selects)
  // =========================================
  _openModal(gen = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-generacion');
    if (!modal || !form) return;

    // ✅ NO resetear si FormAutosave va a restaurar datos (modo nuevo)
    if (!gen) {
      const hasAutosave = localStorage.getItem('autosave:generacion-form');
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
    this.unsavedGuard = new UnsavedChangesGuard('#form-generacion');
    this.formAutosave = new FormAutosave('form-generacion', 'generacion-form');

    // ✅ Llenar selects dinámicos (siempre, para modo nuevo y edición)
    this._populateSelects();

    if (gen) {
      // Modo edición: precargar datos de BD (sobrescribe cualquier autosave)
      setVal('generacion-id', gen.id);
      setVal('generacion-clave', gen.clave);
      setVal('generacion-nombre', gen.nombre);
      setVal('generacion-plan', gen.plan);
      setVal('generacion-periodo', gen.periodo_ingreso);
      setVal('generacion-estado', gen.estado || 'activa');
      
      // Limpiar autosave tras precargar datos reales
      this.formAutosave?.clear();
    } else {
      // Modo nuevo: valores por defecto
      setVal('generacion-estado', 'activa');
    }
    // ✅ En modo nuevo: si hay autosave, ya se restauró en el constructor de FormAutosave
    
    modal.classList.remove('hidden');
    
    // Enfocar primer campo con pequeño delay
    setTimeout(() => document.getElementById('generacion-nombre')?.focus(), 100);
  }

  // ✅ Método privado para poblar selects dinámicos
  _populateSelects() {
    if (!this.cachedSelectData) return;
    
    // Poblar select de Planes
    const planSel = document.getElementById('generacion-plan');
    if (planSel && this.cachedSelectData.planes) {
      const currentVal = planSel.value; // Guardar valor actual si existe
      planSel.innerHTML = '<option value="">Seleccionar...</option>' + 
        this.cachedSelectData.planes.map(p => 
          `<option value="${p.id}">${p.nombre}</option>`
        ).join('');
      if (currentVal) planSel.value = currentVal; // Restaurar valor si existía
    }
    
    // Poblar select de Periodos
    const perSel = document.getElementById('generacion-periodo');
    if (perSel && this.cachedSelectData.periodos) {
      const currentVal = perSel.value;
      perSel.innerHTML = '<option value="">Seleccionar...</option>' + 
        this.cachedSelectData.periodos.map(p => 
          `<option value="${p.id}">${p.clave}</option>`
        ).join('');
      if (currentVal) perSel.value = currentVal;
    }
  }

  // =========================================
  // GUARDAR GENERACIÓN
  // =========================================
  async _saveGeneracion(modal) {
    // ✅ Helper seguro para obtener valores
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    
    const nombre = getVal('generacion-nombre');
    const plan = getVal('generacion-plan');
    
    // Validaciones obligatorias
    if (!nombre || !plan) {
      alert('⚠️ Campos obligatorios:\n• Nombre\n• Plan de Estudio');
      return;
    }

    const datos = {
      id: getVal('generacion-id') ? parseInt(getVal('generacion-id')) : null,
      clave: getVal('generacion-clave'),
      nombre: nombre,
      plan: plan,
      periodo_ingreso: getVal('generacion-periodo'),
      estado: document.getElementById('generacion-estado')?.value || 'activa'
    };

    try {
      const res = await window.electronAPI.guardarGeneracion(datos);
      
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
      console.error('💥 Error guardando generación:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  _renderEmptyState() {
    const tbody = document.getElementById('tabla-generaciones-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 50px 20px; color:var(--text-muted);">
          <i class="fa-solid fa-users" 
             style="font-size: 2.5rem; margin: 0 auto 15px auto; display: block; opacity: 0.6;"></i>
          <p style="margin: 0; font-size: 1rem;">No hay generaciones registradas</p>
        </td>
      </tr>
    `;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() {
    window.generacionModuleInstance = this;
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
    this.cachedSelectData = null; // ✅ Limpiar caché de selects también
    
    console.log('🧹 [GeneracionModule] Recursos liberados');
  }
}