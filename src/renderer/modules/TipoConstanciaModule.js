// src/renderer/modules/TipoConstanciaModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalTiposHtml from '../views/partials/modals/modal-tipos-constancia.html';

export class TipoConstanciaModule {
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
    console.log('📘 [TipoConstanciaModule] Sincronizando módulo...');

    // 1. Inyectar Modal
    if (!document.getElementById('modal-tipo-constancia')) {
      const template = document.createElement('div');
      template.innerHTML = modalTiposHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-tipo-constancia');
    }

    // 2. Esperar DOM ready
    await this.waitForDOMReady('tabla-tipos-constancia-body');

    // 3. Lazy Load de datos
    if (!this.data || this.data.length === 0) {
      console.log('📡 [TipoConstanciaModule] Cargando datos...');
      await this.loadData();
    }

    // 4. Renderizar
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
        onExpand: false
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Tipos renderizada con ${this.data.length} registros`);
    } else {
      this.renderEmptyState();
    }

    // 5. Re-vincular eventos
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
        key: 'nombre', 
        label: 'Nombre del Tipo'
      },
      { 
        key: 'requiere_ee', 
        label: 'Req. EE',
        format: (v) => v ? '<i class="fa-solid fa-check" style="color:var(--success-color)"></i>' : '<span style="color:var(--text-muted)">—</span>'
      },
      { 
        key: 'requiere_periodo', 
        label: 'Req. Periodo',
        format: (v) => v ? '<i class="fa-solid fa-check" style="color:var(--success-color)"></i>' : '<span style="color:var(--text-muted)">—</span>'
      },
      { 
        key: 'estado', 
        label: 'Estado',
        badge: true 
      }
    ];
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  setupSearch() {
    const input = document.getElementById('buscador-tipos-constancia');
    if (!input) return;
    
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { this.table?.setData(this.data); return; }
      
      const filtered = this.data.filter(item => 
        (item.nombre || '').toLowerCase().includes(txt) || 
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
    const btnNuevo = document.getElementById('btn-nuevo-tipo-constancia');
    const modal = document.getElementById('modal-tipo-constancia');
    if (!btnNuevo || !modal) return;

    btnNuevo.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal-tipo')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-tipo')?.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrar(); });

    const btnSave = document.getElementById('btn-guardar-tipo-constancia');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => { e.preventDefault(); await this.saveTipo(modal); });
    }
  }

  openModal(tipo = null) {
    const modal = document.getElementById('modal-tipo-constancia');
    const form = document.getElementById('form-tipo-constancia');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('tipo-id').value = '';
    document.getElementById('tipo-clave-original').value = ''; // Campo oculto para lógica de clave
    
    if (tipo) {
      // Modo edición
      document.getElementById('tipo-id').value = tipo.id || '';
      document.getElementById('tipo-clave').value = tipo.clave || '';
      document.getElementById('tipo-clave-original').value = tipo.clave || ''; // Guardamos la clave original
      document.getElementById('tipo-nombre').value = tipo.nombre || '';
      document.getElementById('tipo-descripcion').value = tipo.descripcion || '';
      document.getElementById('tipo-requiere-ee').checked = !!tipo.requiere_ee;
      document.getElementById('tipo-requiere-periodo').checked = !!tipo.requiere_periodo;
      document.getElementById('tipo-estado').value = tipo.estado || 'activo';
    }
    
    modal.classList.remove('hidden');
    document.getElementById('tipo-nombre')?.focus();
  }

  async saveTipo(modal) {
    const id = document.getElementById('tipo-id')?.value;
    const nombre = document.getElementById('tipo-nombre').value.trim();
    const descripcion = document.getElementById('tipo-descripcion').value.trim();
    
    // Lógica inteligente de clave (Solo para nuevos registros)
    let clave = document.getElementById('tipo-clave')?.value?.trim();
    const claveOriginal = document.getElementById('tipo-clave-original')?.value;

    if (!nombre) return alert('⚠️ El nombre es obligatorio');

    // Si es nuevo registro y no se escribió clave manual, generamos una
    if (!id && !clave) {
      const palabras = nombre.toUpperCase().split(' ').filter(p => p.length > 2);
      clave = palabras.slice(0, 2).map(p => p.substring(0, 4)).join('-');
      if(clave.length < 3) clave = 'TIPO-' + Date.now().toString().slice(-4);
    }

    const datos = {
      id: id ? parseInt(id) : null,
      clave: clave, 
      nombre: nombre,
      descripcion: descripcion,
      // 🔄 Conversión de Checkbox a Entero (0/1)
      requiere_ee: document.getElementById('tipo-requiere-ee').checked ? 1 : 0,
      requiere_periodo: document.getElementById('tipo-requiere-periodo').checked ? 1 : 0,
      estado: document.getElementById('tipo-estado')?.value || 'activo'
    };

    try {
      const res = await window.electronAPI.guardarTipoConstancia(datos);
      
      if (res.success) {
        alert('✅ Tipo de Constancia guardado correctamente');
        modal.classList.add('hidden');
        await this.loadData();
        this.table?.setData(this.data);
      } else {
        alert(`❌ Error: ${res.error}`);
      }
    } catch (error) {
      console.error('💥 Error guardando tipo:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // UTILIDADES GLOBALES
  // =========================================
  setupGlobalHelpers() {
    window.tipoConstanciaModuleInstance = this;
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