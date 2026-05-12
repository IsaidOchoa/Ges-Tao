// src/renderer/modules/EEModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalEEHtml from '../views/partials/modals/modal-ee.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';

export class EEModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
  }

  // =========================================
  // MÉTODO PRINCIPAL DE INICIALIZACIÓN (Re-entrante)
  // =========================================
  async init() {
    console.log('📘 [EEModule] Sincronizando módulo...');

    // 1. Inyectar Modal (solo si no existe)
    if (!document.getElementById('modal-ee')) {
      const template = document.createElement('div');
      template.innerHTML = modalEEHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-ee');
      console.log('✅ Modal EE inyectado');
    }

    // 2. Esperar que el tbody exista (crítico para SPA)
    await this.waitForDOMReady('tabla-ee-body');

    // 3. Cargar datos SOLO si está vacío (Lazy Load)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [EEModule] Cargando datos desde IPC...');
      await this.loadData();
    } else {
      console.log('💾 [EEModule] Usando datos en caché...');
    }

    // 4. Renderizar: Tabla con datos O estado vacío
    const tbody = document.getElementById('tabla-ee-body');
    if (!tbody) {
      console.error('❌ [EEModule] tbody no encontrado');
      return;
    }

    if (this.data && this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-ee-body',
        columns: this.getColumns(),
        expandable: true,
        actions: true,
        onRowClick: 'eeModuleInstance.handleRowClick(event)',
        onAction: 'eeModuleInstance.toggleActionMenu(event)',
        onExpand: true
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla EE renderizada con ${this.data.length} registros`);
    } else {
      this.renderEmptyState();
      console.log('ℹ️ [EEModule] Sin registros para mostrar');
    }

    // 5. Re-vincular eventos (SIEMPRE, porque el DOM es nuevo)
    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    console.log('✅ [EEModule] Inicialización completa');
  }

  // =========================================
  // UTILIDAD: Esperar que el tbody exista en el DOM
  // =========================================
  async waitForDOMReady(tbodyId, timeout = 2000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const tbody = document.getElementById(tbodyId);
      if (tbody) {
        console.log(`🔍 [EEModule] tbody "${tbodyId}" encontrado en DOM`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.error(`❌ [EEModule] Timeout: tbody "${tbodyId}" no encontrado en ${timeout}ms`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async loadData() {
    try {
      console.log('📡 [EEModule] Solicitando datos a IPC...');
      const res = await window.electronAPI.listarEE();
      
      console.log('📦 [EEModule] Respuesta IPC:', { 
        success: res.success, 
        count: res.data?.length || res.rows?.length 
      });
      
      if (res.success) {
        this.data = res.rows || res.data;
        
        if (this.data.length > 0) {
          console.log('📄 [EEModule] Primer registro:', this.data[0]);
          console.log('🔑 [EEModule] Keys disponibles:', Object.keys(this.data[0]));
        }
        
        return true;
      } else {
        console.warn('⚠️ [EEModule] Error en respuesta IPC:', res.error);
        return false;
      }
    } catch (error) {
      console.error('❌ [EEModule] Error crítico cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS (Con mapeo visual de estados)
  // =========================================
  getColumns() {
    // ✅ Mapeo visual exclusivo para EE: valor BD → texto UI
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
        // ✅ Traducción visual sin tocar datos reales
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
  setupSearch() {
    const input = document.getElementById('buscador-ee');
    if (!input) {
      console.warn('⚠️ [EEModule] Input buscador no encontrado');
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
  // GESTIÓN DE MODALES (Con auto-guardado y protección)
  // =========================================
  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-ee');
    const modal = document.getElementById('modal-ee');
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [EEModule] Elementos del modal no encontrados');
      return;
    }

    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this.openModal();
    };

    const cerrarModal = () => {
      // ✅ Limpiar auto-guardado y guard al cerrar
      this.formAutosave?.clear();
      this.unsavedGuard = null;
      modal.classList.add('hidden');
    };
    
    document.getElementById('modal-ee')?.querySelector('.btn-close')?.addEventListener('click', cerrarModal);
    document.getElementById('btn-cancelar-ee')?.addEventListener('click', cerrarModal);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrarModal(); });

    const btnSave = document.getElementById('modal-ee')?.querySelector('.btn-primary');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.saveEE(modal);
      });
    }
  }

  openModal(ee = null) {
    const modal = document.getElementById('modal-ee');
    const form = document.getElementById('form-ee');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('ee-id').value = '';
    
    // ✅ Iniciar auto-guardado y protección de cambios
    this.formAutosave = new FormAutosave('form-ee', 'ee-form');
    this.unsavedGuard = new UnsavedChangesGuard('#form-ee');

    if (ee) {
      // Modo edición: prellenar formulario
      document.getElementById('ee-id').value = ee.id || '';
      document.getElementById('ee-clave').value = ee.clave_ee || '';
      document.getElementById('ee-nombre').value = ee.nombre || '';
      document.getElementById('ee-tipo').value = ee.tipo || 'Obligatoria';
      document.getElementById('ee-creditos').value = ee.creditos || 0;
      document.getElementById('ee-h-teoria').value = ee.horas_teoria || 0;
      document.getElementById('ee-h-practica').value = ee.horas_practica || 0;
      document.getElementById('ee-programa').value = ee.programa_academico || '';
      document.getElementById('ee-area').value = ee.area || '';
      document.getElementById('ee-linea').value = ee.linea_investigacion || '';
      document.getElementById('ee-estado').value = ee.estado || 'activa';
    } else {
      // Modo nuevo: estado por defecto
      const estadoField = document.getElementById('ee-estado');
      if (estadoField) estadoField.value = 'activa';
    }
    
    modal.classList.remove('hidden');
    document.getElementById('ee-clave')?.focus();
  }

  async saveEE(modal) {
    const datos = {
      id: document.getElementById('ee-id')?.value || null,
      clave_ee: document.getElementById('ee-clave')?.value?.trim(),
      nombre: document.getElementById('ee-nombre')?.value?.trim(),
      tipo: document.getElementById('ee-tipo')?.value,
      creditos: parseInt(document.getElementById('ee-creditos')?.value) || 0,
      creditos_teoria: parseInt(document.getElementById('ee-h-teoria')?.value) || 0,
      creditos_practica: parseInt(document.getElementById('ee-h-practica')?.value) || 0,
      creditos_otros: 0,
      horas_teoria: parseInt(document.getElementById('ee-h-teoria')?.value) || 0,
      horas_practica: parseInt(document.getElementById('ee-h-practica')?.value) || 0,
      area: document.getElementById('ee-area')?.value,
      linea_investigacion: document.getElementById('ee-linea')?.value,
      programa_academico: document.getElementById('ee-programa')?.value,
      estado: document.getElementById('ee-estado')?.value || 'activa'
    };

    if (!datos.clave_ee || !datos.nombre) {
      alert('⚠️ Campos obligatorios:\n• Clave EE\n• Nombre');
      return;
    }

    try {
      const res = await window.electronAPI.guardarEE(datos);
      
      if (res.success) {
        alert('✅ Experiencia Educativa guardada correctamente');
        
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
      console.error('💥 Error guardando EE:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // UTILIDADES GLOBALES
  // =========================================
  setupGlobalHelpers() {
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
        this.loadRowSummary(row.dataset.id, detailsRow);
      }
    }
    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
  }

  async loadRowSummary(rowId, container) {
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

  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) {
      menu.classList.toggle('hidden');
    }
  }

  openAssignmentModal(eeId) {
    console.log(`🔗 [EEModule] Abrir asignaciones para EE ID: ${eeId}`);
    alert(`🚧 Función en desarrollo:\nGestionar docentes, periodos y contenidos para esta Experiencia Educativa.`);
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  renderEmptyState() {
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
}