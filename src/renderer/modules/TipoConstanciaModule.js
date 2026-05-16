// src/renderer/modules/TipoConstanciaModule.js
// 📍 Arquitectura: Módulo autocontenido para gestión de Tipos de Constancia
// 🔗 DB Schema: tipos_constancia(clave, nombre, descripcion, requiere_ee, requiere_periodo, estado)

import { DataTable } from '../components/DataTable/DataTable.js';
import modalTiposHtml from '../views/partials/modals/modal-tipos-constancia.html';
import { FormAutosave } from '../utils/formAutosave.js';           // ✅ Auto-guardado
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';  // ✅ Advertencia de salida

export class TipoConstanciaModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    
    // ✅ Para auto-guardado y protección de cambios
    this.formAutosave = null;
    this.unsavedGuard = null;
  }

  // =========================================
  // MÉTODO PRINCIPAL DE INICIALIZACIÓN (Re-entrante)
  // =========================================
  async init() {
    console.log('📘 [TipoConstanciaModule] Sincronizando módulo...');

    // 1. Inyectar Modal (solo si no existe)
    if (!document.getElementById('modal-tipo-constancia')) {
      const template = document.createElement('div');
      template.innerHTML = modalTiposHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-tipo-constancia');
      console.log('✅ Modal Tipos inyectado');
    }

    // 2. Esperar que el tbody exista (crítico para SPA)
    await this.waitForDOMReady('tabla-tipos-constancia-body');

    // 3. Cargar datos SOLO si está vacío (Lazy Load)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [TipoConstanciaModule] Cargando datos...');
      await this.loadData();
    }

    // 4. Renderizar: Tabla con datos O estado vacío
    const tbody = document.getElementById('tabla-tipos-constancia-body');
    if (!tbody) return;

    if (this.data && this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-tipos-constancia-body',
        columns: this.getColumns(),
        expandable: false,
        actions: true,
        onRowClick: 'tipoConstanciaModuleInstance.handleRowClick(event)',
        onAction: 'tipoConstanciaModuleInstance.toggleActionMenu(event)',
        onExpand: false,
        hideExpandColumn: true  // ✅ Ocultar columna de flecha (tabla simple)
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Tipos renderizada con ${this.data.length} registros`);
    } else {
      this.renderEmptyState();
      console.log('ℹ️ [TipoConstanciaModule] Sin registros para mostrar');
    }

    // 5. Re-vincular eventos (SIEMPRE, porque el DOM es nuevo)
    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    console.log('✅ [TipoConstanciaModule] Listo');
  }

  // =========================================
  // UTILIDAD: Esperar que el tbody exista en el DOM
  // =========================================
  async waitForDOMReady(tbodyId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(tbodyId)) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.error(`❌ [TipoConstanciaModule] Timeout: tbody "${tbodyId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async loadData() {
    try {
      const res = await window.electronAPI.listarTiposConstancia();
      if (res.success) {
        this.data = res.rows || res.data;
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error cargando tipos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS (Sin clave visible, alineación correcta)
  // =========================================
  getColumns() {
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
  setupSearch() {
    const input = document.getElementById('buscador-tipos-constancia');
    if (!input) {
      console.warn('⚠️ [TipoConstanciaModule] Input buscador no encontrado');
      return;
    }

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
  // GESTIÓN DE MODALES (Con auto-guardado y sin estado visible)
  // =========================================
  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-tipo-constancia');
    const modal = document.getElementById('modal-tipo-constancia');
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [TipoConstanciaModule] Elementos del modal no encontrados');
      return;
    }

    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this.openModal();
    };
    
    const cerrar = () => {
      // ✅ Limpiar auto-guardado y guard al cerrar
      this.formAutosave?.clear();
      this.unsavedGuard = null;
      modal.classList.add('hidden');
    };
    
    document.getElementById('btn-cerrar-modal-tipo')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-tipo')?.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrar(); });

    const btnSave = document.getElementById('btn-guardar-tipo-constancia');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.saveTipo(modal);
      });
    }
  }

  // ✅ openModal CORREGIDO: Sin campo estado, con auto-guardado
  openModal(tipo = null) {
    const modal = document.getElementById('modal-tipo-constancia');
    const form = document.getElementById('form-tipo-constancia');
    if (!modal || !form) return;

    form.reset();
    
    // ✅ Limpiar campos ocultos con null checks
    const idField = document.getElementById('tipo-id');
    const claveField = document.getElementById('tipo-clave');
    const claveOrigField = document.getElementById('tipo-clave-original');
    
    if (idField) idField.value = '';
    if (claveField) claveField.value = '';
    if (claveOrigField) claveOrigField.value = '';
    
    if (tipo) {
      // Modo edición
      if (idField) idField.value = tipo.id || '';
      if (claveField) claveField.value = tipo.clave || '';
      if (claveOrigField) claveOrigField.value = tipo.clave || '';
      
      const nombreField = document.getElementById('tipo-nombre');
      if (nombreField) nombreField.value = tipo.nombre || '';
      
      const descField = document.getElementById('tipo-descripcion');
      if (descField) descField.value = tipo.descripcion || '';
      
      const eeField = document.getElementById('tipo-requiere-ee');
      if (eeField) eeField.checked = !!tipo.requiere_ee;
      
      const perField = document.getElementById('tipo-requiere-periodo');
      if (perField) perField.checked = !!tipo.requiere_periodo;
      
      // ✅ NO cargar estado: siempre es 'activo' desde modal
      // El estado solo se cambia desde el menú contextual de la tabla
      
      // Actualizar título del modal
      const tituloEl = document.getElementById('modal-titulo-tipo');
      if (tituloEl) tituloEl.textContent = `Editar: ${tipo.nombre}`;
    } else {
      // Modo nuevo
      const tituloEl = document.getElementById('modal-titulo-tipo');
      if (tituloEl) tituloEl.textContent = 'Nuevo Tipo de Constancia';
    }
    
    // ✅ Iniciar auto-guardado y protección de cambios
    this.formAutosave = new FormAutosave('form-tipo-constancia', 'tipo-constancia-form');
    this.unsavedGuard = new UnsavedChangesGuard('#form-tipo-constancia');
    
    modal.classList.remove('hidden');
    
    const focusField = document.getElementById('tipo-nombre');
    if (focusField) focusField.focus();
  }

  // ✅ saveTipo CORREGIDO: estado siempre 'activo', con limpieza de auto-guardado
  async saveTipo(modal) {
    const id = document.getElementById('tipo-id')?.value;
    const nombre = document.getElementById('tipo-nombre')?.value?.trim();
    const descripcion = document.getElementById('tipo-descripcion')?.value?.trim();
    
    let clave = document.getElementById('tipo-clave')?.value?.trim();
    
    if (!nombre) {
      alert('⚠️ El nombre es obligatorio');
      document.getElementById('tipo-nombre')?.focus();
      return;
    }

    // Generar clave automática si es nuevo y está vacía
    if (!id && !clave) {
      const palabras = nombre.toUpperCase().split(' ').filter(p => p.length > 2);
      clave = palabras.slice(0, 2).map(p => p.substring(0, 4)).join('-');
      if (clave.length < 3) clave = 'TIPO-' + Date.now().toString().slice(-4);
    }

    const datos = {
      id: id ? parseInt(id) : null,
      clave: clave, 
      nombre: nombre,
      descripcion: descripcion,
      requiere_ee: document.getElementById('tipo-requiere-ee')?.checked ? 1 : 0,
      requiere_periodo: document.getElementById('tipo-requiere-periodo')?.checked ? 1 : 0,
      estado: 'activo'  // ✅ Siempre activo al crear/editar desde modal
    };

    try {
      const res = await window.electronAPI.guardarTipoConstancia(datos);
      
      if (res.success) {
        alert('✅ Tipo de Constancia guardado correctamente');
        
        // ✅ Limpiar auto-guardado y guard al guardar exitosamente
        this.formAutosave?.clear();
        this.unsavedGuard = null;
        
        modal.classList.add('hidden');
        await this.loadData();
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
  renderEmptyState() {
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
  // UTILIDADES GLOBALES
  // =========================================
  setupGlobalHelpers() {
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

  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) menu.classList.toggle('hidden');
  }
}