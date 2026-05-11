// src/renderer/modules/DocenteModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalDocenteHtml from '../views/partials/modals/modal-docente.html';

export class DocenteModule {
  constructor() {
    this.data = []; // Persiste en memoria
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
  }

  async init() {
    console.log('📘 [DocenteModule] Iniciando...');

    // 1. Asegurar Modal (Global)
    if (!document.getElementById('modal-docente')) {
      const template = document.createElement('div');
      template.innerHTML = modalDocenteHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-docente');
    }

    // 2. Esperar DOM (Crítico para SPA)
    await this.waitForDOMReady('tabla-docentes-body');

    // 3. Lazy Load Data (Solo si está vacío)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [DocenteModule] Cargando datos (Primera vez)...');
      await this.loadData();
    } else {
      console.log('💾 [DocenteModule] Usando datos en caché...');
    }

    // 4. Renderizar Tabla (SIEMPRE, para vincular al nuevo DOM)
    this.table = new DataTable({
      tbodyId: 'tabla-docentes-body',
      columns: this.getColumns(),
      expandable: true,
      actions: true,
      onRowClick: 'docenteModuleInstance.handleRowClick(event)',
      onAction: 'docenteModuleInstance.toggleActionMenu(event)',
      onExpand: true
    });

    if (this.data && this.data.length > 0) {
      this.table.setData(this.data);
    } else {
      this.table.render();
    }

    // 5. Re-vincular Eventos (SIEMPRE, porque los inputs son nuevos)
    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();

    this.initialized = true;
    console.log('✅ [DocenteModule] Listo');
  }

  // =========================================
  // UTILIDAD: Esperar que el tbody exista en el DOM
  // =========================================
  async waitForDOMReady(tbodyId, timeout = 2000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const tbody = document.getElementById(tbodyId);
      if (tbody) {
        console.log(`🔍 [DocenteModule] tbody "${tbodyId}" encontrado en DOM`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.error(`❌ [DocenteModule] Timeout: tbody "${tbodyId}" no encontrado en ${timeout}ms`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async loadData() {
    try {
      console.log('📡 [DocenteModule] Solicitando datos a IPC...');
      const res = await window.electronAPI.listarDocentes();
      
      console.log('📦 [DocenteModule] Respuesta IPC:', { 
        success: res.success, 
        count: res.data?.length || res.rows?.length 
      });
      
      if (res.success) {
        this.data = res.rows || res.data;
        
        if (this.data.length > 0) {
          console.log('📄 [DocenteModule] Primer registro:', this.data[0]);
          console.log('🔑 [DocenteModule] Keys disponibles:', Object.keys(this.data[0]));
        }
        
        return true;
      } else {
        console.warn('⚠️ [DocenteModule] Error en respuesta IPC:', res.error);
        return false;
      }
    } catch (error) {
      console.error('❌ [DocenteModule] Error al cargar los datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS (Alineada con tu BD)
  // =========================================
  getColumns() {
    return [
      { 
        key: 'codigo', 
        label: 'Código',
        format: (v) => `<strong>${v}</strong>` 
      },
      { 
        key: 'nombres', 
        label: 'Nombre Completo',
        // Combina apellido_paterno + apellido_materno + nombres
        format: (v, row) => {
          const partes = [
            row.apellido_paterno || '',
            row.apellido_materno || '',
            v || ''
          ].filter(p => p); // Filtra vacíos
          return partes.join(' ');
        }
      },
      { 
        key: 'correo_contacto', 
        label: 'Correo' 
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
    const input = document.getElementById('buscador-docentes');
    if (!input) {
      console.warn('⚠️ [DocenteModule] Input buscador no encontrado');
      return;
    }

    // Patrón cloneNode para limpiar listeners previos
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      
      if (!txt) {
        this.table?.setData(this.data);
        return;
      }
      
      const filtered = this.data.filter(item => {
        const nombreCompleto = [
          item.nombres || '',
          item.apellido_paterno || '',
          item.apellido_materno || ''
        ].join(' ').toLowerCase();
        
        return nombreCompleto.includes(txt) || 
               (item.codigo || '').toLowerCase().includes(txt) || 
               (item.correo_contacto || '').toLowerCase().includes(txt);
      });
      
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // GESTIÓN DE MODALES
  // =========================================
  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-docente');
    const modal = document.getElementById('modal-docente');
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [DocenteModule] Elementos del modal no encontrados');
      return;
    }

    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this.openModal();
    };

    const cerrarModal = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal-docente')?.addEventListener('click', cerrarModal);
    document.getElementById('btn-cancelar-docente')?.addEventListener('click', cerrarModal);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrarModal(); });

    const btnSave = document.getElementById('btn-guardar-docente');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.saveDocente(modal);
      });
    }
  }

  openModal(doc = null) {
    const modal = document.getElementById('modal-docente');
    const form = document.getElementById('form-docente');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('doc-id').value = '';
    
    if (doc) {
      // Modo edición: prellenar formulario
      document.getElementById('doc-id').value = doc.id || '';
      document.getElementById('doc-codigo').value = doc.codigo || '';
      document.getElementById('doc-ap-paterno').value = doc.apellido_paterno || '';
      document.getElementById('doc-ap-materno').value = doc.apellido_materno || '';
      document.getElementById('doc-nombres').value = doc.nombres || '';
      document.getElementById('doc-correo').value = doc.correo_contacto || '';
      document.getElementById('doc-telefono').value = doc.telefono_contacto || '';
      document.getElementById('doc-nivel').value = doc.nivel_academico || 'base';
      
      // ✅ NUEVO: Cargar tratamiento y artículo
      document.getElementById('doc-tratamiento').value = doc.tratamiento || '';
      document.getElementById('doc-articulo').value = doc.articulo || 'El';
      
      document.getElementById('doc-estado').value = doc.estado || 'activo';
    }
    
    modal.classList.remove('hidden');
    document.getElementById('doc-codigo')?.focus();
  }

  async saveDocente(modal) {
    // 🔍 DEBUG: Capturar y validar tratamiento
    const tratamientoEl = document.getElementById('doc-tratamiento');
    const tratamientoRaw = tratamientoEl?.value;
    
    console.log('🔍 [DEBUG] tratamientoEl existe:', !!tratamientoEl);
    console.log('🔍 [DEBUG] tratamientoRaw:', tratamientoRaw);
    console.log('🔍 [DEBUG] tratamientoRaw.trim():', tratamientoRaw?.trim());
    
    const tratamiento = tratamientoRaw?.trim();
    
    // Validación estricta: no permitir fallbacks
    if (!tratamiento || tratamiento === '') {
      console.error('❌ [ERROR] Tratamiento vacío o no seleccionado');
      alert('⚠️ Debes seleccionar un tratamiento (Dr., Dra., Mtro., etc.)');
      tratamientoEl?.focus();
      return;
    }

    // Calcular artículo automáticamente
    const tratamientosFemeninos = ['Dra.', 'Mtra.'];
    const esFemenino = tratamiento.endsWith('a.') || tratamientosFemeninos.includes(tratamiento);
    const articulo = esFemenino ? 'La' : 'El';

    // Construir objeto de datos
    const datos = {
      id: document.getElementById('doc-id')?.value || null,
      codigo: document.getElementById('doc-codigo')?.value?.trim(),
      apellido_paterno: document.getElementById('doc-ap-paterno')?.value?.trim(),
      apellido_materno: document.getElementById('doc-ap-materno')?.value?.trim(),
      nombres: document.getElementById('doc-nombres')?.value?.trim(),
      correo_contacto: document.getElementById('doc-correo')?.value?.trim(),
      telefono_contacto: document.getElementById('doc-telefono')?.value?.trim(),
      nivel_academico: document.getElementById('doc-nivel')?.value || 'base',
      tratamiento: tratamiento,  // ✅ Sin fallback
      articulo: articulo,        // ✅ Calculado
      estado: 'activo'           // ✅ Siempre activo
    };

    // 🔍 DEBUG: Mostrar datos completos antes de enviar
    console.log('💾 [DEBUG] Datos a enviar:', JSON.stringify(datos, null, 2));

    // Validaciones obligatorias
    if (!datos.codigo || !datos.apellido_paterno || !datos.nombres) {
      alert('⚠️ Campos obligatorios:\n• Código\n• Apellido Paterno\n• Nombres');
      return;
    }

    try {
      console.log('📡 Enviando a IPC...');
      const res = await window.electronAPI.guardarDocente(datos);
      
      if (res.success) {
        alert('✅ Docente guardado correctamente');
        modal.classList.add('hidden');
        await this.loadData();
        this.table?.setData(this.data);
      } else {
        console.error('❌ Error del backend:', res.error);
        alert(`❌ Error: ${res.error || 'No se pudo guardar'}`);
      }
    } catch (error) {
      console.error('💥 Error de red/IPC:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // UTILIDADES GLOBALES (Para onclick en HTML inyectado)
  // =========================================
  setupGlobalHelpers() {
    window.docenteModuleInstance = this;
  }

  // =========================================
  // INTERACCIÓN DE FILAS: EXPANSIÓN
  // =========================================
  handleRowClick(event) {
    const row = event.target.closest('.data-row');
    if (!row) return;
    
    // Ignorar clicks en botones de acción
    if (event.target.closest('.btn-action-menu') || event.target.closest('.context-menu')) {
      return;
    }
    
    // Toggle visual
    row.classList.toggle('expanded');
    
    // Toggle fila de detalles
    const detailsRow = row.nextElementSibling;
    if (detailsRow?.classList.contains('sub-row-details')) {
      detailsRow.classList.toggle('hidden');
      
      if (!detailsRow.classList.contains('hidden')) {
        this.loadRowSummary(row.dataset.id, detailsRow);
      }
    }
    
    // Selección visual
    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
  }

  async loadRowSummary(rowId, container) {
    const chips = container.querySelector('.summary-chips');
    if (!chips) return;
    
    chips.innerHTML = '<span class="chip">⏳ Cargando...</span>';
    
    try {
      // 🔄 Futuro: Consultar asignaciones reales desde BD
      setTimeout(() => {
        chips.innerHTML = `
          <span class="chip accent">📚 3 EE</span>
          <span class="chip">👥 12 Alumnos</span>
          <span class="chip">📅 2024-A</span>
        `;
      }, 300);
    } catch (error) {
      chips.innerHTML = '<span class="chip" style="color:var(--danger-color)">Error</span>';
    }
  }

  // =========================================
  // MENÚ CONTEXTUAL (3 PUNTOS)
  // =========================================
  toggleActionMenu(event) {
    event.stopPropagation();
    
    // Cerrar todos los menús primero
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    
    // Toggle del menú específico
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) {
      menu.classList.toggle('hidden');
    }
  }

  // En DocenteModule.js
  actualizarArticuloTratamiento() {
    const tratamiento = document.getElementById('doc-tratamiento')?.value;
    const articuloInput = document.getElementById('doc-articulo');
    
    if (!tratamiento || !articuloInput) return;
    
    // Determinar artículo basado en el tratamiento
    const tratamientosFemeninos = ['Dra.', 'Mtra.'];
    const esFemenino = tratamiento.endsWith('a.') || tratamientosFemeninos.includes(tratamiento);
    
    articuloInput.value = esFemenino ? 'La' : 'El';
    
    // Feedback visual opcional
    console.log(`Tratamiento: ${tratamiento} → Artículo: ${articuloInput.value}`);
  }

  // =========================================
  // ACCESO AL MEGA MODAL DE ASIGNACIONES
  // =========================================
  openAssignmentModal(docenteId) {
    console.log(`🔗 [DocenteModule] Abrir asignaciones para ID: ${docenteId}`);
    alert(`🚧 Función en desarrollo:\nGestionar EE, tutorados y periodos para este docente.`);
  }
}