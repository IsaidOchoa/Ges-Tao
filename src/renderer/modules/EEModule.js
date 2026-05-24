// src/renderer/modules/EEModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalEEHtml from '../views/partials/modals/modal-ee.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';

export class EEModule {
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
    console.log('📘 [EEModule] Sincronizando módulo...');

    // 1. Inyectar modal (solo una vez)
    this._injectModal();

    // 2. Esperar que el tbody esté listo en el DOM
    await this._waitForDOM('tabla-ee-body');

    // 3. Cargar datos (lazy: solo si está vacío)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [EEModule] Cargando datos desde IPC...');
      await this._loadData();
    } else {
      console.log('💾 [EEModule] Usando datos en caché...');
    }

    // 4. Renderizar tabla
    const tbody = document.getElementById('tabla-ee-body');
    if (!tbody) {
      console.error('❌ [EEModule] tbody no encontrado');
      return;
    }

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-ee-body',
        columns: this._getColumns(),
        expandable: true,
        actions: true,
        // ✅ Callbacks para interacción
        onRowClick: 'eeModuleInstance.handleRowClick(event)',
        onAction: 'eeModuleInstance.toggleActionMenu(event)',
        onExpand: 'eeModuleInstance.loadRowSummary(event)', // ✅ Corregido: era 'true'
        // ✅ NUEVO: Acción del botón "Gestionar" en fila expandible
        onExpandAction: 'eeModuleInstance.openAssignmentModal(this)'
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla EE renderizada con ${this.data.length} registros`);
    } else {
      this._renderEmptyState();
      console.log('ℹ️ [EEModule] Sin registros para mostrar');
    }

    // 5. Vincular eventos
    this._setupSearch();
    this._setupModalEvents();
    this._setupGlobalHelpers();

    // ✅ EXPONER INSTANCIA GLOBAL (CRÍTICO para que funcione el onclick del HTML)
    window.eeModuleInstance = this;

    this.initialized = true;
    console.log('✅ [EEModule] Inicialización completa');
  }

  // =========================================
  // INYECCIÓN DE MODAL (Auto-gestionada)
  // =========================================
  _injectModal() {
    if (this._modalInjected || document.getElementById('modal-ee')) {
      this.modalElement = document.getElementById('modal-ee');
      this._modalInjected = true;
      return;
    }

    const template = document.createElement('div');
    template.innerHTML = modalEEHtml;
    document.body.appendChild(template.firstElementChild);
    
    this.modalElement = document.getElementById('modal-ee');
    this._modalInjected = true;
    console.log('✅ [EEModule] Modal inyectado');
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
    console.error(`❌ [EEModule] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarEE();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log('📄 [EEModule] Primer registro:', this.data[0]);
          console.log('🔑 [EEModule] Keys disponibles:', Object.keys(this.data[0]));
        }
        return true;
      }
      console.warn('⚠️ [EEModule] Error en respuesta IPC:', res.error);
      return false;
    } catch (error) {
      console.error('❌ [EEModule] Error cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  _getColumns() {
    const estadoMap = {
      'activa': { label: 'Vigente', class: 'badge-success' },
      'inactiva': { label: 'Inactiva', class: 'badge-warning' },
      'archivada': { label: 'Archivada', class: 'badge-secondary' }
    };

    return [
      { 
        key: 'clave_ee', 
        label: 'Clave',
        format: (v) => `<strong style="font-family:monospace;">${v}</strong>` 
      },
      { 
        key: 'nombre', 
        label: 'Nombre',
        format: (v) => `<span title="${v}">${v.length > 30 ? v.substring(0, 30) + '...' : v}</span>`
      },
      { 
        key: 'tipo', 
        label: 'Tipo',
        badge: true,
        format: (v) => {
          const colors = { 'Obligatoria': 'badge-success', 'Optativa': 'badge-warning', 'Taller': 'badge-info' };
          return `<span class="badge ${colors[v] || 'badge-secondary'}">${v || '-'}</span>`;
        }
      },
      { 
        key: 'creditos', 
        label: 'Créditos',
        format: (v) => v ? `${v} cr` : '-'
      },
      { 
        key: 'estado', 
        label: 'Estado',
        badge: true,
        format: (v) => {
          const map = estadoMap[v] || { label: v, class: 'badge-secondary' };
          return `<span class="badge ${map.class}">${map.label}</span>`;
        }
      }
    ];
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  _setupSearch() {
    const input = document.getElementById('buscador-ee');
    if (!input) return;

    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) {
        this.table?.setData(this.data);
        return;
      }
      
      const filtered = this.data.filter(item => {
        const searchable = [
          item.clave_ee,
          item.nombre,
          item.tipo,
          item.area,
          item.linea_investigacion
        ].filter(v => v).join(' ').toLowerCase();
        return searchable.includes(txt);
      });
      
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL (CON CONFIRMACIÓN ASÍNCRONA)
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-ee');
    const modal = this.modalElement;
    
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [EEModule] Elementos del modal no encontrados');
      return;
    }

    // Abrir modal
    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this._openModal();
    };

    // ✅ Función de cierre ASÍNCRONA con confirmación global
    const intentarCerrar = async () => {
      // Si hay cambios sin guardar, preguntar con modal global (no bloqueante)
      if (this.unsavedGuard?.hasUnsavedChanges) {
        const confirmado = await globalConfirm.ask('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
        if (!confirmado) return; // Usuario canceló → NO cerrar
      }
      
      // Proceder a cerrar limpiamente
      this._ejecutarCierre();
    };

    // Vincular botones de cierre a la función asíncrona
    document.getElementById('btn-cerrar-modal-ee')?.addEventListener('click', intentarCerrar);
    document.getElementById('btn-cancelar-ee')?.addEventListener('click', intentarCerrar);
    
    // ✅ Click en overlay: ahora usa confirmación asíncrona (FIX del bloqueo)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault();
        intentarCerrar();
      }
    });

    // Botón guardar
    const btnSave = document.getElementById('btn-guardar-ee');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._saveEE(modal);
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
    const form = document.getElementById('form-ee');
    if (form) form.reset();
    
    // 4. Ocultar modal
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // ABRIR MODAL
  // =========================================
  _openModal(ee = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-ee');
    if (!modal || !form) return;

    form.reset();
    
    // ✅ Helper seguro para setear valores (evita errores de null)
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    
    // Limpiar ID
    setVal('ee-id', '');
    
    // ✅ Inicializar protecciones (nueva instancia por sesión)
    this.unsavedGuard = new UnsavedChangesGuard('#form-ee');
    this.formAutosave = new FormAutosave('form-ee', 'ee-form');

    if (ee) {
      // Modo edición: precargar datos
      setVal('ee-id', ee.id);
      setVal('ee-clave', ee.clave_ee);
      setVal('ee-nombre', ee.nombre);
      setVal('ee-tipo', ee.tipo || 'Obligatoria');
      setVal('ee-creditos', ee.creditos ?? 0);
      setVal('ee-h-teoria', ee.horas_teoria ?? 0);
      setVal('ee-h-practica', ee.horas_practica ?? 0);
      setVal('ee-programa', ee.programa_academico);
      setVal('ee-area', ee.area);
      setVal('ee-linea', ee.linea_investigacion);
      setVal('ee-estado', ee.estado || 'activa');
    } else {
      // Modo nuevo: valores por defecto
      setVal('ee-estado', 'activa');
      setVal('ee-tipo', 'Obligatoria');
    }
    
    modal.classList.remove('hidden');
    
    // Enfocar primer campo con pequeño delay
    setTimeout(() => document.getElementById('ee-clave')?.focus(), 100);
  }

  // =========================================
  // GUARDAR EE
  // =========================================
  async _saveEE(modal) {
    // ✅ Helper seguro para obtener valores
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    
    const datos = {
      id: getVal('ee-id') ? parseInt(getVal('ee-id')) : null,
      clave_ee: getVal('ee-clave'),
      nombre: getVal('ee-nombre'),
      tipo: document.getElementById('ee-tipo')?.value,
      creditos: parseInt(getVal('ee-creditos')) || 0,
      creditos_teoria: parseInt(getVal('ee-h-teoria')) || 0,
      creditos_practica: parseInt(getVal('ee-h-practica')) || 0,
      creditos_otros: 0,
      horas_teoria: parseInt(getVal('ee-h-teoria')) || 0,
      horas_practica: parseInt(getVal('ee-h-practica')) || 0,
      area: getVal('ee-area'),
      linea_investigacion: getVal('ee-linea'),
      programa_academico: getVal('ee-programa'),
      estado: document.getElementById('ee-estado')?.value || 'activa'
    };

    // Validaciones obligatorias
    if (!datos.clave_ee || !datos.nombre) {
      alert('⚠️ Campos obligatorios:\n• Clave EE\n• Nombre');
      return;
    }

    try {
      const res = await window.electronAPI.guardarEE(datos);
      
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
      console.error('💥 Error guardando EE:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  _renderEmptyState() {
    const tbody = document.getElementById('tabla-ee-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 50px 20px; color:var(--text-muted);">
          <i class="fa-solid fa-book-open" 
             style="font-size: 2.5rem; margin: 0 auto 15px auto; display: block; opacity: 0.6;"></i>
          <p style="margin: 0; font-size: 1rem;">Sin experiencias educativas registradas</p>
        </td>
      </tr>
    `;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() {
    window.eeModuleInstance = this;
  }

  // =========================================
  // INTERACCIÓN DE FILAS
  // =========================================
  handleRowClick(event) {
    const row = event.target.closest('.data-row');
    if (!row) return;
    
    if (event.target.closest('.btn-action-menu') || event.target.closest('.context-menu')) {
      return;
    }
    
    row.classList.toggle('expanded');
    const detailsRow = row.nextElementSibling;
    
    if (detailsRow?.classList.contains('sub-row-details')) {
      detailsRow.classList.toggle('hidden');
      if (!detailsRow.classList.contains('hidden')) {
        this._loadRowSummary(row.dataset.id, detailsRow);
      }
    }
    
    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
  }

  async _loadRowSummary(rowId, container) {
    const chips = container.querySelector('.summary-chips');
    if (!chips) return;
    
    chips.innerHTML = '<span class="chip">⏳ Cargando...</span>';
    
    try {
      setTimeout(() => {
        chips.innerHTML = `
          <span class="chip accent">👨‍🏫 2 Docentes</span>
          <span class="chip">📅 2024-A</span>
          <span class="chip">📚 8 Créditos</span>
        `;
      }, 300);
    } catch (error) {
      chips.innerHTML = '<span class="chip" style="color:var(--danger-color)">Error</span>';
    }
  }

  // =========================================
  // MENÚ CONTEXTUAL
  // =========================================
  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) {
      menu.classList.toggle('hidden');
    }
  }

    // src/renderer/modules/EEModule.js
  
  openAssignmentModal(buttonEl) {
    // 1. Navegación DOM para encontrar la fila principal
    const expandedRow = buttonEl?.closest('.sub-row-details');
    const row = expandedRow 
      ? expandedRow.previousElementSibling 
      : buttonEl?.closest('.data-row');
    
    if (!row?.classList.contains('data-row')) {
      console.warn('⚠️ [EEModule] No se encontró fila de datos válida');
      return;
    }
    
    // 2. Obtener identificador (clave_ee) desde el dataset de la fila
    const identificador = row.dataset.id?.trim();
    if (!identificador) {
      console.error('❌ [EEModule] La fila no tiene dataset.id');
      return;
    }

    // 3. Validar que tenemos datos cargados
    if (!this.data || this.data.length === 0) {
      console.error('❌ [EEModule] No hay datos cargados en la tabla (this.data está vacío)');
      return;
    }

    // 4. Buscar la EE en los datos locales por su clave única (clave_ee)
    const ee = this.data.find(e => e.clave_ee === identificador);

    // Fallback: si no encuentra por clave_ee, intentar por id numérico
    const eeFallback = !ee ? this.data.find(e => e.id == identificador) : null;
    const eeCompleto = ee || eeFallback;

    if (!eeCompleto) {
      console.error(`❌ [EEModule] EE no encontrada con clave: ${identificador}`);
      console.warn('💡 Pista: Revisa si el identificador en el HTML es clave_ee o id');
      console.log('🔍 [Debug] Primeras EE en this.data:', this.data.slice(0, 2).map(e => ({ id: e.id, clave_ee: e.clave_ee, nombre: e.nombre })));
      return;
    }

    // 5. Debug opcional (puedes quitarlo en producción)
    console.log('🔍 [EEModule] Datos encontrados:', {
      id: eeCompleto.id,
      clave_ee: eeCompleto.clave_ee,
      nombre: eeCompleto.nombre,
      tipo: eeCompleto.tipo,
      creditos: eeCompleto.creditos
    });

    // 6. Abrir modal con contexto completo de EE
    window.assignmentModal.open({
      entityType: 'ee',                    // 🔑 Clave: define qué cards mostrar
      entityId: eeCompleto.id,             // ID interno para backend (número)
      entityName: eeCompleto.nombre,       // Nombre visual para el sidebar
      clave_ee: eeCompleto.clave_ee,       // Clave visible para UI (ej: "PROG-101")
      // Campos extra opcionales para futuras cards:
      tipo: eeCompleto.tipo,
      creditos: eeCompleto.creditos,
      area: eeCompleto.area
    });
    
    console.log(`✅ [EEModule] Modal abierto para EE: ${eeCompleto.nombre} (${eeCompleto.clave_ee})`);
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
    
    console.log('🧹 [EEModule] Recursos liberados');
  }
}