// src/renderer/modules/TipoConstanciaModule.js
// 📍 Arquitectura: Módulo autocontenido para gestión de Tipos de Constancia
// ✅ Incluye: UnsavedChangesGuard, FormAutosave, globalConfirm, cleanup explícito

import { DataTable } from '../components/DataTable/DataTable.js';
import modalTiposHtml from '../views/partials/modals/modal-tipos-constancia.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';

export class TipoConstanciaModule {
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
    console.log('📘 [TipoConstanciaModule] Sincronizando módulo...');

    // 1. Inyectar modal (solo una vez, gestionado por este módulo)
    this._injectModal();

    // 2. Esperar que el tbody esté listo en el DOM
    await this._waitForDOM('tabla-tipos-constancia-body');

    // 3. Cargar datos (lazy: solo si está vacío)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [TipoConstanciaModule] Cargando datos desde IPC...');
      await this._loadData();
    } else {
      console.log('💾 [TipoConstanciaModule] Usando datos en caché...');
    }

    // 4. Renderizar tabla
    const tbody = document.getElementById('tabla-tipos-constancia-body');
    if (!tbody) {
      console.error('❌ [TipoConstanciaModule] tbody no encontrado');
      return;
    }

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-tipos-constancia-body',
        columns: this._getColumns(),
        expandable: false,
        actions: true,
        onRowClick: 'tipoConstanciaModuleInstance.handleRowClick(event)',
        onAction: 'tipoConstanciaModuleInstance.toggleActionMenu(event)',
        onExpand: false,
        hideExpandColumn: true
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Tipos renderizada con ${this.data.length} registros`);
    } else {
      this._renderEmptyState();
      console.log('ℹ️ [TipoConstanciaModule] Sin registros para mostrar');
    }

    // 5. Vincular eventos (siempre, porque el DOM puede haber cambiado)
    this._setupSearch();
    this._setupModalEvents();
    this._setupGlobalHelpers();

    this.initialized = true;
    console.log('✅ [TipoConstanciaModule] Listo');
  }

  // =========================================
  // INYECCIÓN DE MODAL (Auto-gestionada)
  // =========================================
  _injectModal() {
    if (this._modalInjected || document.getElementById('modal-tipo-constancia')) {
      this.modalElement = document.getElementById('modal-tipo-constancia');
      this._modalInjected = true;
      return;
    }

    const template = document.createElement('div');
    template.innerHTML = modalTiposHtml;
    document.body.appendChild(template.firstElementChild);
    
    this.modalElement = document.getElementById('modal-tipo-constancia');
    this._modalInjected = true;
    console.log('✅ [TipoConstanciaModule] Modal inyectado');
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
    console.error(`❌ [TipoConstanciaModule] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarTiposConstancia();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log('📄 [TipoConstanciaModule] Primer registro:', this.data[0]);
        }
        return true;
      }
      console.warn('⚠️ [TipoConstanciaModule] Error en respuesta IPC:', res.error);
      return false;
    } catch (error) {
      console.error('❌ [TipoConstanciaModule] Error cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  _getColumns() {
    return [
      { 
        key: 'nombre', 
        label: 'Nombre del Tipo',
        format: (v) => `<strong>${v}</strong>`
      },
      { 
        key: 'descripcion', 
        label: 'Descripción',
        format: (v) => v 
          ? `<span title="${v}" style="color:var(--text-muted);">${v.length > 60 ? v.substring(0, 60) + '...' : v}</span>`
          : '<span style="color:var(--text-muted)">—</span>'
      },
      { 
        key: 'requiere_ee', 
        label: 'Req. EE',
        format: (v) => v 
          ? '<i class="fa-solid fa-check" style="color:var(--success-color)" title="Requiere Experiencia Educativa"></i>' 
          : '<span style="color:var(--text-muted)" title="No requiere">—</span>'
      },
      { 
        key: 'requiere_periodo', 
        label: 'Req. Periodo',
        format: (v) => v 
          ? '<i class="fa-solid fa-check" style="color:var(--success-color)" title="Requiere Periodo Escolar"></i>' 
          : '<span style="color:var(--text-muted)" title="No requiere">—</span>'
      },
      { 
        key: 'estado', 
        label: 'Estado',
        badge: true,
        format: (v) => {
          const map = {
            'activo': { label: 'Activo', class: 'badge-success' },
            'inactivo': { label: 'Inactivo', class: 'badge-secondary' }
          };
          const m = map[v] || { label: v, class: 'badge-secondary' };
          return `<span class="badge ${m.class}">${m.label}</span>`;
        }
      }
    ];
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  _setupSearch() {
    const input = document.getElementById('buscador-tipos-constancia');
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
        (item.descripcion || '').toLowerCase().includes(txt)
      );
      
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL (CON CONFIRMACIÓN GLOBAL)
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-tipo-constancia');
    const modal = this.modalElement;
    
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [TipoConstanciaModule] Elementos del modal no encontrados');
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
    document.getElementById('btn-cancelar-tipo')?.addEventListener('click', intentarCerrar);
    
    // Click en overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault();
        intentarCerrar();
      }
    });

    // Botón guardar
    const btnSave = document.getElementById('btn-guardar-tipo-constancia');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._saveTipo(modal);
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
    const form = document.getElementById('form-tipo-constancia');
    if (form) form.reset();
    
    // 4. Ocultar modal
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // ABRIR MODAL
  // =========================================
  _openModal(tipo = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-tipo-constancia');
    if (!modal || !form) return;

    // ✅ NO resetear si FormAutosave va a restaurar datos (modo nuevo)
    if (!tipo) {
      const hasAutosave = localStorage.getItem('autosave:tipo-constancia-form');
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
    
    // Limpiar campos ocultos
    setVal('tipo-id', '');
    setVal('tipo-clave', '');
    setVal('tipo-clave-original', '');
    
    // ✅ Inicializar protecciones (FormAutosave restaura AUTOMÁTICAMENTE en su constructor)
    this.unsavedGuard = new UnsavedChangesGuard('#form-tipo-constancia');
    this.formAutosave = new FormAutosave('form-tipo-constancia', 'tipo-constancia-form');

    if (tipo) {
      // Modo edición: precargar datos de BD (sobrescribe cualquier autosave)
      setVal('tipo-id', tipo.id);
      setVal('tipo-clave', tipo.clave);
      setVal('tipo-clave-original', tipo.clave);
      setVal('tipo-nombre', tipo.nombre);
      setVal('tipo-descripcion', tipo.descripcion);
      
      const eeField = document.getElementById('tipo-requiere-ee');
      if (eeField) eeField.checked = !!tipo.requiere_ee;
      
      const perField = document.getElementById('tipo-requiere-periodo');
      if (perField) perField.checked = !!tipo.requiere_periodo;
      
      // Actualizar título del modal
      const tituloEl = document.getElementById('modal-titulo-tipo');
      if (tituloEl) tituloEl.textContent = `Editar: ${tipo.nombre}`;
      
      // Limpiar autosave tras precargar datos reales
      this.formAutosave?.clear();
    } else {
      // Modo nuevo: título por defecto
      const tituloEl = document.getElementById('modal-titulo-tipo');
      if (tituloEl) tituloEl.textContent = 'Nuevo Tipo de Constancia';
    }
    // ✅ En modo nuevo: si hay autosave, ya se restauró en el constructor de FormAutosave
    
    modal.classList.remove('hidden');
    
    // Enfocar primer campo con pequeño delay
    setTimeout(() => document.getElementById('tipo-nombre')?.focus(), 100);
  }

  // =========================================
  // GUARDAR TIPO DE CONSTANCIA
  // =========================================
  async _saveTipo(modal) {
    // ✅ Helper seguro para obtener valores
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    
    const nombre = getVal('tipo-nombre');
    if (!nombre) {
      alert('⚠️ El nombre es obligatorio');
      document.getElementById('tipo-nombre')?.focus();
      return;
    }

    // Generar clave automática si es nuevo y está vacía
    let clave = getVal('tipo-clave');
    const id = getVal('tipo-id');
    
    if (!id && !clave) {
      const palabras = nombre.toUpperCase().split(' ').filter(p => p.length > 2);
      clave = palabras.slice(0, 2).map(p => p.substring(0, 4)).join('-');
      if (clave.length < 3) clave = 'TIPO-' + Date.now().toString().slice(-4);
    }

    const datos = {
      id: id ? parseInt(id) : null,
      clave: clave,
      nombre: nombre,
      descripcion: getVal('tipo-descripcion'),
      requiere_ee: document.getElementById('tipo-requiere-ee')?.checked ? 1 : 0,
      requiere_periodo: document.getElementById('tipo-requiere-periodo')?.checked ? 1 : 0,
      estado: 'activo' // ✅ Siempre activo al crear/editar desde modal
    };

    try {
      const res = await window.electronAPI.guardarTipoConstancia(datos);
      
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
      console.error('💥 Error guardando tipo:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  _renderEmptyState() {
    const tbody = document.getElementById('tabla-tipos-constancia-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 50px 20px; color:var(--text-muted);">
          <i class="fa-solid fa-certificate" 
             style="font-size: 2.5rem; margin: 0 auto 15px auto; display: block; opacity: 0.6;"></i>
          <p style="margin: 0; font-size: 1rem;">Sin tipos de constancia registrados</p>
        </td>
      </tr>
    `;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() {
    window.tipoConstanciaModuleInstance = this;
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
    
    console.log('🧹 [TipoConstanciaModule] Recursos liberados');
  }
}