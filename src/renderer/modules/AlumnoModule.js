// src/renderer/modules/AlumnoModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import modalAlumnoHtml from '../views/partials/modals/modal-alumno.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';
import { Toast } from '../components/common/Toast.js'; // 🔹 IMPORTAR TOAST

export class AlumnoModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this._modalInjected = false;
  }

  async init() {
    console.log('📘 [AlumnoModule] Iniciando módulo de Alumnos...');

    this._injectModal();
    await this._waitForDOM('tabla-alumnos-body');

    if (!this.data || this.data.length === 0) {
      console.log('📡 [AlumnoModule] Cargando datos desde IPC...');
      await this._loadData();
    } else {
      console.log('💾 [AlumnoModule] Usando datos en caché...');
    }

    const tbody = document.getElementById('tabla-alumnos-body');
    if (!tbody) {
      console.error('❌ [AlumnoModule] tbody no encontrado');
      Toast.error('Error: tabla de alumnos no encontrada', 5000);
      return;
    }

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-alumnos-body',
        columns: this._getColumns(),
        expandable: true,
        actions: true,
        onRowClick: 'alumnoModuleInstance.handleRowClick(event)',
        onAction: 'alumnoModuleInstance.toggleActionMenu(event)',
        onExpand: 'alumnoModuleInstance.loadRowSummary(event)',
        onExpandAction: 'alumnoModuleInstance.openAssignmentModal(this)'
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Alumnos renderizada con ${this.data.length} registros`);
    } else {
      this._renderEmptyState();
      console.log('ℹ️ [AlumnoModule] Sin registros para mostrar');
    }

    this._setupSearch();
    this._setupModalEvents();
    this._setupGlobalHelpers();

    window.alumnoModuleInstance = this;

    this.initialized = true;
    console.log('✅ [AlumnoModule] Inicialización completa');
  }

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

  async _waitForDOM(elementId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(elementId)) return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.error(`❌ [AlumnoModule] Timeout: "${elementId}" no encontrado`);
    return false;
  }

  async _loadData() {
    try {
      const res = await window.electronAPI.listarAlumnos();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log('📄 [AlumnoModule] Primer registro:', this.data[0]);
          console.log('🔑 [AlumnoModule] Keys disponibles:', Object.keys(this.data[0]));
        }
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

_getColumns() {
  return [
    { 
      key: 'matricula', 
      label: 'Matrícula',
      format: (v) => `<strong style="font-family:monospace;">${v}</strong>` 
    },
    { 
      key: 'nombres', 
      label: 'Nombre Completo',
      format: (v, row) => {
        const partes = [row.apellido_paterno || '', row.apellido_materno || '', v || ''].filter(p => p);
        return partes.join(' ');
      }
    },
    { key: 'correo_contacto', label: 'Correo' },
    
    // 🔹 COLUMNA TUTOR: Usa tutor_nombre del backend
    { 
      key: 'tutor_nombre', 
      label: 'Tutor',
      format: (v) => v 
        ? `<span style="color:var(--accent-color); font-weight:500">${v}</span>` 
        : '<span style="color:var(--text-muted)">Sin asignar</span>'
    },
    
    { key: 'estado', label: 'Estado', badge: true }
  ];
}

  _setupSearch() {
    const input = document.getElementById('buscador-alumnos');
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
               (item.matricula || '').toLowerCase().includes(txt) || 
               (item.correo_contacto || '').toLowerCase().includes(txt);
      });
      
      this.table?.setData(filtered);
    });
  }

  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-alumno');
    const modal = this.modalElement;
    
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [AlumnoModule] Elementos del modal no encontrados');
      return;
    }

    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this._openModal();
    };

    const intentarCerrar = async () => {
      if (this.unsavedGuard?.hasUnsavedChanges) {
        const confirmado = await globalConfirm.ask('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
        if (!confirmado) return;
      }
      this._ejecutarCierre();
    };

    this.modalElement?.querySelector('.btn-close')?.addEventListener('click', intentarCerrar);
    document.getElementById('btn-cancelar-alumno')?.addEventListener('click', intentarCerrar);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault();
        intentarCerrar();
      }
    });

    const btnSave = document.getElementById('btn-guardar-alumno');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this._saveAlumno(modal);
      });
    }
  }

  _ejecutarCierre() {
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    
    this.formAutosave?.clear();
    this.formAutosave = null;
    
    const form = document.getElementById('form-alumno');
    if (form) form.reset();
    
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  _openModal(alumno = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-alumno');
    if (!modal || !form) return;

    if (!alumno) {
      const hasAutosave = localStorage.getItem('autosave:alumno-form');
      if (!hasAutosave) {
        form.reset();
      }
    } else {
      form.reset();
    }
    
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    
    setVal('alumno-id', '');
    setVal('alumno-estado', 'activo');
    
    this.unsavedGuard = new UnsavedChangesGuard('#form-alumno');
    this.formAutosave = new FormAutosave('form-alumno', 'alumno-form');

    if (alumno) {
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
      
      this.formAutosave?.clear();
    }
    
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('alumno-matricula')?.focus(), 100);
  }

  // 🔹 CORRECCIÓN: Reemplazar alert() por Toast
  async _saveAlumno(modal) {
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    
    const tratamiento = document.getElementById('alumno-tratamiento')?.value?.trim();
    
    if (!tratamiento) {
      Toast.warning('Selecciona un tratamiento (Est./Lic./etc.)', 4000);
      return;
    }

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
      tratamiento: tratamiento,
      articulo: articulo,
      estado: 'activo'
    };

    // Validaciones obligatorias
    if (!datos.matricula || !datos.apellido_paterno || !datos.nombres || !datos.periodo_ingreso) {
      Toast.error('Campos obligatorios: Matrícula, Apellido Paterno, Nombres y Periodo de Ingreso', 7000);
      return;
    }

    // UI: Loading state
    const btnSave = document.getElementById('btn-guardar-alumno');
    const originalText = btnSave?.innerHTML || '';
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

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
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
      }
    }
  }

  _renderEmptyState() {
    const tbody = document.getElementById('tabla-alumnos-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 50px 20px; color:var(--text-muted);">
          <i class="fa-solid fa-graduation-cap" 
             style="font-size: 2.5rem; margin: 0 auto 15px auto; display: block; opacity: 0.6;"></i>
          <p style="margin: 0; font-size: 1rem;">Sin registros de alumnos</p>
        </td>
      </tr>
    `;
  }

  _setupGlobalHelpers() {
    window.alumnoModuleInstance = this;
  }

  handleRowClick(event) {
    const row = event.target.closest('.data-row');
    if (!row) return;
    
    if (event.target.closest('.btn-action-menu') || event.target.closest('.context-menu')) return;
    
    row.classList.toggle('expanded');
    const detailsRow = row.nextElementSibling;
    
    if (detailsRow?.classList.contains('sub-row-details')) {
      detailsRow.classList.toggle('hidden');
      if (!detailsRow.classList.contains('hidden')) {
        this._loadRowSummary(row.dataset.id, detailsRow);
      }
    }
    
    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
  }

  async _loadRowSummary(rowId, container) {
    const chips = container.querySelector('.summary-chips');
    if (!chips) return;
    
    chips.innerHTML = '<span class="chip">⏳ Cargando...</span>';
    
    try {
      setTimeout(() => {
        chips.innerHTML = `
          <span class="chip accent">👨‍ Tutor: Dr. Pérez</span>
          <span class="chip">📅 2024-A</span>
        `;
      }, 300);
    } catch (error) {
      chips.innerHTML = '<span class="chip" style="color:var(--danger-color)">Error</span>';
    }
  }

  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) menu.classList.toggle('hidden');
  }

  openAssignmentModal(buttonEl) {
    const expandedRow = buttonEl?.closest('.sub-row-details');
    const row = expandedRow 
      ? expandedRow.previousElementSibling 
      : buttonEl?.closest('.data-row');
    
    if (!row?.classList.contains('data-row')) {
      console.warn('⚠️ [AlumnoModule] No se encontró fila de datos válida');
      return;
    }
    
    const alumnoId = row.dataset.id?.trim();
    if (!alumnoId) {
      console.error('❌ [AlumnoModule] La fila no tiene dataset.id');
      return;
    }

    if (!this.data || this.data.length === 0) {
      console.error('❌ [AlumnoModule] No hay datos cargados en la tabla');
      return;
    }

    const alumno = this.data.find(a => a.id == alumnoId);

    if (!alumno) {
      console.error(`❌ [AlumnoModule] Alumno no encontrado con ID: ${alumnoId}`);
      console.warn('💡 Pista: this.data[0] =', this.data[0]);
      return;
    }

    console.log('🔍 [AlumnoModule] Datos encontrados:', {
      id: alumno.id,
      matricula: alumno.matricula,
      nombres: alumno.nombres,
      apellido_paterno: alumno.apellido_paterno
    });

    const nombreCompleto = [
      alumno.nombres,
      alumno.apellido_paterno,
      alumno.apellido_materno
    ].filter(p => p?.trim()).map(p => p.trim()).join(' ');

    window.assignmentModal.open({
      entityType: 'alumno',
      entityId: alumno.id,
      entityName: nombreCompleto,
      matricula: alumno.matricula
    });
    
    console.log(`✅ [AlumnoModule] Modal abierto para: ${nombreCompleto} (${alumno.matricula})`);
  }

  destroy() {
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    this.formAutosave?.clear();
    this.formAutosave = null;
    
    this.modalElement = null;
    this._modalInjected = false;
    this.table = null;
    
    console.log('🧹 [AlumnoModule] Recursos liberados');
  }
}