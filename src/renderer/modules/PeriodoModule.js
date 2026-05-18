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

  // =========================================
  // INICIALIZACIÓN (Re-entrante)
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

    // 2. Esperar que el tbody exista
    await this.waitForDOMReady('tabla-periodos-body');

    // 3. Cargar datos (Lazy Load)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [PeriodoModule] Cargando datos...');
      await this.loadData();
    }

    // 4. Renderizar tabla o estado vacío
    const tbody = document.getElementById('tabla-periodos-body');
    if (!tbody) {
      console.error('❌ [PeriodoModule] tbody no encontrado');
      return;
    }

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

    // 5. Vincular eventos
    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    console.log('✅ [PeriodoModule] Inicialización completa');
  }

  // =========================================
  // UTILIDAD: Esperar DOM
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
  // COLUMNAS DE TABLA
  // =========================================
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

  // =========================================
  // BUSCADOR
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
    // EVENTOS DEL MODAL
    // =========================================
    setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-periodo');
    const modal = document.getElementById('modal-periodo');
    if (!btnNuevo || !modal) {
        console.warn('⚠️ [PeriodoModule] Elementos del modal no encontrados');
        return;
    }

    // Abrir modal
    btnNuevo.onclick = (e) => { e.preventDefault(); this.openModal(); };
    
    // Cerrar modal
    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal-periodo')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-periodo')?.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });

    // Guardar
    const btnSave = document.getElementById('btn-guardar-periodo');
    if (btnSave) {
        const newBtn = btnSave.cloneNode(true);
        btnSave.parentNode.replaceChild(newBtn, btnSave);
        newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.savePeriodo(modal);
        });
    }

    // ✅ Listeners para radios - CORREGIDO: Mostrar/ocultar fechas
    modal.querySelectorAll('input[name="plantilla"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'personalizado') {
            this.activarModoPersonalizado();
        } else {
            this.ocultarFechasPersonalizadas(); // ✅ NUEVO: Ocultar al cambiar
            this.actualizarFechasDesdePlantilla();
        }
        });
    });
    
    // Listeners para año y fechas
    document.getElementById('periodo-anio-base')?.addEventListener('change', () => this.actualizarFechasDesdePlantilla());
    document.getElementById('periodo-fecha-inicio')?.addEventListener('change', () => this.validarYActualizarClave());
    document.getElementById('periodo-fecha-fin')?.addEventListener('change', () => this.validarYActualizarClave());
    }

  // =========================================
  // LÓGICA DE PLANTILLAS
  // =========================================
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

  actualizarFechasDesdePlantilla() {
    const plantilla = document.querySelector('input[name="plantilla"]:checked')?.value;
    const anioEl = document.getElementById('periodo-anio-base');
    const anio = anioEl ? parseInt(anioEl.value) : new Date().getFullYear();
    
    if (!plantilla || plantilla === 'personalizado') {
      this.activarModoPersonalizado();
      return;
    }
    
    try {
      const { fechaInicio, fechaFin, clave, descripcion } = generarFechasDesdePlantilla(plantilla, anio);
      
      document.getElementById('periodo-fecha-inicio').value = fechaInicio;
      document.getElementById('periodo-fecha-fin').value = fechaFin;
      document.getElementById('periodo-clave').value = clave;
      document.getElementById('periodo-descripcion').value = descripcion;
      
      this.actualizarPreview(clave, descripcion);
      this.mostrarValidacion('✓ Periodo válido', 'success');
    } catch (error) {
      console.error('Error generando fechas:', error);
      this.mostrarValidacion('❌ Error al generar fechas', 'error');
    }
  }

  activarModoPersonalizado() {
    const sectionFechas = document.getElementById('section-fechas');
    const inicioEl = document.getElementById('periodo-fecha-inicio');
    const finEl = document.getElementById('periodo-fecha-fin');
    const claveEl = document.getElementById('periodo-clave');
    
    // ✅ Mostrar sección con animación
    if (sectionFechas) {
        sectionFechas.classList.remove('hidden');
        sectionFechas.style.animation = 'none';
        setTimeout(() => { sectionFechas.style.animation = ''; }, 10);
    }
    
    // ✅ Habilitar campos
    if (inicioEl) { inicioEl.disabled = false; inicioEl.required = true; }
    if (finEl) { finEl.disabled = false; finEl.required = true; }
    
    // ✅ Limpiar solo si no hay valores
    if (claveEl && !inicioEl.value) claveEl.value = '';
    
    this.mostrarValidacion('✏️ Edita las fechas manualmente', 'warning');
    }

  ocultarFechasPersonalizadas() {
    const sectionFechas = document.getElementById('section-fechas');
    const inicioEl = document.getElementById('periodo-fecha-inicio');
    const finEl = document.getElementById('periodo-fecha-fin');
    
    if (sectionFechas) sectionFechas.classList.add('hidden');
    if (inicioEl) { inicioEl.disabled = true; inicioEl.required = false; inicioEl.value = ''; }
    if (finEl) { finEl.disabled = true; finEl.required = false; finEl.value = ''; }
    }

  validarYActualizarClave() {
    const inicio = document.getElementById('periodo-fecha-inicio')?.value;
    const fin = document.getElementById('periodo-fecha-fin')?.value;
    
    if (!inicio || !fin) return;
    
    if (!validarDuracionPeriodo(inicio, fin, 6)) {
      this.mostrarValidacion('⚠️ Los periodos no pueden exceder 6 meses', 'warning');
      return;
    }
    
    if (new Date(fin) < new Date(inicio)) {
      this.mostrarValidacion('❌ Fecha fin no puede ser anterior a inicio', 'error');
      return;
    }
    
    const clave = generarClavePeriodo(inicio, fin);
    document.getElementById('periodo-clave').value = clave;
    this.actualizarPreview(clave);
    this.mostrarValidacion('✓ Periodo válido', 'success');
  }

  actualizarPreview(clave, descripcion = '') {
    const previewDesc = document.getElementById('preview-descripcion');
    const previewDur = document.getElementById('preview-duracion');
    
    if (previewDesc && clave) {
      previewDesc.textContent = `${clave}${descripcion ? `: ${descripcion}` : ''}`;
    }
    
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
    
    if (tipo === 'success') {
      setTimeout(() => container.classList.add('hidden'), 3000);
    }
  }

  // =========================================
  // ABRIR MODAL
  // =========================================
  openModal(periodo = null) {
    const modal = document.getElementById('modal-periodo');
    const form = document.getElementById('form-periodo');
    if (!modal || !form) return;
    
    // Resetear formulario
    form.reset();
    
    // ✅ Ocultar fechas personalizadas al inicio (corrección crítica)
    this.ocultarFechasPersonalizadas();
    
    // Inicializar selector de años
    this.initAnioSelector();
    
    // Seleccionar plantilla por defecto (Semestre A)
    const plantillaSemestreA = document.querySelector('input[name="plantilla"][value="semestre-a"]');
    if (plantillaSemestreA) plantillaSemestreA.checked = true;
    
    this.currentPlantilla = 'semestre-a';
    this.currentAnio = new Date().getFullYear();
    
    // Establecer año base en el select
    const anioSelect = document.getElementById('periodo-anio-base');
    if (anioSelect) anioSelect.value = this.currentAnio;
    
    if (periodo) {
        // =========================================
        // MODO EDICIÓN: Precargar datos existentes
        // =========================================
        
        // Campos básicos
        const idField = document.getElementById('periodo-id');
        if (idField) idField.value = periodo.id || '';
        
        const claveField = document.getElementById('periodo-clave');
        if (claveField) claveField.value = periodo.clave || '';
        
        const descField = document.getElementById('periodo-descripcion');
        if (descField) descField.value = periodo.descripcion || '';
        
        const estadoField = document.getElementById('periodo-estado');
        if (estadoField) estadoField.value = periodo.estado || 'abierto';
        
        // =========================================
        // Detectar plantilla desde la clave existente
        // =========================================
        if (periodo.clave && periodo.clave.startsWith('FEB-JUL')) {
        // Es Semestre A
        const plantillaA = document.querySelector('input[name="plantilla"][value="semestre-a"]');
        if (plantillaA) plantillaA.checked = true;
        this.currentPlantilla = 'semestre-a';
        
        } else if (periodo.clave && periodo.clave.startsWith('AGO-ENE')) {
        // Es Semestre B
        const plantillaB = document.querySelector('input[name="plantilla"][value="semestre-b"]');
        if (plantillaB) plantillaB.checked = true;
        this.currentPlantilla = 'semestre-b';
        
        } else {
        // Es Personalizado (clave no coincide con patrones)
        const plantillaPersonalizado = document.querySelector('input[name="plantilla"][value="personalizado"]');
        if (plantillaPersonalizado) plantillaPersonalizado.checked = true;
        this.currentPlantilla = 'personalizado';
        
        // Cargar fechas manuales si existen
        const fechaInicio = document.getElementById('periodo-fecha-inicio');
        const fechaFin = document.getElementById('periodo-fecha-fin');
        if (periodo.fecha_inicio && fechaInicio) {
            fechaInicio.value = periodo.fecha_inicio.split('T')[0];
        }
        if (periodo.fecha_fin && fechaFin) {
            fechaFin.value = periodo.fecha_fin.split('T')[0];
        }
        }
        
        // =========================================
        // Aplicar estado visual según plantilla detectada
        // =========================================
        if (this.currentPlantilla === 'personalizado') {
        this.activarModoPersonalizado();
        } else {
        this.actualizarFechasDesdePlantilla();
        }
        
    } else {
        // =========================================
        // MODO NUEVO: Iniciar con valores por defecto
        // =========================================
        this.actualizarFechasDesdePlantilla();
    }
    
    // Mostrar modal
    modal.classList.remove('hidden');
    
    // Enfocar primer campo editable para mejor UX
    const primerCampo = document.getElementById('periodo-anio-base');
    if (primerCampo) primerCampo.focus();
    }

  // =========================================
  // GUARDAR PERIODO
  // =========================================
  async savePeriodo(modal) {
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

  // =========================================
  // HELPERS GLOBALES
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

  renderEmptyState() {
    const tbody = document.getElementById('tabla-periodos-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:50px;color:var(--text-muted)">
      <i class="fa-regular fa-calendar-days" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
      <p style="margin:0">No hay periodos registrados</p></td></tr>`;
  }
}