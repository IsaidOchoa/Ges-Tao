// src/renderer/modules/AlumnoModule.js
// 📍 Arquitectura: Módulo autocontenido para gestión de Alumnos
// ✅ Incluye: UnsavedChangesGuard, FormAutosave, globalConfirm, cleanup explícito

import { DataTable } from '../components/DataTable/DataTable.js';
import modalAlumnoHtml from '../views/partials/modals/modal-alumno.html';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';

export class AlumnoModule {
  constructor() {
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this._modalInjected = false; // ✅ Track para evitar re-inyección
  }

  // =========================================
  // INICIALIZACIÓN PRINCIPAL
  // =========================================
    async init() {
    console.log('📘 [AlumnoModule] Iniciando módulo de Alumnos...');

    // 1. Inyectar modal (solo una vez)
    this._injectModal();

    // 2. Esperar que el tbody esté listo en el DOM
    await this._waitForDOM('tabla-alumnos-body');

    // 3. Cargar datos (lazy: solo si está vacío)
    if (!this.data || this.data.length === 0) {
      console.log('📡 [AlumnoModule] Cargando datos desde IPC...');
      await this._loadData();
    } else {
      console.log('💾 [AlumnoModule] Usando datos en caché...');
    }

    // 4. Renderizar tabla
    const tbody = document.getElementById('tabla-alumnos-body');
    if (!tbody) {
      console.error('❌ [AlumnoModule] tbody no encontrado');
      return;
    }

    if (this.data.length > 0) {
      this.table = new DataTable({
        tbodyId: 'tabla-alumnos-body',
        columns: this._getColumns(),
        expandable: true,
        actions: true,
        // ✅ Callbacks para interacción
        onRowClick: 'alumnoModuleInstance.handleRowClick(event)',
        onAction: 'alumnoModuleInstance.toggleActionMenu(event)',
        onExpand: 'alumnoModuleInstance.loadRowSummary(event)', // ✅ Corregido: era 'true'
        // ✅ NUEVO: Acción del botón "Gestionar" en fila expandible
        onExpandAction: 'alumnoModuleInstance.openAssignmentModal(this)'
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Alumnos renderizada con ${this.data.length} registros`);
    } else {
      this._renderEmptyState();
      console.log('ℹ️ [AlumnoModule] Sin registros para mostrar');
    }

    // 5. Vincular eventos
    this._setupSearch();
    this._setupModalEvents();
    this._setupGlobalHelpers();

    // ✅ EXPONER INSTANCIA GLOBAL (CRÍTICO para que funcione el onclick del HTML)
    window.alumnoModuleInstance = this;

    this.initialized = true;
    console.log('✅ [AlumnoModule] Inicialización completa');
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
    console.error(`❌ [AlumnoModule] Timeout: "${elementId}" no encontrado`);
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
        if (this.data.length > 0) {
          console.log('📄 [AlumnoModule] Primer registro:', this.data[0]);
          console.log('🔑 [AlumnoModule] Keys disponibles:', Object.keys(this.data[0]));
        }
        return true;
      }
      console.warn('⚠️ [AlumnoModule] Error en respuesta IPC:', res.error);
      return false;
    } catch (error) {
      console.error('❌ [AlumnoModule] Error cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
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
      { key: 'programa_academico', label: 'Programa' },
      { key: 'estado', label: 'Estado', badge: true }
    ];
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
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

  // =========================================
  // EVENTOS DEL MODAL (CON CONFIRMACIÓN GLOBAL)
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-alumno');
    const modal = this.modalElement;
    
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [AlumnoModule] Elementos del modal no encontrados');
      return;
    }

    // Abrir modal
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
    document.getElementById('btn-cancelar-alumno')?.addEventListener('click', intentarCerrar);
    
    // Click en overlay
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        e.preventDefault();
        intentarCerrar();
      }
    });

    // Botón guardar
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

  // ✅ Método privado para ejecutar cierre limpio (reutilizable)
  _ejecutarCierre() {
    // 1. Destruir guard PRIMERO (libera listeners y beforeunload)
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    
    // 2. Limpiar auto-guardado
    this.formAutosave?.clear();
    this.formAutosave = null;
    
    // 3. Resetear formulario
    const form = document.getElementById('form-alumno');
    if (form) form.reset();
    
    // 4. Ocultar modal
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // ABRIR MODAL
  // =========================================
  _openModal(alumno = null) {
    const modal = this.modalElement;
    const form = document.getElementById('form-alumno');
    if (!modal || !form) return;

    // ✅ NO resetear si FormAutosave va a restaurar datos (modo nuevo)
    if (!alumno) {
      const hasAutosave = localStorage.getItem('autosave:alumno-form');
      if (!hasAutosave) {
        form.reset();
      }
    } else {
      // En modo edición, siempre resetear primero
      form.reset();
    }
    
    // ✅ Helper seguro para setear valores (evita errores de null)
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val ?? '';
    };
    
    setVal('alumno-id', '');
    setVal('alumno-estado', 'activo'); // Siempre activo
    
    // ✅ Inicializar protecciones (FormAutosave restaura AUTOMÁTICAMENTE en su constructor)
    this.unsavedGuard = new UnsavedChangesGuard('#form-alumno');
    this.formAutosave = new FormAutosave('form-alumno', 'alumno-form');

    if (alumno) {
      // Modo edición: precargar datos de BD (sobrescribe cualquier autosave)
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
      
      // Limpiar autosave tras precargar datos reales
      this.formAutosave?.clear();
    }
    // ✅ En modo nuevo: si hay autosave, ya se restauró en el constructor de FormAutosave
    
    modal.classList.remove('hidden');
    
    // Enfocar primer campo con pequeño delay
    setTimeout(() => document.getElementById('alumno-matricula')?.focus(), 100);
  }

  // =========================================
  // GUARDAR ALUMNO
  // =========================================
  async _saveAlumno(modal) {
    // ✅ Helper seguro para obtener valores
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    
    const tratamiento = document.getElementById('alumno-tratamiento')?.value?.trim();
    
    if (!tratamiento) {
      alert('⚠️ Debes seleccionar un tratamiento');
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
      alert('⚠️ Campos obligatorios:\n• Matrícula\n• Apellido Paterno\n• Nombres\n• Periodo de Ingreso');
      return;
    }

    try {
      const res = await window.electronAPI.guardarAlumno(datos);
      
      if (res.success) {
        // ✅ Limpiar y cerrar tras guardar exitosamente
        this._ejecutarCierre();
        
        // Refrescar tabla
        await this._loadData();
        this.table?.setData(this.data);
      } else {
        alert(`❌ Error: ${res.error || 'No se pudo guardar'}`);
      }
    } catch (error) {
      console.error('💥 Error guardando alumno:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // ESTADO VACÍO
  // =========================================
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

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() {
    window.alumnoModuleInstance = this;
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
          <span class="chip accent">👨‍🏫 Tutor: Dr. Pérez</span>
          <span class="chip">📅 2024-A</span>
        `;
      }, 300);
    } catch (error) {
      chips.innerHTML = '<span class="chip" style="color:var(--danger-color)">Error</span>';
    }
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

    // src/renderer/modules/AlumnoModule.js
  
  openAssignmentModal(buttonEl) {
    // 1. Navegación DOM para encontrar la fila principal
    const expandedRow = buttonEl?.closest('.sub-row-details');
    const row = expandedRow 
      ? expandedRow.previousElementSibling 
      : buttonEl?.closest('.data-row');
    
    if (!row?.classList.contains('data-row')) {
      console.warn('⚠️ [AlumnoModule] No se encontró fila de datos válida');
      return;
    }
    
    // 2. Obtener ID numérico desde el dataset de la fila
    const alumnoId = row.dataset.id?.trim();
    if (!alumnoId) {
      console.error('❌ [AlumnoModule] La fila no tiene dataset.id');
      return;
    }

    // 3. Validar que tenemos datos cargados
    if (!this.data || this.data.length === 0) {
      console.error('❌ [AlumnoModule] No hay datos cargados en la tabla');
      return;
    }

    // 4. Buscar el alumno por ID numérico (coincide con data-id del HTML)
    const alumno = this.data.find(a => a.id == alumnoId);

    if (!alumno) {
      console.error(`❌ [AlumnoModule] Alumno no encontrado con ID: ${alumnoId}`);
      console.warn('💡 Pista: this.data[0] =', this.data[0]);
      return;
    }

    // 5. Debug opcional
    console.log('🔍 [AlumnoModule] Datos encontrados:', {
      id: alumno.id,
      matricula: alumno.matricula,
      nombres: alumno.nombres,
      apellido_paterno: alumno.apellido_paterno
    });

    // 6. Construir nombre completo robusto
    const nombreCompleto = [
      alumno.nombres,
      alumno.apellido_paterno,
      alumno.apellido_materno
    ].filter(p => p?.trim()).map(p => p.trim()).join(' ');

    // 7. Abrir modal con contexto de ALUMNO
    window.assignmentModal.open({
      entityType: 'alumno',              // 🔑 Define qué cards mostrar
      entityId: alumno.id,               // ID interno para backend
      entityName: nombreCompleto,        // Nombre visual para sidebar
      matricula: alumno.matricula        // ✅ Matrícula visible para UI
    });
    
    console.log(`✅ [AlumnoModule] Modal abierto para: ${nombreCompleto} (${alumno.matricula})`);
  }

  // =========================================
  // CLEANUP (Para liberar recursos si se destruye el módulo)
  // =========================================
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