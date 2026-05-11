// src/renderer/modules/ProgramaModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalProgramaHtml from '../views/partials/modals/modal-programa.html';

export class ProgramaModule {
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
    console.log('📘 [ProgramaModule] Sincronizando módulo...');

    // 1. Inyectar Modal
    if (!document.getElementById('modal-programa')) {
      const template = document.createElement('div');
      template.innerHTML = modalProgramaHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-programa');
    }

    // 2. Esperar DOM ready
    await this.waitForDOMReady('tabla-programas-body');

    // 3. Lazy Load de datos
    if (!this.data || this.data.length === 0) {
      console.log('📡 [ProgramaModule] Cargando datos...');
      await this.loadData();
    }

    // 4. Renderizar
    const tbody = document.getElementById('tabla-programas-body');
    if (!tbody) return;

    if (this.data && this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-programas-body',
        columns: this.getColumns(),
        expandable: false,
        actions: true,
        onRowClick: 'programaModuleInstance.handleRowClick(event)',
        onAction: 'programaModuleInstance.toggleActionMenu(event)',
        onExpand: false
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Programas renderizada con ${this.data.length} registros`);
    } else {
      this.renderEmptyState();
    }

    // 5. Re-vincular eventos
    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    console.log('✅ [ProgramaModule] Listo');
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
    console.error(`❌ [ProgramaModule] Timeout: tbody "${tbodyId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async loadData() {
    try {
      const res = await window.electronAPI.listarProgramas();
      if (res.success) {
        this.data = res.rows || res.data;
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Error cargando programas:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  getColumns() {
    return [
      { 
        key: 'nombre', 
        label: 'Nombre del Programa'
      },
      { 
        key: 'responsable', 
        label: 'Responsable' 
      },
      { 
        key: 'fecha_registro', 
        label: 'Fecha Registro',
        format: (v) => this.formatDate(v)
      },
      { 
        key: 'estado', 
        label: 'Estado',
        badge: true 
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
    const input = document.getElementById('buscador-programas');
    if (!input) return;
    
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { this.table?.setData(this.data); return; }
      
      const filtered = this.data.filter(item => 
        (item.nombre || '').toLowerCase().includes(txt) || 
        (item.responsable || '').toLowerCase().includes(txt) ||
        (item.descripcion || '').toLowerCase().includes(txt)
      );
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // GESTIÓN DE MODALES
  // =========================================
  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-programa');
    const modal = document.getElementById('modal-programa');
    if (!btnNuevo || !modal) return;

    btnNuevo.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal-programa')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-programa')?.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrar(); });

    const btnSave = document.getElementById('btn-guardar-programa');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => { e.preventDefault(); await this.savePrograma(modal); });
    }
  }

  openModal(programa = null) {
    const modal = document.getElementById('modal-programa');
    const form = document.getElementById('form-programa');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('prog-id').value = '';
    document.getElementById('prog-fecha').value = new Date().toISOString().split('T')[0]; // Default a hoy
    
    if (programa) {
      // Modo edición
      document.getElementById('prog-id').value = programa.id || '';
      document.getElementById('prog-nombre').value = programa.nombre || '';
      document.getElementById('prog-desc').value = programa.descripcion || '';
      document.getElementById('prog-resp').value = programa.responsable || '';
      document.getElementById('prog-fecha').value = programa.fecha_registro ? programa.fecha_registro.split('T')[0] : '';
      document.getElementById('prog-estado').value = programa.estado || 'vigente';
    }
    
    modal.classList.remove('hidden');
    document.getElementById('prog-nombre')?.focus();
  }

  async savePrograma(modal) {
    const id = document.getElementById('prog-id')?.value;
    const nombre = document.getElementById('prog-nombre').value.trim();
    const descripcion = document.getElementById('prog-desc').value.trim();
    const responsable = document.getElementById('prog-resp').value.trim();
    const fecha = document.getElementById('prog-fecha').value;

    if (!nombre || !responsable) {
      return alert('⚠️ Nombre y Responsable son obligatorios');
    }

    const datos = {
      id: id ? parseInt(id) : null,
      nombre: nombre,
      descripcion: descripcion,
      responsable: responsable,
      fecha_registro: fecha,
      estado: document.getElementById('prog-estado')?.value || 'vigente'
    };

    try {
      const res = await window.electronAPI.guardarPrograma(datos);
      
      if (res.success) {
        alert('✅ Programa guardado correctamente');
        modal.classList.add('hidden');
        await this.loadData();
        this.table?.setData(this.data);
      } else {
        alert(`❌ Error: ${res.error}`);
      }
    } catch (error) {
      console.error('💥 Error guardando programa:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // UTILIDADES GLOBALES
  // =========================================
  setupGlobalHelpers() {
    window.programaModuleInstance = this;
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