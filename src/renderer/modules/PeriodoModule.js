// src/renderer/modules/PeriodoModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalPeriodoHtml from '../views/partials/modals/modal-periodo.html';

export class PeriodoModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
  }

  // =========================================
  // MÉTODO PRINCIPAL DE INICIALIZACIÓN
  // =========================================
  async init() {
    console.log('📘 [PeriodoModule] Sincronizando módulo...');

    // 1. Inyectar Modal (solo si no existe)
    if (!document.getElementById('modal-periodo')) {
      const template = document.createElement('div');
      template.innerHTML = modalPeriodoHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-periodo');
    }

    // 2. Esperar que el tbody exista (crítico para SPA)
    await this.waitForDOMReady('tabla-periodos-body');

    // 3. Cargar datos SOLO si está vacío (Lazy Load)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [PeriodoModule] Cargando datos...');
      await this.loadData();
    }

    // 4. Renderizar: Tabla O estado vacío
    const tbody = document.getElementById('tabla-periodos-body');
    if (!tbody) return;

    if (this.data && this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-periodos-body',
        columns: this.getColumns(),
        expandable: false,
        actions: true,
        onRowClick: 'periodoModuleInstance.handleRowClick(event)',
        onAction: 'periodoModuleInstance.toggleActionMenu(event)',
        onExpand: false
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Periodos renderizada con ${this.data.length} registros`);
    } else {
      this.renderEmptyState();
    }

    // 5. Re-vincular eventos (SIEMPRE, porque el DOM es nuevo)
    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    console.log('✅ [PeriodoModule] Listo');
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
    console.error(`❌ [PeriodoModule] Timeout: tbody "${tbodyId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async loadData() {
    try {
      const res = await window.electronAPI.listarPeriodos();
      if (res.success) {
        this.data = res.rows || res.data;
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error cargando periodos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  getColumns() {
    return [
      { 
        key: 'clave', 
        label: 'Clave',
        format: (v) => `<strong style="font-family:monospace; color:var(--accent-color);">${v}</strong>` 
      },
      { 
        key: 'descripcion', 
        label: 'Descripción' 
      },
      { 
        key: 'fecha_inicio', 
        label: 'Inicio',
        format: (v) => this.formatDate(v)
      },
      { 
        key: 'fecha_fin', 
        label: 'Fin',
        format: (v) => this.formatDate(v)
      },
      { 
        key: 'estado', 
        label: 'Estado',
        badge: true,
        format: (v) => {
          // Mapeo visual de estados de periodo
          const statusMap = {
            'abierto': 'badge-success',
            'cerrado': 'badge-danger',
            'activo': 'badge-success'
          };
          return `<span class="badge ${statusMap[v] || 'badge-secondary'}">${v || 'Desconocido'}</span>`;
        }
      }
    ];
  }

  // Helper para formatear fechas
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  setupSearch() {
    const input = document.getElementById('buscador-periodos');
    if (!input) return;
    
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { this.table?.setData(this.data); return; }
      
      const filtered = this.data.filter(item => 
        (item.clave || '').toLowerCase().includes(txt) || 
        (item.descripcion || '').toLowerCase().includes(txt)
      );
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // GESTIÓN DE MODALES
  // =========================================
  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-periodo');
    const modal = document.getElementById('modal-periodo');
    if (!btnNuevo || !modal) return;

    btnNuevo.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal-periodo')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-periodo')?.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrar(); });

    const btnSave = document.getElementById('btn-guardar-periodo');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => { e.preventDefault(); await this.savePeriodo(modal); });
    }
  }

  openModal(periodo = null) {
    const modal = document.getElementById('modal-periodo');
    const form = document.getElementById('form-periodo');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('per-id').value = '';
    document.getElementById('per-clave-original').value = '';
    
    if (periodo) {
      // Modo edición
      document.getElementById('per-id').value = periodo.id || '';
      document.getElementById('per-clave').value = periodo.clave || '';
      document.getElementById('per-clave-original').value = periodo.clave || '';
      document.getElementById('per-desc').value = periodo.descripcion || '';
      // Inputs type="date" requieren formato YYYY-MM-DD
      document.getElementById('per-inicio').value = periodo.fecha_inicio ? periodo.fecha_inicio.split('T')[0] : '';
      document.getElementById('per-fin').value = periodo.fecha_fin ? periodo.fecha_fin.split('T')[0] : '';
      document.getElementById('per-estado').value = periodo.estado || 'abierto';
    }
    
    modal.classList.remove('hidden');
    document.getElementById('per-clave')?.focus();
  }

  async savePeriodo(modal) {
    const id = document.getElementById('per-id')?.value;
    const clave = document.getElementById('per-clave')?.value?.trim();
    const descripcion = document.getElementById('per-desc')?.value?.trim();
    const fechaInicio = document.getElementById('per-inicio')?.value;
    const fechaFin = document.getElementById('per-fin')?.value;

    if (!clave || !descripcion || !fechaInicio || !fechaFin) {
      return alert('⚠️ Todos los campos son obligatorios');
    }

    // Validación básica de fechas
    if (new Date(fechaFin) < new Date(fechaInicio)) {
      return alert('⚠️ La fecha de fin no puede ser anterior a la fecha de inicio');
    }

    const datos = {
      id: id ? parseInt(id) : null,
      clave: clave,
      descripcion: descripcion,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado: document.getElementById('per-estado')?.value || 'abierto'
    };

    try {
      const res = await window.electronAPI.guardarPeriodo(datos);
      
      if (res.success) {
        alert('✅ Periodo guardado correctamente');
        modal.classList.add('hidden');
        await this.loadData();
        this.table?.setData(this.data);
      } else {
        alert(`❌ Error: ${res.error}`);
      }
    } catch (error) {
      console.error('💥 Error guardando periodo:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // UTILIDADES GLOBALES
  // =========================================
  setupGlobalHelpers() {
    window.periodoModuleInstance = this;
  }

  handleRowClick(event) {
    const row = event.target.closest('.data-row');
    if (!row) return;
    if (event.target.closest('.btn-action-menu')) return;
    
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