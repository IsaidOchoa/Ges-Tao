// src/renderer/modules/PeriodoModule.js
// 📍 Arquitectura: Módulo autocontenido para gestión de Periodos Escolares
// 🔗 DB Schema: periodos(clave, descripcion, fecha_inicio, fecha_fin, estado)

import { DataTable } from '../components/DataTable/DataTable.js';
import modalPeriodoHtml from '../views/partials/modals/modal-periodo.html';
import { generarClavePeriodo, validarDuracionPeriodo, generarFechasDesdePlantilla } from '../utils/periodUtils.js';

export class PeriodoModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
  }

  // =========================================
  // MÉTODO PRINCIPAL DE INICIALIZACIÓN (Re-entrante)
  // =========================================
  async init() {
    console.log('📘 [PeriodoModule] Sincronizando módulo...');

    // 1. Inyectar Modal (solo si no existe)
    if (!document.getElementById('modal-periodo')) {
      const template = document.createElement('div');
      template.innerHTML = modalPeriodoHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-periodo');
      console.log('✅ Modal Periodo inyectado');
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
        label: 'Código',
        format: (v) => `<strong style="font-family:monospace; color:var(--accent-color);">${v}</strong>` 
      },
      { 
        key: 'descripcion', 
        label: 'Periodo' 
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
        badge: true 
      }
    ];
  }

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
  // GESTIÓN DE MODALES - ✅ CORREGIDO
  // =========================================
  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-periodo');
    const modal = document.getElementById('modal-periodo');
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [PeriodoModule] Elementos del modal no encontrados');
      return;
    }

    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this.openModal();
    };
    
    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal-periodo')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-periodo')?.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrar(); });

    const btnSave = document.getElementById('btn-guardar-periodo');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.savePeriodo(modal);
      });
    }
  }

  // ✅ openModal CORREGIDO con IDs exactos y null checks
  openModal(periodo = null) {
    const modal = document.getElementById('modal-periodo');
    const form = document.getElementById('form-periodo');
    if (!modal || !form) {
      console.error('❌ Modal o formulario no encontrados');
      return;
    }

    form.reset();
    
    // ✅ Null checks antes de asignar valores
    const idField = document.getElementById('per-id');
    if (idField) idField.value = '';

    const anoBase = document.getElementById('per-ano-base');
    if (anoBase) anoBase.value = new Date().getFullYear().toString();

    // Si es edición, cargar datos existentes
    if (periodo) {
      if (idField) idField.value = periodo.id || '';
      
      const claveField = document.getElementById('per-clave-preview');
      if (claveField) claveField.value = periodo.clave || '';
      
      const descField = document.getElementById('per-desc');
      if (descField) descField.value = periodo.descripcion || '';
      
      const inicioField = document.getElementById('per-inicio');
      if (inicioField && periodo.fecha_inicio) {
        inicioField.value = periodo.fecha_inicio.split('T')[0];
      }
      
      const finField = document.getElementById('per-fin');
      if (finField && periodo.fecha_fin) {
        finField.value = periodo.fecha_fin.split('T')[0];
      }
      
      const estadoField = document.getElementById('per-estado');
      if (estadoField) estadoField.value = periodo.estado || 'abierto';
      
      // Actualizar preview visual
      this.actualizarPreview(periodo.clave, periodo.descripcion);
    } else {
      // Modo nuevo: generar fechas desde plantilla por defecto
      this.actualizarFechasDesdePlantilla();
    }
    
    modal.classList.remove('hidden');
    
    // Focus en el primer campo visible
    const claveField = document.getElementById('per-clave-preview');
    if (claveField) claveField.focus();
  }

  // ✅ savePeriodo con validaciones y mapeo correcto
  async savePeriodo(modal) {
    const id = document.getElementById('per-id')?.value;
    const clave = document.getElementById('per-clave-preview')?.value?.trim();
    const descripcion = document.getElementById('per-desc')?.value?.trim();
    const fechaInicio = document.getElementById('per-inicio')?.value;
    const fechaFin = document.getElementById('per-fin')?.value;
    const estado = document.getElementById('per-estado')?.value || 'abierto';

    // Validaciones básicas
    if (!clave || !descripcion || !fechaInicio || !fechaFin) {
      return alert('⚠️ Todos los campos son obligatorios');
    }

    // Validar duración máxima (6 meses)
    if (!validarDuracionPeriodo(fechaInicio, fechaFin, 6)) {
      return alert('⚠️ Los periodos no pueden exceder 6 meses de duración');
    }

    // Validar lógica de fechas
    if (new Date(fechaFin) < new Date(fechaInicio)) {
      return alert('⚠️ La fecha de fin no puede ser anterior a la de inicio');
    }

    const datos = {
      id: id ? parseInt(id) : null,
      clave: clave,
      descripcion: descripcion,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado: estado
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
  // LÓGICA DE PLANTILLAS Y VALIDACIÓN
  // =========================================
  
  actualizarFechasDesdePlantilla() {
    const plantilla = document.querySelector('input[name="plantilla"]:checked')?.value;
    const anoBaseEl = document.getElementById('per-ano-base');
    const ano = anoBaseEl ? parseInt(anoBaseEl.value) : new Date().getFullYear();
    
    if (!plantilla || plantilla === 'personalizado') {
      this.activarModoPersonalizado();
      return;
    }
    
    try {
      const { fechaInicio, fechaFin, clave, descripcion } = generarFechasDesdePlantilla(plantilla, ano);
      
      const inicioEl = document.getElementById('per-inicio');
      const finEl = document.getElementById('per-fin');
      const claveEl = document.getElementById('per-clave-preview');
      const descEl = document.getElementById('per-desc');
      
      if (inicioEl) inicioEl.value = fechaInicio;
      if (finEl) finEl.value = fechaFin;
      if (claveEl) claveEl.value = clave;
      if (descEl) descEl.value = descripcion;
      
      this.actualizarPreview(clave, descripcion);
      this.mostrarValidacion('✓ Periodo válido', 'success');
    } catch (error) {
      console.error('Error generando fechas:', error);
      this.mostrarValidacion('❌ Error al generar fechas', 'error');
    }
  }

  activarModoPersonalizado() {
    const inicioEl = document.getElementById('per-inicio');
    const finEl = document.getElementById('per-fin');
    const claveEl = document.getElementById('per-clave-preview');
    
    if (inicioEl) inicioEl.disabled = false;
    if (finEl) finEl.disabled = false;
    if (claveEl) claveEl.value = '';
    
    this.mostrarValidacion('✏️ Edita las fechas manualmente', 'warning');
  }

  validarYActualizarClave() {
    const inicio = document.getElementById('per-inicio')?.value;
    const fin = document.getElementById('per-fin')?.value;
    
    if (!inicio || !fin) return;
    
    // Validar duración máxima
    if (!validarDuracionPeriodo(inicio, fin, 6)) {
      this.mostrarValidacion('⚠️ Los periodos no pueden exceder 6 meses', 'warning');
      return;
    }
    
    // Validar lógica
    if (new Date(fin) < new Date(inicio)) {
      this.mostrarValidacion('❌ Fecha fin no puede ser anterior a inicio', 'error');
      return;
    }
    
    // Generar clave
    const clave = generarClavePeriodo(inicio, fin);
    const claveEl = document.getElementById('per-clave-preview');
    if (claveEl) claveEl.value = clave;
    
    this.actualizarPreview(clave);
    this.mostrarValidacion('✓ Periodo válido', 'success');
  }

  actualizarPreview(clave, descripcion = '') {
    const previewDesc = document.getElementById('preview-descripcion');
    const previewDur = document.getElementById('preview-duracion');
    
    if (previewDesc && clave) {
      previewDesc.textContent = `${clave}${descripcion ? `: ${descripcion}` : ''}`;
    }
    
    // Calcular duración aproximada para el badge
    if (previewDur) {
      previewDur.textContent = '✓ Válido';
      previewDur.style.color = 'var(--success-color)';
    }
  }

  mostrarValidacion(mensaje, tipo) {
    const container = document.getElementById('periodo-validation');
    if (!container) return;
    
    container.textContent = mensaje;
    container.className = `form-feedback ${tipo}`;
    container.classList.remove('hidden');
    
    // Ocultar automáticamente después de 3 segundos si es éxito
    if (tipo === 'success') {
      setTimeout(() => container.classList.add('hidden'), 3000);
    }
  }

  // =========================================
  // ESTADO VACÍO Y UTILIDADES
  // =========================================
  
  renderEmptyState() {
    const tbody = document.getElementById('tabla-periodos-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding: 50px 20px; color:var(--text-muted);">
          <i class="fa-regular fa-calendar-days" 
             style="font-size: 2.5rem; margin: 0 auto 15px auto; display: block; opacity: 0.6;"></i>
          <p style="margin: 0; font-size: 1rem;">Sin periodos escolares registrados</p>
        </td>
      </tr>
    `;
  }

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