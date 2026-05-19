// src/renderer/modules/SemestreModule.js
// 📍 Arquitectura: Módulo autocontenido para gestión de Semestres
// ✅ Incluye: UnsavedChangesGuard, FormAutosave, globalConfirm, cleanup explícito

import { DataTable } from '../components/DataTable/DataTable.js';
import modalSemestreHtml from '../views/partials/modals/modal-semestre.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';

export class SemestreModule {
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
    console.log('📘 [SemestreModule] Sincronizando módulo...');

    // 1. Inyectar modal (solo una vez, gestionado por este módulo)
    this._injectModal();

    // 2. Esperar que el tbody esté listo en el DOM
    await this._waitForDOM('tabla-semestres-body');

    // 3. Cargar datos (lazy: solo si está vacío)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [SemestreModule] Cargando datos desde IPC...');
      await this._loadData();
    } else {
      console.log('💾 [SemestreModule] Usando datos en caché...');
    }

    // 4. Renderizar tabla
    const tbody = document.getElementById('tabla-semestres-body');
    if (!tbody) {
      console.error('❌ [SemestreModule] tbody no encontrado');
      return;
    }

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-semestres-body',
        columns: this._getColumns(),
        actions: true,
        onRowClick: 'semestreModuleInstance.handleRowClick(event)',
        onAction: 'semestreModuleInstance.toggleActionMenu(event)'
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Semestres renderizada con ${this.data.length} registros`);
    } else {
      this._renderEmptyState();
      console.log('ℹ️ [SemestreModule] Sin registros para mostrar');
    }

    // 5. Vincular eventos (siempre, porque el DOM puede haber cambiado)
    this._setupSearch();
    this._setupModalEvents();
    this._setupGlobalHelpers();

    this.initialized = true;
    console.log('✅ [SemestreModule] Inicialización completa');
  }

  // =========================================
  // INYECCIÓN DE MODAL (Auto-gestionada)
  // =========================================
  _injectModal() {
    if (this._modalInjected || document.getElementById('modal-semestre')) {
      this.modalElement = document.getElementById('modal-semestre');
      this._modalInjected = true;
      return;
    }

    const template = document.createElement('div');
    template.innerHTML = modalSemestreHtml;
    document.body.appendChild(template.firstElementChild);
    
    this.modalElement = document.getElementById('modal-semestre');
    this._modalInjected = true;
    console.log('✅ [SemestreModule] Modal inyectado');
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
    console.error(`❌ [SemestreModule] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarSemestres();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log('📄 [SemestreModule] Primer registro:', this.data[0]);
        }
        return true;
      }
      console.warn('⚠️ [SemestreModule] Error en respuesta IPC:', res.error);
      return false;
    } catch (error) {
      console.error('❌ [SemestreModule] Error cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  _getColumns() {
    return [
      { key: 'orden', label: 'Orden' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'clave', label: 'Clave' },
      { key: 'estado', label: 'Estado', badge: true }
    ];
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  _setupSearch() {
    const input = document.getElementById('buscador-semestres');
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
    const btnNuevo = document.getElementById('btn-nuevo-semestre');
    const modal = this.modalElement;
    
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [SemestreModule] Elementos del modal no encontrados');
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
    document.getElementById('btn-cancelar-semestre')?.addEventListener('click', intentarCerrar);
    
    // Click en overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault();
        intentarCerrar();
      }
    });

    // Botón guardar
    const btnSave = document.getElementById('btn-guardar-semestre');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._saveSemestre(modal);
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
    const form = document.getElementById('form-semestre');
    if (form) form.reset();
    
    // 4. Ocultar modal
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // ABRIR MODAL
  // =========================================
  _openModal(semestre = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-semestre');
    if (!modal || !form) return;

    // ✅ NO resetear si FormAutosave va a restaurar datos (modo nuevo)
    if (!semestre) {
      const hasAutosave = localStorage.getItem('autosave:semestre-form');
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
    this.unsavedGuard = new UnsavedChangesGuard('#form-semestre');
    this.formAutosave = new FormAutosave('form-semestre', 'semestre-form');

    if (semestre) {
      // Modo edición: precargar datos de BD (sobrescribe cualquier autosave)
      setVal('semestre-id', semestre.id);
      setVal('semestre-orden', semestre.orden);
      setVal('semestre-nombre', semestre.nombre);
      setVal('semestre-clave', semestre.clave);
      setVal('semestre-estado', semestre.estado);
      
      // Limpiar autosave tras precargar datos reales
      this.formAutosave?.clear();
    } else {
      // Modo nuevo: valores por defecto
      setVal('semestre-estado', 'activo');
    }
    // ✅ En modo nuevo: si hay autosave, ya se restauró en el constructor de FormAutosave
    
    modal.classList.remove('hidden');
    
    // Enfocar primer campo con pequeño delay
    setTimeout(() => document.getElementById('semestre-orden')?.focus(), 100);
  }

  // =========================================
  // GUARDAR SEMESTRE
  // =========================================
  async _saveSemestre(modal) {
    // ✅ Helper seguro para obtener valores
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    
    const datos = {
      id: getVal('semestre-id') ? parseInt(getVal('semestre-id')) : null,
      orden: parseInt(getVal('semestre-orden')) || 1,
      nombre: getVal('semestre-nombre'),
      clave: getVal('semestre-clave'),
      estado: document.getElementById('semestre-estado')?.value || 'activo'
    };

    // Validaciones obligatorias
    if (!datos.nombre || !datos.clave) {
      alert('⚠️ Campos obligatorios:\n• Nombre\n• Clave');
      return;
    }

    try {
      const res = await window.electronAPI.guardarSemestre(datos);
      
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
      console.error('💥 Error guardando semestre:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  _renderEmptyState() {
    const tbody = document.getElementById('tabla-semestres-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding: 50px 20px; color:var(--text-muted);">
          <i class="fa-solid fa-layer-group" 
             style="font-size: 2.5rem; margin: 0 auto 15px auto; display: block; opacity: 0.6;"></i>
          <p style="margin: 0; font-size: 1rem;">No hay semestres registrados</p>
        </td>
      </tr>
    `;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() {
    window.semestreModuleInstance = this;
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
    
    console.log('🧹 [SemestreModule] Recursos liberados');
  }
}