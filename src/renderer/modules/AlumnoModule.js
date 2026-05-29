// src/renderer/modules/AlumnoModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalAlumnoHtml from '../views/partials/modals/modal-alumno.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';
import { Toast } from '../components/common/Toast.js';

export class AlumnoModule {
  constructor() {
    // Estado interno
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this._modalInjected = false;
    
    // 🔹 CONFIGURACIÓN REUTILIZABLE (para estandarización)
    this.tbodyId = 'tabla-alumnos-body';
    this.instanceName = 'alumnoModuleInstance';
    this.expandable = true;
    this.actions = true;
  }

  // =========================================
  // INICIALIZACIÓN PRINCIPAL (Plantilla Canónica)
  // =========================================
  async init() {
    console.log(`📘 [${this.constructor.name}] Iniciando...`);

    // 1. Inyectar modal (idempotente)
    this._injectModal();
    
    // 2. Esperar que el tbody esté en el DOM
    await this._waitForDOM(this.tbodyId);

    // 3. Cargar datos (lazy load)
    if (!this.data?.length) {
      console.log(`📡 [${this.constructor.name}] Cargando datos desde IPC...`);
      await this._loadData();
    } else {
      console.log(`💾 [${this.constructor.name}] Usando datos en caché...`);
    }

    // 4. Validar tbody
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) {
      console.error(`❌ [${this.constructor.name}] tbody "${this.tbodyId}" no encontrado`);
      Toast.error('Error de inicialización: tabla no encontrada', 5000);
      return;
    }

    // 5. Crear y configurar DataTable
    this.table = new DataTable({
      tbodyId: this.tbodyId,
      columns: this._getColumns(),
      expandable: this.expandable,
      actions: this.actions,
      onRowClick: `${this.instanceName}.handleRowClick(event)`,
      onAction: `${this.instanceName}.toggleActionMenu(event)`,
      onExpand: `${this.instanceName}.loadRowSummary(event)`,
      onExpandAction: `${this.instanceName}.openAssignmentModal(this)`,
      onEdit: `${this.instanceName}.openEditModalFromMenu`,  // 🔹 Callback para editar
      onToggleStatus: `${this.instanceName}.toggleAlumnoStatus`,  // 🔹 Callback para toggle
    });

    // 6. Renderizar datos o estado vacío
    if (this.data?.length) {
      this.table.setData(this.data);
      console.log(`✅ [${this.constructor.name}] Tabla renderizada con ${this.data.length} registros`);
    } else {
      this._renderEmptyState();
      console.log(`ℹ️ [${this.constructor.name}] Sin registros para mostrar`);
    }

    // 7. Delegación de eventos para menú contextual (scoped a esta tabla)
    tbody.addEventListener('click', (e) => {
      const menuItem = e.target.closest('.context-item');
      if (!menuItem) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const action = menuItem.dataset.action;
      const rowId = menuItem.dataset.id;
      
      document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
      
      if (action === 'toggle' && typeof this.toggleAlumnoStatus === 'function') {
        this.toggleAlumnoStatus(rowId);
      } else if (action === 'edit' && typeof this.openEditModalFromMenu === 'function') {
        this.openEditModalFromMenu(rowId);
      }
    });

    // 8. Configurar utilidades
    this._setupSearch();
    this._setupModalEvents();
    
    // 9. Exponer instancia global (CRÍTICO para callbacks inline)
    window[this.instanceName] = this;
    
    // 10. Marcar como inicializado
    this.initialized = true;
    console.log(`✅ [${this.constructor.name}] Inicialización completa`);
  }

  // =========================================
  // INYECCIÓN DE MODAL (Auto-gestionada)
  // =========================================
  _injectModal() {
    if (this._modalInjected || document.getElementById('modal-alumno')) {
      this.modalElement = document.getElementById('modal-alumno');
      this._modalInjected = true;
      return;
    }
    const template = document.createElement('div');
    template.innerHTML = modalAlumnoHtml;
    document.body.appendChild(template.firstElementChild);
    this.modalElement = document.getElementById('modal-alumno');
    this._modalInjected = true;
    console.log('✅ [AlumnoModule] Modal inyectado');
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
    console.error(`❌ [${this.constructor.name}] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async _loadData() {
    try {
      const res = await window.electronAPI.listarAlumnos();
      if (res.success) {
        this.data = res.rows || res.data;
        return true;
      }
      console.warn('⚠️ [AlumnoModule] Error en respuesta IPC:', res.error);
      Toast.warning('No se pudieron cargar los alumnos', 4000);
      return false;
    } catch (error) {
      console.error('❌ [AlumnoModule] Error cargando datos:', error);
      Toast.error('Error de conexión al cargar alumnos', 5000);
      return false;
    }
  }

  // =========================================
  // COLUMNAS DE TABLA
  // =========================================
  _getColumns() {
    return [
      { key: 'matricula', label: 'Matrícula', format: (v) => `<strong style="font-family:monospace;">${v}</strong>` },
      { 
        key: 'nombres', 
        label: 'Nombre Completo',
        format: (v, row) => [row.apellido_paterno || '', row.apellido_materno || '', v || ''].filter(p => p).join(' ')
      },
      { key: 'correo_contacto', label: 'Correo' },
      { 
        key: 'tutor_nombre', 
        label: 'Tutor',
        format: (v) => v ? `<span style="color:var(--accent-color); font-weight:500">${v}</span>` : '<span style="color:var(--text-muted)">Sin asignar</span>'
      },
      { key: 'estado', label: 'Estado', badge: true }
    ];
  }

  // =========================================
  // BUSCADOR
  // =========================================
  _setupSearch() {
    const input = document.getElementById('buscador-alumnos');
    if (!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { this.table?.setData(this.data); return; }
      const filtered = this.data.filter(item => {
        const nombreCompleto = [item.nombres || '', item.apellido_paterno || '', item.apellido_materno || ''].join(' ').toLowerCase();
        return nombreCompleto.includes(txt) || (item.matricula || '').toLowerCase().includes(txt) || (item.correo_contacto || '').toLowerCase().includes(txt);
      });
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-alumno');
    const modal = this.modalElement;
    if (!btnNuevo || !modal) { console.warn('⚠️ [AlumnoModule] Elementos del modal no encontrados'); return; }
    
    btnNuevo.onclick = (e) => { e.preventDefault(); this._openModal(); };
    
    const intentarCerrar = async () => {
      if (this.unsavedGuard?.hasUnsavedChanges) {
        const confirmado = await globalConfirm.ask('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
        if (!confirmado) return;
      }
      this._ejecutarCierre();
    };
    
    this.modalElement?.querySelector('.btn-close')?.addEventListener('click', intentarCerrar);
    document.getElementById('btn-cancelar-alumno')?.addEventListener('click', intentarCerrar);
    modal.addEventListener('click', (e) => { if (e.target === modal) { e.preventDefault(); intentarCerrar(); } });
    
    const btnSave = document.getElementById('btn-guardar-alumno');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => { e.preventDefault(); await this._saveAlumno(modal); });
    }
  }

  // =========================================
  // CERRAR MODAL (con restauración de título)
  // =========================================
  _ejecutarCierre() {
    // 🔹 Restaurar título a "Nuevo Alumno"
    const modalTitle = this.modalElement?.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = 'Nuevo Alumno';
    
    this.unsavedGuard?.destroy(); this.unsavedGuard = null;
    this.formAutosave?.clear(); this.formAutosave = null;
    const form = document.getElementById('form-alumno'); if (form) form.reset();
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // ABRIR MODAL (Creación o Edición)
  // =========================================
  _openModal(alumno = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-alumno');
    if (!modal || !form) return;
    
    // 🔹 Restaurar título según modo
    const modalTitle = modal.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = alumno ? 'Editar Alumno' : 'Nuevo Alumno';
    
    // Resetear formulario
    form.reset();
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    setVal('alumno-id', '');
    setVal('alumno-estado', 'activo');
    
    // Inicializar protecciones
    this.unsavedGuard = new UnsavedChangesGuard('#form-alumno');
    this.formAutosave = new FormAutosave('form-alumno', 'alumno-form');
    
    if (alumno) {
      // 🔹 MODO EDICIÓN: Cargar datos existentes
      setVal('alumno-id', alumno.id);
      setVal('alumno-matricula', alumno.matricula);
      setVal('alumno-ap-paterno', alumno.apellido_paterno);
      setVal('alumno-ap-materno', alumno.apellido_materno);
      setVal('alumno-nombres', alumno.nombres);
      setVal('alumno-correo', alumno.correo_contacto);
      setVal('alumno-telefono', alumno.telefono_contacto);
      setVal('alumno-programa', alumno.programa_academico);
      setVal('alumno-fecha', alumno.fecha_ingreso ? alumno.fecha_ingreso.split('T')[0] : '');
      setVal('alumno-tratamiento', alumno.tratamiento || 'Est.');
      setVal('alumno-articulo', alumno.articulo || 'El');
      
      // 🔹 Disparar cambio en tratamiento para actualizar artículo automáticamente
      const tratamientoEl = document.getElementById('alumno-tratamiento');
      if (tratamientoEl) tratamientoEl.dispatchEvent(new Event('change'));
      
      this.formAutosave?.clear();
    } else {
      // 🔹 MODO NUEVO: Verificar autosave
      const hasAutosave = localStorage.getItem('autosave:alumno-form');
      if (!hasAutosave) form.reset();
    }
    
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('alumno-matricula')?.focus(), 100);
  }

  // =========================================
  // 🔹 ABRIR MODAL DE EDICIÓN DESDE MENÚ CONTEXTUAL
  // =========================================
  async openEditModalFromMenu(rowId) {
    console.log('🔍 openEditModalFromMenu llamado con rowId:', rowId);
    
    // 1. Buscar el alumno en los datos locales
    const alumno = this.data.find(a => 
      String(a.id) === String(rowId) || 
      String(a.matricula) === String(rowId) ||
      a.id == rowId || 
      a.matricula == rowId
    );
    
    if (!alumno) {
      console.error('❌ Alumno no encontrado para editar:', rowId);
      Toast.error('No se encontró el alumno para editar', 5000);
      return;
    }
    
    console.log('✅ Alumno encontrado para editar:', alumno);
    
    // 2. Asegurar que el modal esté inyectado
    if (!this.modalElement) this._injectModal();
    
    // 3. Abrir modal en modo edición (reutiliza _openModal)
    this._openModal(alumno);
    
    console.log('✅ Modal de edición abierto para alumno:', alumno.matricula);
  }

  // =========================================
  // 🔹 MÉTODO: Activar/Desactivar Alumno
  // =========================================
  async toggleAlumnoStatus(rowId) {
    console.log('🔍 toggleAlumnoStatus llamado con rowId:', rowId);
    
    // Búsqueda robusta
    const alumno = this.data.find(a => 
      String(a.id) === String(rowId) || 
      String(a.matricula) === String(rowId) ||
      a.id == rowId || 
      a.matricula == rowId
    );
    
    if (!alumno) {
      console.error('❌ Alumno no encontrado para rowId:', rowId);
      Toast.error('No se encontró el alumno para realizar la acción', 5000);
      return;
    }
    
    console.log('✅ Alumno encontrado:', { id: alumno.id, matricula: alumno.matricula, nombres: alumno.nombres, estado: alumno.estado });

    const nuevoEstado = alumno.estado === 'activo' ? 'inactivo' : 'activo';
    const accionInfinitivo = nuevoEstado === 'activo' ? 'Activar' : 'Desactivar';
    const accionPasado = nuevoEstado === 'activo' ? 'activado' : 'desactivado';
    
    // Construir nombre completo
    const nombreCompleto = [alumno.nombres, alumno.apellido_paterno, alumno.apellido_materno].filter(p => p && p.trim()).join(' ').trim() || alumno.matricula;

    // Mensaje explicativo detallado
    const mensajeConfirmacion = nuevoEstado === 'inactivo' 
      ? `El alumno <strong>${nombreCompleto}</strong> quedará oculto en listas, búsquedas y no podrá ser seleccionado para inscripciones o asignaciones.`
      : `El alumno <strong>${nombreCompleto}</strong> volverá a estar disponible en listas, búsquedas y podrá ser seleccionado normalmente.`;

    // Confirmación con título en infinitivo y mensaje detallado
    const confirmado = await globalConfirm.ask(`¿${accionInfinitivo} alumno?`, mensajeConfirmacion);
    if (!confirmado) { console.log('⚠️ Usuario canceló la acción'); return; }

    try {
      console.log('📡 Enviando actualización a backend:', { id: alumno.id, nuevoEstado });
      const res = await window.electronAPI.actualizarEstadoAlumno({ id: alumno.id, nuevoEstado });
      
      if (res.success) {
        Toast.success(`Alumno ${accionPasado} correctamente: ${nombreCompleto}`, 5000);
        await this._loadData(); this.table?.setData(this.data);
      } else {
        console.error('❌ Error del backend:', res.error);
        Toast.error(`Error: ${res.error || 'No se pudo actualizar el estado'}`, 6000);
      }
    } catch (err) {
      console.error('💥 Error de conexión:', err);
      Toast.error('Error de conexión al actualizar estado', 6000);
    }
  }

  // =========================================
  // GUARDAR ALUMNO
  // =========================================
  async _saveAlumno(modal) {
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    const tratamiento = document.getElementById('alumno-tratamiento')?.value?.trim();
    if (!tratamiento) { Toast.warning('Selecciona un tratamiento (Est./Lic./etc.)', 4000); return; }

    const tratamientosFemeninos = ['Sra.', 'Lic.'];
    const esFemenino = tratamiento.endsWith('a.') || tratamientosFemeninos.includes(tratamiento);
    const articulo = esFemenino ? 'La' : 'El';

    const datos = {
      id: getVal('alumno-id') ? parseInt(getVal('alumno-id')) : null,
      matricula: getVal('alumno-matricula'),
      apellido_paterno: getVal('alumno-ap-paterno'),
      apellido_materno: getVal('alumno-ap-materno'),
      nombres: getVal('alumno-nombres'),
      correo_contacto: getVal('alumno-correo'),
      telefono_contacto: getVal('alumno-telefono'),
      programa_academico: document.getElementById('alumno-programa')?.value,
      periodo_ingreso: document.getElementById('alumno-periodo')?.value,
      tratamiento,
      articulo,
      estado: 'activo'
    };

    if (!datos.matricula || !datos.apellido_paterno || !datos.nombres || !datos.periodo_ingreso) {
      Toast.error('Campos obligatorios: Matrícula, Apellido Paterno, Nombres y Periodo de Ingreso', 7000);
      return;
    }

    const btnSave = document.getElementById('btn-guardar-alumno');
    const originalText = btnSave?.innerHTML || '';
    if (btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; }

    try {
      const res = await window.electronAPI.guardarAlumno(datos);
      if (res.success) {
        const accion = datos.id ? 'actualizado' : 'registrado';
        Toast.success(`Alumno ${accion} correctamente: ${datos.nombres} ${datos.apellido_paterno}`, 5000);
        this._ejecutarCierre();
        await this._loadData();
        this.table?.setData(this.data);
      } else {
        Toast.error(`Error: ${res.error || 'No se pudo guardar el alumno'}`, 7000);
      }
    } catch (error) {
      console.error('💥 Error guardando alumno:', error);
      Toast.error('Error de conexión: no se pudo guardar el alumno', 6000);
    } finally {
      if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = originalText; }
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
  _renderEmptyState() {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 50px 20px; color:var(--text-muted);">
      <i class="fa-solid fa-graduation-cap" style="font-size: 2.5rem; margin: 0 auto 15px auto; display: block; opacity: 0.6;"></i>
      <p style="margin: 0; font-size: 1rem;">Sin registros de alumnos</p></td></tr>`;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() { window.alumnoModuleInstance = this; }

  // =========================================
  // INTERACCIÓN DE FILAS
  // =========================================
  handleRowClick(event) {
    const row = event.target.closest('.data-row');
    if (!row || row.dataset.estado === 'inactivo') return;
    if (event.target.closest('.btn-action-menu') || event.target.closest('.context-menu')) return;
    
    row.classList.toggle('expanded');
    const detailsRow = row.nextElementSibling;
    if (detailsRow?.classList.contains('sub-row-details')) {
      detailsRow.classList.toggle('hidden');
      if (!detailsRow.classList.contains('hidden')) { this._loadRowSummary(row.dataset.id, detailsRow); }
    }
    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
  }

  async _loadRowSummary(rowId, container) {
    const chips = container.querySelector('.summary-chips');
    if (!chips) return;
    chips.innerHTML = '<span class="chip">⏳ Cargando...</span>';
    try {
      setTimeout(() => { chips.innerHTML = `<span class="chip accent">👨‍🏫 Tutor: Dr. Pérez</span><span class="chip">📅 2024-A</span>`; }, 300);
    } catch (error) { chips.innerHTML = '<span class="chip" style="color:var(--danger-color)">Error</span>'; }
  }

  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) menu.classList.toggle('hidden');
  }

  openAssignmentModal(buttonEl) {
    const expandedRow = buttonEl?.closest('.sub-row-details');
    const row = expandedRow ? expandedRow.previousElementSibling : buttonEl?.closest('.data-row');
    if (!row?.classList.contains('data-row')) return;
    
    const alumnoId = row.dataset.id?.trim();
    if (!alumnoId || !this.data?.length) return;
    
    const alumno = this.data.find(a => a.id == alumnoId);
    if (!alumno) { console.error(`❌ Alumno no encontrado: ${alumnoId}`); Toast.error('No se encontró el alumno seleccionado', 4000); return; }
    
    const nombreCompleto = [alumno.nombres, alumno.apellido_paterno, alumno.apellido_materno].filter(p => p?.trim()).map(p => p.trim()).join(' ');
    
    window.assignmentModal.open({
      entityType: 'alumno',
      entityId: alumno.id,
      entityName: nombreCompleto,
      matricula: alumno.matricula
    });
    console.log(`✅ [AlumnoModule] Modal abierto para: ${nombreCompleto}`);
  }

  // =========================================
  // CLEANUP
  // =========================================
  destroy() {
    this.unsavedGuard?.destroy(); this.unsavedGuard = null;
    this.formAutosave?.clear(); this.formAutosave = null;
    this.modalElement = null; this._modalInjected = false; this.table = null;
    console.log('🧹 [AlumnoModule] Recursos liberados');
  }
}