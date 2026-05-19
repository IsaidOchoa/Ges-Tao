// src/renderer/modules/DocenteModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalDocenteHtml from '../views/partials/modals/modal-docente.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';

export class DocenteModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this._modalInjected = false;
  }

  // =========================================
  // INICIALIZACIÓN PRINCIPAL
  // =========================================
  async init() {
    console.log('📘 [DocenteModule] Iniciando...');

    this._injectModal();
    await this._waitForDOM('tabla-docentes-body');

    if (!this.data || this.data.length === 0) {
      console.log('📡 [DocenteModule] Cargando datos desde IPC...');
      await this._loadData();
    } else {
      console.log('💾 [DocenteModule] Usando datos en caché...');
    }

    const tbody = document.getElementById('tabla-docentes-body');
    if (!tbody) {
      console.error('❌ [DocenteModule] tbody no encontrado');
      return;
    }

    this.table = new DataTable({
      tbodyId: 'tabla-docentes-body',
      columns: this._getColumns(),
      expandable: true,
      actions: true,
      onRowClick: 'docenteModuleInstance.handleRowClick(event)',
      onAction: 'docenteModuleInstance.toggleActionMenu(event)',
      onExpand: 'docenteModuleInstance.loadRowSummary(event)'
    });

    if (this.data.length > 0) {
      this.table.setData(this.data);
    } else {
      this._renderEmptyState();
    }

    this._setupSearch();
    this._setupModalEvents();
    this._setupGlobalHelpers();

    this.initialized = true;
    console.log('✅ [DocenteModule] Listo');
  }

  // =========================================
  // INYECCIÓN DE MODAL
  // =========================================
  _injectModal() {
    if (this._modalInjected || document.getElementById('modal-docente')) {
      this.modalElement = document.getElementById('modal-docente');
      this._modalInjected = true;
      return;
    }

    const template = document.createElement('div');
    template.innerHTML = modalDocenteHtml;
    document.body.appendChild(template.firstElementChild);
    
    this.modalElement = document.getElementById('modal-docente');
    this._modalInjected = true;
    console.log('✅ [DocenteModule] Modal inyectado');
  }

  // =========================================
  // UTILIDAD: Esperar elemento en DOM
  // =========================================
  async _waitForDOM(elementId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(elementId)) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.error(`❌ [DocenteModule] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarDocentes();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log('📄 [DocenteModule] Primer registro:', this.data[0]);
        }
        return true;
      }
      console.warn('⚠️ [DocenteModule] Error en respuesta IPC:', res.error);
      return false;
    } catch (error) {
      console.error('❌ [DocenteModule] Error cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  _getColumns() {
    return [
      { key: 'codigo', label: 'Código', format: (v) => `<strong>${v}</strong>` },
      { 
        key: 'nombres', 
        label: 'Nombre Completo',
        format: (v, row) => {
          const partes = [row.apellido_paterno || '', row.apellido_materno || '', v || ''].filter(p => p);
          return partes.join(' ');
        }
      },
      { key: 'correo_contacto', label: 'Correo' },
      { key: 'estado', label: 'Estado', badge: true }
    ];
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  _setupSearch() {
    const input = document.getElementById('buscador-docentes');
    if (!input) return;

    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) {
        this.table?.setData(this.data);
        return;
      }
      
      const filtered = this.data.filter(item => {
        const nombreCompleto = [item.nombres || '', item.apellido_paterno || '', item.apellido_materno || ''].join(' ').toLowerCase();
        return nombreCompleto.includes(txt) || 
               (item.codigo || '').toLowerCase().includes(txt) || 
               (item.correo_contacto || '').toLowerCase().includes(txt);
      });
      
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL (CON CONFIRMACIÓN GLOBAL)
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-docente');
    const modal = this.modalElement;
    
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [DocenteModule] Elementos del modal no encontrados');
      return;
    }

    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this._openModal();
    };

    // ✅ Función de cierre ASÍNCRONA con confirmación global
    const intentarCerrar = async () => {
      if (this.unsavedGuard?.hasUnsavedChanges) {
        const confirmado = await globalConfirm.ask('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
        if (!confirmado) return; // Usuario canceló → NO cerrar
      }
      this._ejecutarCierre();
    };

    // ✅ CORRECCIÓN: Usar querySelector por clase para el botón "X"
    this.modalElement?.querySelector('.btn-close')?.addEventListener('click', intentarCerrar);
    document.getElementById('btn-cancelar-docente')?.addEventListener('click', intentarCerrar);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault();
        intentarCerrar();
      }
    });

    // Botón guardar
    const btnSave = document.getElementById('btn-guardar-docente');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._saveDocente(modal);
      });
    }
  }

  // ✅ Método privado para ejecutar cierre limpio
  _ejecutarCierre() {
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    this.formAutosave?.clear();
    this.formAutosave = null;
    
    const form = document.getElementById('form-docente');
    if (form) form.reset();
    
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // ABRIR MODAL
  // =========================================
  _openModal(doc = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-docente');
    if (!modal || !form) return;

    // NO resetear si FormAutosave va a restaurar datos
    if (!doc) {
      // Solo resetear en modo "nuevo" si NO hay autosave previo
      const hasAutosave = localStorage.getItem('autosave:docente-form');
      if (!hasAutosave) {
        form.reset();
      }
    } else {
      // En modo edición, siempre resetear primero
      form.reset();
    }
    
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };

    setVal('doc-id', '');
    
    // Inicializar protecciones (FormAutosave restaura AUTOMÁTICAMENTE en su constructor)
    this.unsavedGuard = new UnsavedChangesGuard('#form-docente');
    this.formAutosave = new FormAutosave('form-docente', 'docente-form');

    if (doc) {
      // Modo edición: sobrescribir cualquier autosave con datos reales de BD
      setVal('doc-id', doc.id);
      setVal('doc-codigo', doc.codigo);
      setVal('doc-ap-paterno', doc.apellido_paterno);
      setVal('doc-ap-materno', doc.apellido_materno);
      setVal('doc-nombres', doc.nombres);
      setVal('doc-correo', doc.correo_contacto);
      setVal('doc-telefono', doc.telefono_contacto);
      setVal('doc-nivel', doc.nivel_academico || 'base');
      setVal('doc-tratamiento', doc.tratamiento);
      setVal('doc-articulo', doc.articulo || 'El');
      setVal('doc-estado', doc.estado || 'activo');
      
      // Limpiar autosave tras precargar datos reales
      this.formAutosave?.clear();
    }
    // ✅ En modo nuevo: si hay autosave, ya se restauró en el constructor de FormAutosave
    
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('doc-codigo')?.focus(), 100);
  }

  // =========================================
  // GUARDAR DOCENTE
  // =========================================
  async _saveDocente(modal) {
    const tratamientoEl = document.getElementById('doc-tratamiento');
    const tratamiento = tratamientoEl?.value?.trim();
    
    if (!tratamiento) {
      alert('⚠️ Debes seleccionar un tratamiento (Dr., Dra., Mtro., etc.)');
      tratamientoEl?.focus();
      return;
    }

    const tratamientosFemeninos = ['Dra.', 'Mtra.'];
    const esFemenino = tratamiento.endsWith('a.') || tratamientosFemeninos.includes(tratamiento);
    const articulo = esFemenino ? 'La' : 'El';

    const datos = {
      id: document.getElementById('doc-id')?.value || null,
      codigo: document.getElementById('doc-codigo')?.value?.trim(),
      apellido_paterno: document.getElementById('doc-ap-paterno')?.value?.trim(),
      apellido_materno: document.getElementById('doc-ap-materno')?.value?.trim(),
      nombres: document.getElementById('doc-nombres')?.value?.trim(),
      correo_contacto: document.getElementById('doc-correo')?.value?.trim(),
      telefono_contacto: document.getElementById('doc-telefono')?.value?.trim(),
      nivel_academico: document.getElementById('doc-nivel')?.value || 'base',
      tratamiento: tratamiento,
      articulo: articulo,
      estado: 'activo'
    };

    if (!datos.codigo || !datos.apellido_paterno || !datos.nombres) {
      alert('⚠️ Campos obligatorios:\n• Código\n• Apellido Paterno\n• Nombres');
      return;
    }

    try {
      const res = await window.electronAPI.guardarDocente(datos);
      if (res.success) {
        this._ejecutarCierre(); // ✅ Limpio y seguro
        await this._loadData();
        this.table?.setData(this.data);
      } else {
        alert(`❌ Error: ${res.error || 'No se pudo guardar'}`);
      }
    } catch (error) {
      console.error('💥 Error guardando docente:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  _renderEmptyState() {
    const tbody = document.getElementById('tabla-docentes-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;padding:50px;color:var(--text-muted)">
          <i class="fa-solid fa-chalkboard-user" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
          <p style="margin:0">No hay docentes registrados</p>
        </td>
      </tr>
    `;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() {
    window.docenteModuleInstance = this;
  }

  // =========================================
  // INTERACCIÓN DE FILAS
  // =========================================
  handleRowClick(event) {
    const row = event.target.closest('.data-row');
    if (!row) return;
    
    if (event.target.closest('.btn-action-menu') || event.target.closest('.context-menu')) return;
    
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

  loadRowSummary(event) {
    // 1. Obtener la fila que fue expandida desde el evento
    const row = event.target?.closest('.data-row');
    if (!row) return;
    
    // 2. La fila de detalles es la siguiente hermana con clase específica
    const detailsRow = row.nextElementSibling;
    if (!detailsRow?.classList.contains('sub-row-details')) return;
    
    // 3. Ahora sí buscamos el contenedor dentro de la fila de detalles
    const chips = detailsRow.querySelector('.summary-chips');
    if (!chips) return;
    
    // 4. Mostrar estado de carga
    chips.innerHTML = '<span class="chip">⏳ Cargando...</span>';
    
    try {
      // 🔄 Futuro: Consultar asignaciones reales desde BD vía IPC
      // Por ahora, simulamos con timeout
      setTimeout(() => {
        chips.innerHTML = `
          <span class="chip accent">📚 3 EE</span>
          <span class="chip">👥 12 Alumnos</span>
          <span class="chip">📅 2024-A</span>
        `;
      }, 300);
    } catch (error) {
      console.error('Error cargando resumen:', error);
      chips.innerHTML = '<span class="chip" style="color:var(--danger-color)">Error</span>';
    }
  }

  openAssignmentModal(buttonEl) {
    // 1. Obtener la fila padre para extraer datos
    const row = buttonEl?.closest('.data-row');
    if (!row) {
      console.warn('⚠️ [DocenteModule] No se encontró la fila padre');
      return;
    }
    
    // 2. Extraer ID y nombre del docente desde la fila
    const docenteId = row.dataset.id;
    
    // Opción A: Si tienes el nombre en un data attribute (recomendado)
    const docenteName = row.dataset.nombre || 
    // Opción B: Extraer del texto de la celda de nombre (ajusta el selector según tu tabla)
    row.querySelector('td:nth-child(2)')?.textContent?.trim() || 
    'Docente';
    
    console.log(`🔗 [DocenteModule] Abriendo asignaciones para ID: ${docenteId}, Nombre: ${docenteName}`);
    
    // 3. Verificar que assignmentModal esté disponible
    if (!window.assignmentModal) {
      console.error('❌ [DocenteModule] assignmentModal no está disponible en window');
      alert('Error: El módulo de asignaciones no está cargado');
      return;
    }
    
    // 4. Abrir el modal con contexto específico
    window.assignmentModal.open({
      entityType: 'docente',
      entityId: docenteId,
      entityName: docenteName,
      tabs: ['tutorados', 'ee_asignadas', 'periodos_activos'] // Solo las relevantes para docentes
    });
  }

  // =========================================
  // MENÚ CONTEXTUAL
  // =========================================
  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) menu.classList.toggle('hidden');
  }

  // =========================================
  // ACTUALIZAR ARTÍCULO SEGÚN TRATAMIENTO
  // =========================================
  actualizarArticuloTratamiento() {
    const tratamiento = document.getElementById('doc-tratamiento')?.value;
    const articuloInput = document.getElementById('doc-articulo');
    
    if (!tratamiento || !articuloInput) return;
    
    const tratamientosFemeninos = ['Dra.', 'Mtra.'];
    const esFemenino = tratamiento.endsWith('a.') || tratamientosFemeninos.includes(tratamiento);
    
    articuloInput.value = esFemenino ? 'La' : 'El';
  }

  // =========================================
  // MODAL DE ASIGNACIONES (Placeholder)
  // =========================================
  openAssignmentModal(docenteId) {
    console.log(`🔗 [DocenteModule] Abrir asignaciones para ID: ${docenteId}`);
    alert(`🚧 Función en desarrollo:\nGestionar EE, tutorados y periodos para este docente.`);
  }

  // =========================================
  // CLEANUP
  // =========================================
  destroy() {
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    this.formAutosave?.clear();
    this.formAutosave = null;
    
    this.modalElement = null;
    this._modalInjected = false;
    this.table = null;
    
    console.log('🧹 [DocenteModule] Recursos liberados');
  }
}