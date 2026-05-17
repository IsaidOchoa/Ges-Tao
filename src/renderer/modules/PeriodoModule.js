// src/renderer/modules/PeriodoModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalPeriodoHtml from '../views/partials/modals/modal-periodo.html';
import { generarClavePeriodo, validarDuracionPeriodo, generarFechasDesdePlantilla } from '../utils/periodUtils.js';
import '../styles/modals/modal-periodo.css';

export class PeriodoModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.currentPlantilla = 'semestre-a';
    this.currentAnio = new Date().getFullYear();
  }

  async init() {
    console.log('[PeriodoModule] Sincronizando módulo...');

    if (!document.getElementById('modal-periodo')) {
      const template = document.createElement('div');
      template.innerHTML = modalPeriodoHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-periodo');
    }

    await this.waitForDOMReady('tabla-periodos-body');

    if (!this.data || this.data.length === 0) {
      await this.loadData();
    }

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
    } else {
      this.renderEmptyState();
    }

    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    console.log('[PeriodoModule] Listo');
  }

  async waitForDOMReady(tbodyId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(tbodyId)) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.error(`[PeriodoModule] Timeout: tbody "${tbodyId}" no encontrado`);
    return false;
  }

  async loadData() {
    try {
      const res = await window.electronAPI.listarPeriodos();
      if (res.success) {
        this.data = res.rows || res.data;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error cargando periodos:', error);
      return false;
    }
  }

  getColumns() {
    return [
      { 
        key: 'clave', 
        label: 'Código',
        format: (v) => `<strong style="font-family:monospace; color:var(--accent-color);">${v}</strong>` 
      },
      { key: 'descripcion', label: 'Periodo' },
      { key: 'fecha_inicio', label: 'Inicio', format: (v) => this.formatDate(v) },
      { key: 'fecha_fin', label: 'Fin', format: (v) => this.formatDate(v) },
      { key: 'estado', label: 'Estado', badge: true }
    ];
  }

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
  }

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

  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-periodo');
    const modal = document.getElementById('modal-periodo');
    if (!btnNuevo || !modal) return;

    btnNuevo.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    const cerrar = () => modal.classList.add('hidden');
    modal.querySelector('.btn-close')?.addEventListener('click', cerrar);
    modal.querySelector('.btn-cancel')?.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });

    const btnSave = modal.querySelector('#btn-guardar-periodo');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.savePeriodo(modal);
      });
    }

    // Listeners para actualización en tiempo real
    document.querySelectorAll('input[name="plantilla"]').forEach(radio => {
      radio.addEventListener('change', () => this.onPlantillaChange());
    });
    
    document.getElementById('periodo-anio-base')?.addEventListener('change', () => this.onAnioChange());
    document.getElementById('periodo-fecha-inicio')?.addEventListener('change', () => this.updatePreview());
    document.getElementById('periodo-fecha-fin')?.addEventListener('change', () => this.updatePreview());
  }

  initAnioSelector() {
    const select = document.getElementById('periodo-anio-base');
    if (!select) return;
    
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 10;
    const endYear = currentYear + 10;
    
    select.innerHTML = '';
    for (let year = startYear; year <= endYear; year++) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      if (year === currentYear) option.selected = true;
      select.appendChild(option);
    }
  }

  onPlantillaChange() {
    const plantilla = document.querySelector('input[name="plantilla"]:checked')?.value;
    this.currentPlantilla = plantilla;
    
    const sectionFechas = document.getElementById('section-fechas');
    const fechaInicio = document.getElementById('periodo-fecha-inicio');
    const fechaFin = document.getElementById('periodo-fecha-fin');
    
    if (plantilla === 'personalizado') {
      sectionFechas?.classList.remove('hidden');
      if (fechaInicio) { fechaInicio.required = true; fechaInicio.disabled = false; }
      if (fechaFin) { fechaFin.required = true; fechaFin.disabled = false; }
    } else {
      sectionFechas?.classList.add('hidden');
      if (fechaInicio) { fechaInicio.required = false; fechaInicio.disabled = true; }
      if (fechaFin) { fechaFin.required = false; fechaFin.disabled = true; }
      this.updatePreview();
    }
  }

  onAnioChange() {
    this.currentAnio = parseInt(document.getElementById('periodo-anio-base')?.value || new Date().getFullYear());
    this.updatePreview();
  }

  updatePreview() {
    const plantilla = this.currentPlantilla;
    const anio = this.currentAnio;
    const previewText = document.getElementById('preview-text');
    const claveField = document.getElementById('periodo-clave');
    const descField = document.getElementById('periodo-descripcion');
    
    let clave = '';
    let descripcion = '';
    
    if (plantilla === 'semestre-a') {
      clave = `FEB-JUL${anio.toString().slice(-2)}`;
      descripcion = `FEB ${anio} - JUL ${anio}`;
    } else if (plantilla === 'semestre-b') {
      const anioFin = anio + 1;
      clave = `AGO-ENE${anioFin.toString().slice(-2)}`;
      descripcion = `AGO ${anio} - ENE ${anioFin}`;
    } else if (plantilla === 'personalizado') {
      const fechaInicio = document.getElementById('periodo-fecha-inicio')?.value;
      const fechaFin = document.getElementById('periodo-fecha-fin')?.value;
      
      if (fechaInicio && fechaFin) {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const mesInicio = inicio.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
        const mesFin = fin.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
        const anioFin = fin.getFullYear();
        
        clave = `${mesInicio}-${mesFin}${anioFin.toString().slice(-2)}`;
        descripcion = `${mesInicio} ${inicio.getFullYear()} - ${mesFin} ${anioFin}`;
      }
    }
    
    if (claveField) claveField.value = clave;
    if (descField && plantilla !== 'personalizado') descField.value = descripcion;
    if (previewText) previewText.textContent = descripcion || 'Seleccione una plantilla';
  }

  openModal(periodo = null) {
    const modal = document.getElementById('modal-periodo');
    const form = document.getElementById('form-periodo');
    if (!modal || !form) return;
    
    form.reset();
    
    this.initAnioSelector();
    
    const plantillaSemestreA = document.querySelector('input[name="plantilla"][value="semestre-a"]');
    if (plantillaSemestreA) plantillaSemestreA.checked = true;
    
    this.currentPlantilla = 'semestre-a';
    this.currentAnio = new Date().getFullYear();
    
    const anioSelect = document.getElementById('periodo-anio-base');
    if (anioSelect) anioSelect.value = this.currentAnio;
    
    if (periodo) {
      const idField = document.getElementById('periodo-id');
      if (idField) idField.value = periodo.id || '';
      
      const claveField = document.getElementById('periodo-clave');
      if (claveField) claveField.value = periodo.clave || '';
      
      const descField = document.getElementById('periodo-descripcion');
      if (descField) descField.value = periodo.descripcion || '';
      
      const estadoField = document.getElementById('periodo-estado');
      if (estadoField) estadoField.value = periodo.estado || 'abierto';
      
      // Detectar plantilla desde la clave
      if (periodo.clave?.startsWith('FEB-JUL')) {
        const plantillaA = document.querySelector('input[name="plantilla"][value="semestre-a"]');
        if (plantillaA) plantillaA.checked = true;
        this.currentPlantilla = 'semestre-a';
      } else if (periodo.clave?.startsWith('AGO-ENE')) {
        const plantillaB = document.querySelector('input[name="plantilla"][value="semestre-b"]');
        if (plantillaB) plantillaB.checked = true;
        this.currentPlantilla = 'semestre-b';
      } else {
        const plantillaPersonalizado = document.querySelector('input[name="plantilla"][value="personalizado"]');
        if (plantillaPersonalizado) plantillaPersonalizado.checked = true;
        this.currentPlantilla = 'personalizado';
        
        const fechaInicio = document.getElementById('periodo-fecha-inicio');
        const fechaFin = document.getElementById('periodo-fecha-fin');
        if (periodo.fecha_inicio && fechaInicio) fechaInicio.value = periodo.fecha_inicio.split('T')[0];
        if (periodo.fecha_fin && fechaFin) fechaFin.value = periodo.fecha_fin.split('T')[0];
      }
      
      this.onPlantillaChange();
      this.updatePreview();
    } else {
      this.onPlantillaChange();
    }
    
    modal.classList.remove('hidden');
  }

  async savePeriodo(modal) {
    const form = document.getElementById('form-periodo');
    const datos = {
      id: document.getElementById('periodo-id')?.value ? parseInt(document.getElementById('periodo-id').value) : null,
      clave: document.getElementById('periodo-clave')?.value?.trim(),
      descripcion: document.getElementById('periodo-descripcion')?.value?.trim(),
      anio_base: parseInt(document.getElementById('periodo-anio-base')?.value),
      fecha_inicio: document.getElementById('periodo-fecha-inicio')?.value || null,
      fecha_fin: document.getElementById('periodo-fecha-fin')?.value || null,
      estado: document.getElementById('periodo-estado')?.value || 'abierto'
    };
    
    if (!datos.clave || !datos.descripcion) {
      alert('Clave y descripción son obligatorios');
      return;
    }
    
    if (datos.fecha_inicio && datos.fecha_fin) {
      if (!validarDuracionPeriodo(datos.fecha_inicio, datos.fecha_fin, 6)) {
        alert('Los periodos no pueden exceder 6 meses de duración');
        return;
      }
      if (new Date(datos.fecha_fin) < new Date(datos.fecha_inicio)) {
        alert('La fecha de fin no puede ser anterior a la de inicio');
        return;
      }
    }
    
    try {
      const res = await window.electronAPI.guardarPeriodo(datos);
      if (res.success) {
        modal.classList.add('hidden');
        await this.loadData();
        this.table?.setData(this.data);
      } else {
        alert(`Error: ${res.error}`);
      }
    } catch (error) {
      console.error('Error guardando periodo:', error);
      alert('Error de conexión');
    }
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

  renderEmptyState() {
    const tbody = document.getElementById('tabla-periodos-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:50px;color:var(--text-muted)">
      <i class="fa-regular fa-calendar-days" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
      <p style="margin:0">No hay periodos registrados</p></td></tr>`;
  }
}