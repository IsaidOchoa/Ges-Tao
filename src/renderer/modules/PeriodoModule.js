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

    // =========================================
  // FORMATO DE FECHA (Timezone-Safe)
  // =========================================
  
  formatDate(dateStr) {
    if (!dateStr) return '-';
    
    // ✅ Parseo manual para evitar problemas de zona horaria
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // Mes es 0-based en JS
    
    return date.toLocaleDateString('es-MX', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  }


  formatDateDisplay(dateStr) {
    if (!dateStr) return '-';
    
    // ✅ Mismo parseo manual seguro
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('es-MX', { 
      day: 'numeric',    // Sin '2-digit' para que se vea "1" no "01"
      month: 'short', 
      year: 'numeric' 
    });
  }

  formatMes(monthIndex) {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return meses[monthIndex];
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

    // Listeners para radios de plantilla
    modal.querySelectorAll('input[name="plantilla"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'personalizado') {
          this.activarModoPersonalizado();
        } else {
          this.ocultarFechasPersonalizadas();
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
    // =========================================
  // INICIALIZAR SELECTOR DE AÑOS (Dinámico)
  // =========================================
  initAnioSelector() {
    const select = document.getElementById('periodo-anio-base');
    if (!select) return;
    
    const currentYear = new Date().getFullYear();
    
    // Rango dinámico: 60 años atrás hasta 2 años adelante
    const minYear = currentYear - 60;  // Ej: 2026 - 60 = 1966
    const maxYear = currentYear + 1;   // Ej: 2026 + 1 = 2027
    
    select.innerHTML = '';
    
    // ✅ Generar opciones en orden descendente (más reciente primero)
    for (let year = maxYear; year >= minYear; year--) {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      
      // Seleccionar el año actual por defecto
      if (year === currentYear) {
        option.selected = true;
      }
      
      select.appendChild(option);
    }
    
    console.log(`✅ [PeriodoModule] Selector de años: ${minYear} - ${maxYear} (actual: ${currentYear})`);
  }

    // =========================================
  // ACTUALIZAR FECHAS DESDE PLANTILLA (Corregido)
  // =========================================
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
      
      // ✅ Actualizar inputs HIDDEN con validación
      const inicioHidden = document.getElementById('periodo-fecha-inicio-hidden');
      const finHidden = document.getElementById('periodo-fecha-fin-hidden');
      const claveInput = document.getElementById('periodo-clave');
      const descInput = document.getElementById('periodo-descripcion');
      
      if (inicioHidden) inicioHidden.value = fechaInicio;
      if (finHidden) finHidden.value = fechaFin;
      if (claveInput) claveInput.value = clave;
      if (descInput) descInput.value = descripcion;
      
      // ✅ Actualizar visualización con validación
      const resultClave = document.getElementById('result-clave');
      const displayClave = document.getElementById('display-clave');
      const resultRango = document.getElementById('result-rango');
      const displayInicio = document.getElementById('display-fecha-inicio');
      const displayFin = document.getElementById('display-fecha-fin');
      
      if (resultClave) resultClave.textContent = clave;
      if (displayClave) displayClave.textContent = clave;
      if (resultRango) resultRango.textContent = descripcion;
      
      if (displayInicio) displayInicio.textContent = this.formatDateDisplay(fechaInicio);
      if (displayFin) displayFin.textContent = this.formatDateDisplay(fechaFin);
      
      // ✅ Mostrar sección automática y ocultar personalizada
      this.ocultarFechasPersonalizadas();
      
      // ✅ Actualizar panel de estado
      this.actualizarEstado('valid', 'Periodo válido', 'Listo para guardar');
      
    } catch (error) {
      console.error('Error generando fechas:', error);
      this.actualizarEstado('error', 'Error al generar fechas', error.message);
    }
  }

  // =========================================
  // ACTIVAR MODO PERSONALIZADO (Corregido)
  // =========================================
  activarModoPersonalizado() {
    const sectionPersonalizada = document.getElementById('section-fechas-personalizadas');
    const sectionAutomatica = document.getElementById('section-fechas-automaticas');
    const inicioEl = document.getElementById('periodo-fecha-inicio');
    const finEl = document.getElementById('periodo-fecha-fin');
    
    // ✅ Mostrar/ocultar secciones con validación
    if (sectionPersonalizada) sectionPersonalizada.classList.remove('hidden');
    if (sectionAutomatica) sectionAutomatica.classList.add('hidden');
    
    // ✅ Habilitar campos de fecha reales con validación
    if (inicioEl) { 
      inicioEl.disabled = false; 
      inicioEl.required = true; 
    }
    if (finEl) { 
      finEl.disabled = false; 
      finEl.required = true; 
    }
    
    // ✅ Limpiar valores visuales (pero no los hidden aún)
    const displayInicio = document.getElementById('display-fecha-inicio');
    const displayFin = document.getElementById('display-fecha-fin');
    if (displayInicio) displayInicio.textContent = '--/--/----';
    if (displayFin) displayFin.textContent = '--/--/----';
    
    this.actualizarEstado('warning', 'Modo personalizado', 'Define las fechas manualmente');
  }

  // =========================================
  // OCULTAR FECHAS PERSONALIZADAS (Corregido)
  // =========================================
  ocultarFechasPersonalizadas() {
    const sectionPersonalizada = document.getElementById('section-fechas-personalizadas');
    const sectionAutomatica = document.getElementById('section-fechas-automaticas');
    const inicioEl = document.getElementById('periodo-fecha-inicio');
    const finEl = document.getElementById('periodo-fecha-fin');
    
    // ✅ Alternar visibilidad con validación
    if (sectionPersonalizada) sectionPersonalizada.classList.add('hidden');
    if (sectionAutomatica) sectionAutomatica.classList.remove('hidden');
    
    // ✅ Deshabilitar campos y limpiar SOLO si existen
    if (inicioEl) { 
      inicioEl.disabled = true; 
      inicioEl.required = false; 
      // NO limpiar el valor, lo necesitamos si el usuario regresa
    }
    if (finEl) { 
      finEl.disabled = true; 
      finEl.required = false;
      // NO limpiar el valor
    }
  }

  // =========================================
  // VALIDAR Y ACTUALIZAR CLAVE (Corregido)
  // =========================================
  validarYActualizarClave() {
    const inicioInput = document.getElementById('periodo-fecha-inicio');
    const finInput = document.getElementById('periodo-fecha-fin');
    
    const inicio = inicioInput?.value;
    const fin = finInput?.value;
    
    if (!inicio || !fin) {
      this.actualizarEstado('warning', 'Fechas pendientes', 'Selecciona inicio y fin');
      return;
    }
    
    if (!validarDuracionPeriodo(inicio, fin, 6)) {
      this.actualizarEstado('warning', 'Duración excedida', 'Los periodos no pueden exceder 6 meses');
      return;
    }
    
    if (new Date(fin) < new Date(inicio)) {
      this.actualizarEstado('error', 'Fechas inválidas', 'La fecha de fin no puede ser anterior a inicio');
      return;
    }
    
    // ✅ Generar clave con validación
    const clave = generarClavePeriodo(inicio, fin);
    
    const claveInput = document.getElementById('periodo-clave');
    const resultClave = document.getElementById('result-clave');
    const displayClave = document.getElementById('display-clave');
    const descInput = document.getElementById('periodo-descripcion');
    const resultRango = document.getElementById('result-rango');
    const displayInicio = document.getElementById('display-fecha-inicio');
    const displayFin = document.getElementById('display-fecha-fin');
    
    // ✅ Actualizar todos los elementos con validación
    if (claveInput) claveInput.value = clave;
    if (resultClave) resultClave.textContent = clave;
    if (displayClave) displayClave.textContent = clave;
    
    // Generar descripción
    const descripcion = `${this.formatMes(new Date(inicio).getMonth())} ${new Date(inicio).getFullYear()} - ${this.formatMes(new Date(fin).getMonth())} ${new Date(fin).getFullYear()}`;
    if (descInput) descInput.value = descripcion;
    if (resultRango) resultRango.textContent = descripcion;
    
    // Actualizar displays
    if (displayInicio) displayInicio.textContent = this.formatDateDisplay(inicio);
    if (displayFin) displayFin.textContent = this.formatDateDisplay(fin);
    
    this.actualizarEstado('valid', 'Periodo válido', 'Listo para guardar');
  }

    // =========================================
  // ACTUALIZAR ESTADO (Versión Silenciosa y Segura)
  // =========================================
  actualizarEstado(tipo, titulo, mensaje) {
    // ✅ Usar requestAnimationFrame para esperar a que el DOM esté listo
    requestAnimationFrame(() => {
      const panel = document.getElementById('panel-estado');
      const badge = document.getElementById('result-validacion');
      const statusTitle = document.getElementById('status-title');
      const statusMessage = document.getElementById('status-message');
      
      if (!panel || !badge) {
        // ✅ Silencioso: no interrumpe la UX ni ensucia la consola
        return; 
      }
      
      // Actualizar clases y textos
      panel.className = `status-panel status-${tipo}`;
      badge.className = `result-badge ${tipo}`;
      
      if (statusTitle) statusTitle.textContent = titulo;
      if (statusMessage) statusMessage.textContent = mensaje;
      
      badge.textContent = tipo === 'valid' ? '✓ Válido' : 
                          tipo === 'warning' ? '⚠ Pendiente' : '✕ Inválido';
    });
  }

  // =========================================
  // ABRIR MODAL (Corregido - Reset completo)
  // =========================================
  openModal(periodo = null) {
    const modal = document.getElementById('modal-periodo');
    const form = document.getElementById('form-periodo');
    if (!modal || !form) return;
    
    // ✅ Resetear formulario COMPLETO
    form.reset();
    
    // ✅ Limpiar TODOS los campos hidden
    const hiddenFields = [
      'periodo-id', 'periodo-clave', 'periodo-descripcion', 'periodo-estado',
      'periodo-fecha-inicio-hidden', 'periodo-fecha-fin-hidden'
    ];
    hiddenFields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    
    // ✅ Ocultar fechas personalizadas al inicio
    this.ocultarFechasPersonalizadas();
    
    // ✅ Inicializar selector de años
    this.initAnioSelector();
    
    // ✅ Seleccionar plantilla por defecto (Semestre A)
    const plantillaSemestreA = document.querySelector('input[name="plantilla"][value="semestre-a"]');
    if (plantillaSemestreA) plantillaSemestreA.checked = true;
    
    this.currentPlantilla = 'semestre-a';
    this.currentAnio = new Date().getFullYear();
    
    // ✅ Establecer año base en el select
    const anioSelect = document.getElementById('periodo-anio-base');
    if (anioSelect) {
      anioSelect.value = this.currentAnio;
      // Disparar cambio para generar fechas
      anioSelect.dispatchEvent(new Event('change'));
    }
    
    if (periodo) {
      // =========================================
      // MODO EDICIÓN: Precargar datos existentes
      // =========================================
      
      // Campos básicos (hidden) con validación
      const idField = document.getElementById('periodo-id');
      if (idField && periodo.id) idField.value = periodo.id;
      
      const claveField = document.getElementById('periodo-clave');
      if (claveField && periodo.clave) claveField.value = periodo.clave;
      
      const descField = document.getElementById('periodo-descripcion');
      if (descField && periodo.descripcion) descField.value = periodo.descripcion;
      
      const estadoField = document.getElementById('periodo-estado');
      if (estadoField) estadoField.value = periodo.estado || 'abierto';
      
      // Inputs hidden para fechas
      if (periodo.fecha_inicio) {
        const fechaInicio = periodo.fecha_inicio.split('T')[0];
        const inicioHidden = document.getElementById('periodo-fecha-inicio-hidden');
        if (inicioHidden) inicioHidden.value = fechaInicio;
      }
      if (periodo.fecha_fin) {
        const fechaFin = periodo.fecha_fin.split('T')[0];
        const finHidden = document.getElementById('periodo-fecha-fin-hidden');
        if (finHidden) finHidden.value = fechaFin;
      }
      
      // Actualizar visualización con validación
      const resultClave = document.getElementById('result-clave');
      if (resultClave) resultClave.textContent = periodo.clave || '---';
      
      const displayClave = document.getElementById('display-clave');
      if (displayClave) displayClave.textContent = periodo.clave || '---';
      
      const resultRango = document.getElementById('result-rango');
      if (resultRango) resultRango.textContent = periodo.descripcion || '---';
      
      if (periodo.fecha_inicio) {
        const displayInicio = document.getElementById('display-fecha-inicio');
        if (displayInicio) displayInicio.textContent = this.formatDateDisplay(periodo.fecha_inicio);
      }
      if (periodo.fecha_fin) {
        const displayFin = document.getElementById('display-fecha-fin');
        if (displayFin) displayFin.textContent = this.formatDateDisplay(periodo.fecha_fin);
      }
      
      // Detectar plantilla desde clave existente
      if (periodo.clave) {
        if (periodo.clave.startsWith('FEB-JUL')) {
          const plantillaA = document.querySelector('input[name="plantilla"][value="semestre-a"]');
          if (plantillaA) plantillaA.checked = true;
          this.currentPlantilla = 'semestre-a';
        } else if (periodo.clave.startsWith('AGO-ENE')) {
          const plantillaB = document.querySelector('input[name="plantilla"][value="semestre-b"]');
          if (plantillaB) plantillaB.checked = true;
          this.currentPlantilla = 'semestre-b';
        } else {
          const plantillaPersonalizado = document.querySelector('input[name="plantilla"][value="personalizado"]');
          if (plantillaPersonalizado) plantillaPersonalizado.checked = true;
          this.currentPlantilla = 'personalizado';
          this.activarModoPersonalizado();
          
          // Cargar fechas en inputs reales
          if (periodo.fecha_inicio) {
            const inputInicio = document.getElementById('periodo-fecha-inicio');
            if (inputInicio) inputInicio.value = periodo.fecha_inicio.split('T')[0];
          }
          if (periodo.fecha_fin) {
            const inputFin = document.getElementById('periodo-fecha-fin');
            if (inputFin) inputFin.value = periodo.fecha_fin.split('T')[0];
          }
        }
      }
      
      this.actualizarEstado('valid', 'Editando periodo', 'Modifica y guarda los cambios');
      
    } else {
      // =========================================
      // MODO NUEVO: Generar fechas automáticamente
      // =========================================
      // Pequeño delay para asegurar que el DOM esté listo
      setTimeout(() => {
        this.actualizarFechasDesdePlantilla();
      }, 50);
    }
    
    // Mostrar modal
    modal.classList.remove('hidden');
    
    // Enfocar primer campo
    const primerCampo = document.getElementById('periodo-anio-base');
    if (primerCampo) {
      primerCampo.focus();
    }
  }

  // =========================================
  // GUARDAR PERIODO
  // =========================================
  async savePeriodo(modal) {
    // Leer de inputs HIDDEN, no de los visuales
    const datos = {
      id: document.getElementById('periodo-id')?.value ? parseInt(document.getElementById('periodo-id').value) : null,
      clave: document.getElementById('periodo-clave')?.value?.trim(),
      descripcion: document.getElementById('periodo-descripcion')?.value?.trim(),
      fecha_inicio: document.getElementById('periodo-fecha-inicio-hidden')?.value || 
                    document.getElementById('periodo-fecha-inicio')?.value || null,
      fecha_fin: document.getElementById('periodo-fecha-fin-hidden')?.value || 
                 document.getElementById('periodo-fecha-fin')?.value || null,
      estado: document.getElementById('periodo-estado')?.value || 'abierto'
    };
    
    // Validaciones básicas
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