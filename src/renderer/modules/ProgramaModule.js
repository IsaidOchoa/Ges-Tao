// src/renderer/modules/ProgramaModule.js
// 📍 Arquitectura: Módulo autocontenido para gestión de Programas Institucionales
// ✅ Incluye: UnsavedChangesGuard, FormAutosave, globalConfirm, cleanup explícito

import { DataTable } from '../components/DataTable/DataTable.js';
import modalProgramaHtml from '../views/partials/modals/modal-programa.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';

export class ProgramaModule {
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
    console.log('📘 [ProgramaModule] Sincronizando módulo...');

    // 1. Inyectar modal (solo una vez, gestionado por este módulo)
    this._injectModal();

    // 2. Esperar que el tbody esté listo en el DOM
    await this._waitForDOM('tabla-programas-body');

    // 3. Cargar datos (lazy: solo si está vacío)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [ProgramaModule] Cargando datos desde IPC...');
      await this._loadData();
    } else {
      console.log('💾 [ProgramaModule] Usando datos en caché...');
    }

    // 4. Renderizar tabla
    const tbody = document.getElementById('tabla-programas-body');
    if (!tbody) {
      console.error('❌ [ProgramaModule] tbody no encontrado');
      return;
    }

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-programas-body',
        columns: this._getColumns(),
        expandable: false,
        actions: true,
        onRowClick: 'programaModuleInstance.handleRowClick(event)',
        onAction: 'programaModuleInstance.toggleActionMenu(event)',
        onExpand: false
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Programas renderizada con ${this.data.length} registros`);
    } else {
      this._renderEmptyState();
      console.log('ℹ️ [ProgramaModule] Sin registros para mostrar');
    }

    // 5. Vincular eventos (siempre, porque el DOM puede haber cambiado)
    this._setupSearch();
    this._setupModalEvents();
    this._setupGlobalHelpers();

    this.initialized = true;
    console.log('✅ [ProgramaModule] Inicialización completa');
  }

  // =========================================
  // INYECCIÓN DE MODAL (Auto-gestionada)
  // =========================================
  _injectModal() {
    if (this._modalInjected || document.getElementById('modal-programa')) {
      this.modalElement = document.getElementById('modal-programa');
      this._modalInjected = true;
      return;
    }

    const template = document.createElement('div');
    template.innerHTML = modalProgramaHtml;
    document.body.appendChild(template.firstElementChild);
    
    this.modalElement = document.getElementById('modal-programa');
    this._modalInjected = true;
    console.log('✅ [ProgramaModule] Modal inyectado');
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
    console.error(`❌ [ProgramaModule] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarProgramas();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log('📄 [ProgramaModule] Primer registro:', this.data[0]);
        }
        return true;
      }
      console.warn('⚠️ [ProgramaModule] Error en respuesta IPC:', res.error);
      return false;
    } catch (error) {
      console.error('❌ [ProgramaModule] Error cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  _getColumns() {
    return [
      { key: 'nombre', label: 'Nombre del Programa' },
      { key: 'responsable', label: 'Responsable' },
      { 
        key: 'fecha_registro', 
        label: 'Fecha Registro',
        format: (v) => this._formatDate(v)
      },
      { key: 'estado', label: 'Estado', badge: true }
    ];
  }

  // Helper para formatear fechas
  _formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  _setupSearch() {
    const input = document.getElementById('buscador-programas');
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
        (item.responsable || '').toLowerCase().includes(txt) ||
        (item.descripcion || '').toLowerCase().includes(txt)
      );
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL (CON CONFIRMACIÓN GLOBAL)
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-programa');
    const modal = this.modalElement;
    
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [ProgramaModule] Elementos del modal no encontrados');
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
    document.getElementById('btn-cancelar-programa')?.addEventListener('click', intentarCerrar);
    
    // Click en overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault();
        intentarCerrar();
      }
    });

    // Botón guardar
    const btnSave = document.getElementById('btn-guardar-programa');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._savePrograma(modal);
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
    const form = document.getElementById('form-programa');
    if (form) form.reset();
    
    // 4. Ocultar modal
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // ABRIR MODAL
  // =========================================
  _openModal(programa = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-programa');
    if (!modal || !form) return;

    // ✅ NO resetear si FormAutosave va a restaurar datos (modo nuevo)
    if (!programa) {
      const hasAutosave = localStorage.getItem('autosave:programa-form');
      if (!hasAutosave) {
        form.reset();
        // Default a hoy solo si es nuevo y no hay autosave
        const fechaField = document.getElementById('prog-fecha');
        if (fechaField) fechaField.value = new Date().toISOString().split('T')[0];
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
    this.unsavedGuard = new UnsavedChangesGuard('#form-programa');
    this.formAutosave = new FormAutosave('form-programa', 'programa-form');

    if (programa) {
      // Modo edición: precargar datos de BD (sobrescribe cualquier autosave)
      setVal('prog-id', programa.id);
      setVal('prog-nombre', programa.nombre);
      setVal('prog-desc', programa.descripcion);
      setVal('prog-resp', programa.responsable);
      setVal('prog-fecha', programa.fecha_registro ? programa.fecha_registro.split('T')[0] : '');
      setVal('prog-estado', programa.estado || 'vigente');
      
      // Limpiar autosave tras precargar datos reales
      this.formAutosave?.clear();
    } else {
      // Modo nuevo: valores por defecto
      setVal('prog-estado', 'vigente');
    }
    // ✅ En modo nuevo: si hay autosave, ya se restauró en el constructor de FormAutosave
    
    modal.classList.remove('hidden');
    
    // Enfocar primer campo con pequeño delay
    setTimeout(() => document.getElementById('prog-nombre')?.focus(), 100);
  }

  // =========================================
  // GUARDAR PROGRAMA
  // =========================================
  async _savePrograma(modal) {
    // ✅ Helper seguro para obtener valores
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    
    const nombre = getVal('prog-nombre');
    const responsable = getVal('prog-resp');
    
    if (!nombre || !responsable) {
      alert('⚠️ Campos obligatorios:\n• Nombre\n• Responsable');
      return;
    }

    const datos = {
      id: getVal('prog-id') ? parseInt(getVal('prog-id')) : null,
      nombre: nombre,
      descripcion: getVal('prog-desc'),
      responsable: responsable,
      fecha_registro: getVal('prog-fecha'),
      estado: document.getElementById('prog-estado')?.value || 'vigente'
    };

    try {
      const res = await window.electronAPI.guardarPrograma(datos);
      
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
      console.error('💥 Error guardando programa:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  _renderEmptyState() {
    const tbody = document.getElementById('tabla-programas-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; padding: 50px 20px; color:var(--text-muted);">
          <i class="fa-solid fa-trophy" 
             style="font-size: 2.5rem; margin: 0 auto 15px auto; display: block; opacity: 0.6;"></i>
          <p style="margin: 0; font-size: 1rem;">Sin programas institucionales registrados</p>
        </td>
      </tr>
    `;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() {
    window.programaModuleInstance = this;
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
    
    console.log('🧹 [ProgramaModule] Recursos liberados');
  }
}