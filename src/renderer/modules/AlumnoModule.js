// src/renderer/modules/AlumnoModule.js
// 📍 Arquitectura: Módulo autocontenido para gestión de Alumnos
// 🔗 DB Schema: alumnos(matricula, nombres, apellido_paterno, correo_contacto, programa_academico, estado, ...)

import { DataTable } from '../components/DataTable/DataTable.js';
import modalAlumnoHtml from '../views/partials/modals/modal-alumno.html';

export class AlumnoModule {
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
    console.log('📘 [AlumnoModule] Iniciando módulo de Alumnos...');

    // 1. Inyectar Modal en el DOM (si no existe)
    if (!document.getElementById('modal-alumno')) {
      const template = document.createElement('div');
      template.innerHTML = modalAlumnoHtml;
      document.body.appendChild(template.firstElementChild);
      this.modalElement = document.getElementById('modal-alumno');
      console.log('✅ Modal Alumno inyectado');
    }

    // 2. Esperar que el DOM esté listo (crítico para SPA)
    await this.waitForDOMReady('tabla-alumnos-body');

    // 3. Cargar datos (Lazy Load: solo si está vacío)
    if (!this.data || this.data.length === 0) {
      await this.loadData();
    }

    // 4. Renderizar tabla o estado vacío
    if (this.data && this.data.length > 0) {
      // Configurar y renderizar DataTable
      this.table = new DataTable({
        tbodyId: 'tabla-alumnos-body',
        columns: this.getColumns(),
        expandable: true,
        actions: true,
        onRowClick: 'alumnoModuleInstance.handleRowClick(event)',
        onAction: 'alumnoModuleInstance.toggleActionMenu(event)',
        onExpand: true
      });
      this.table.setData(this.data);
      console.log(`✅ Tabla Alumnos renderizada con ${this.data.length} registros`);
    } else {
      // ✅ Renderizar estado vacío CENTRADO
      this.renderEmptyState();
      console.log('ℹ️ Sin registros de alumnos');
    }
    
    // 5. Configurar eventos (siempre, porque el DOM es nuevo)
    this.setupSearch();
    this.setupModalEvents();
    this.setupGlobalHelpers();
    
    this.initialized = true;
    console.log('✅ [AlumnoModule] Inicialización completa');
  }

  // =========================================
  // ✅ ESTADO VACÍO CENTRADO (Corrección solicitada)
  // =========================================
  renderEmptyState() {
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
  // UTILIDAD: Esperar que el tbody exista en el DOM
  // =========================================
  async waitForDOMReady(tbodyId, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const tbody = document.getElementById(tbodyId);
      if (tbody) {
        console.log(`🔍 [AlumnoModule] tbody "${tbodyId}" encontrado en DOM`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.error(`❌ [AlumnoModule] Timeout: tbody "${tbodyId}" no encontrado`);
    return false;
  }

  // =========================================
  // CAPA DE DATOS
  // =========================================
  async loadData() {
    try {
      console.log('📡 [AlumnoModule] Solicitando datos a IPC...');
      const res = await window.electronAPI.listarAlumnos();
      
      console.log('📦 [AlumnoModule] Respuesta IPC:', { 
        success: res.success, 
        count: res.data?.length || res.rows?.length 
      });
      
      if (res.success) {
        this.data = res.rows || res.data;
        
        if (this.data.length > 0) {
          console.log('📄 [AlumnoModule] Primer registro:', this.data[0]);
          console.log('🔑 [AlumnoModule] Keys disponibles:', Object.keys(this.data[0]));
        }
        
        return true;
      } else {
        console.warn('⚠️ [AlumnoModule] Error en respuesta IPC:', res.error);
        return false;
      }
    } catch (error) {
      console.error('❌ [AlumnoModule] Error crítico cargando datos:', error);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS (Alineada con tu BD)
  // =========================================
  getColumns() {
    return [
      { 
        key: 'matricula', 
        label: 'Matrícula',
        format: (v) => `<strong style="font-family:monospace;">${v}</strong>` 
      },
      { 
        key: 'nombres', 
        label: 'Nombre Completo',
        // Combina apellidos y nombres
        format: (v, row) => {
          const partes = [
            row.apellido_paterno || '',
            row.apellido_materno || '',
            v || ''
          ].filter(p => p);
          return partes.join(' ');
        }
      },
      { 
        key: 'correo_contacto', 
        label: 'Correo' 
      },
      { 
        key: 'programa_academico', 
        label: 'Programa' 
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
    const input = document.getElementById('buscador-alumnos');
    if (!input) {
      console.warn('⚠️ [AlumnoModule] Input buscador no encontrado');
      return;
    }

    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      
      if (!txt) {
        if (this.data?.length) {
          this.table?.setData(this.data);
        } else {
          this.renderEmptyState();
        }
        return;
      }
      
      const filtered = this.data.filter(item => {
        const nombreCompleto = [
          item.nombres || '',
          item.apellido_paterno || '',
          item.apellido_materno || ''
        ].join(' ').toLowerCase();
        
        return nombreCompleto.includes(txt) || 
               (item.matricula || '').toLowerCase().includes(txt) || 
               (item.correo_contacto || '').toLowerCase().includes(txt);
      });
      
      if (filtered.length === 0) {
        this.renderEmptyState();
      } else {
        this.table?.setData(filtered);
      }
    });
  }

  // =========================================
  // GESTIÓN DE MODALES
  // =========================================
  setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-alumno');
    const modal = document.getElementById('modal-alumno');
    if (!btnNuevo || !modal) {
      console.warn('⚠️ [AlumnoModule] Elementos del modal no encontrados');
      return;
    }

    btnNuevo.onclick = (e) => {
      e.preventDefault();
      this.openModal();
    };

    const cerrarModal = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal-alumno')?.addEventListener('click', cerrarModal);
    document.getElementById('btn-cancelar-alumno')?.addEventListener('click', cerrarModal);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrarModal(); });

    const btnSave = document.getElementById('btn-guardar-alumno');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.saveAlumno(modal);
      });
    }
  }

  openModal(alumno = null) {
    const modal = document.getElementById('modal-alumno');
    const form = document.getElementById('form-alumno');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('alumno-id').value = '';
    
    if (alumno) {
      // Modo edición: prellenar formulario
      document.getElementById('alumno-id').value = alumno.id || '';
      document.getElementById('alumno-matricula').value = alumno.matricula || '';
      document.getElementById('alumno-ap-paterno').value = alumno.apellido_paterno || '';
      document.getElementById('alumno-ap-materno').value = alumno.apellido_materno || '';
      document.getElementById('alumno-nombres').value = alumno.nombres || '';
      document.getElementById('alumno-correo').value = alumno.correo_contacto || '';
      document.getElementById('alumno-telefono').value = alumno.telefono_contacto || '';
      document.getElementById('alumno-programa').value = alumno.programa_academico || '';
      document.getElementById('alumno-fecha').value = alumno.fecha_ingreso || '';
      document.getElementById('alumno-estado').value = alumno.estado || 'activo';
    }
    
    modal.classList.remove('hidden');
    document.getElementById('alumno-matricula')?.focus();
  }

  async saveAlumno(modal) {
    const datos = {
      id: document.getElementById('alumno-id')?.value || null,
      matricula: document.getElementById('alumno-matricula')?.value?.trim(),
      apellido_paterno: document.getElementById('alumno-ap-paterno')?.value?.trim(),
      apellido_materno: document.getElementById('alumno-ap-materno')?.value?.trim(),
      nombres: document.getElementById('alumno-nombres')?.value?.trim(),
      correo_contacto: document.getElementById('alumno-correo')?.value?.trim(),
      telefono_contacto: document.getElementById('alumno-telefono')?.value?.trim(),
      programa_academico: document.getElementById('alumno-programa')?.value,
      fecha_ingreso: document.getElementById('alumno-fecha')?.value,
      estado: document.getElementById('alumno-estado')?.value || 'activo'
    };

    if (!datos.matricula || !datos.apellido_paterno || !datos.nombres) {
      alert('⚠️ Campos obligatorios:\n• Matrícula\n• Apellido Paterno\n• Nombres');
      return;
    }

    try {
      const res = await window.electronAPI.guardarAlumno(datos);
      
      if (res.success) {
        alert('✅ Alumno guardado correctamente');
        modal.classList.add('hidden');
        await this.loadData();
        
        // Re-renderizar: si hay datos, tabla; si no, estado vacío
        if (this.data?.length) {
          this.table?.setData(this.data);
        } else {
          this.renderEmptyState();
        }
      } else {
        alert(`❌ Error: ${res.error || 'No se pudo guardar'}`);
      }
    } catch (error) {
      console.error('💥 Error guardando alumno:', error);
      alert('Error de conexión con la base de datos');
    }
  }

  // =========================================
  // UTILIDADES GLOBALES (Para onclick en HTML inyectado)
  // =========================================
  setupGlobalHelpers() {
    window.alumnoModuleInstance = this;
  }

  // =========================================
  // INTERACCIÓN DE FILAS: EXPANSIÓN
  // =========================================
  handleRowClick(event) {
    const row = event.target.closest('.data-row');
    if (!row) return;
    
    if (event.target.closest('.btn-action-menu') || event.target.closest('.context-menu')) {
      return;
    }
    
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

  async loadRowSummary(rowId, container) {
    const chips = container.querySelector('.summary-chips');
    if (!chips) return;
    
    chips.innerHTML = '<span class="chip">⏳ Cargando...</span>';
    
    try {
      // 🔄 Futuro: Consultar tutor asignado desde BD (tabla tutor_alumno)
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
  // MENÚ CONTEXTUAL (3 PUNTOS)
  // =========================================
  toggleActionMenu(event) {
    event.stopPropagation();
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
    
    const menu = event.target.closest('.action-icon-container')?.previousElementSibling;
    if (menu?.classList.contains('context-menu')) {
      menu.classList.toggle('hidden');
    }
  }

  // =========================================
  // ACCESO AL MEGA MODAL DE ASIGNACIONES
  // =========================================
  openAssignmentModal(alumnoId) {
    console.log(`🔗 [AlumnoModule] Abrir asignaciones para Alumno ID: ${alumnoId}`);
    alert(`🚧 Función en desarrollo:\nAsignar Tutor y ver EE cursadas.`);
  }
}