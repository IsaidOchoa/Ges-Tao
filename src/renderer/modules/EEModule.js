// src/renderer/modules/EEModule.js
import { DataTable } from '../components/DataTable/DataTable.js';
import { FormAutosave } from '../utils/formAutosave.js';
import { UnsavedChangesGuard } from '../utils/unsavedChanges.js';
import { globalConfirm } from '../utils/confirmationModal.js';
import { Toast } from '../components/common/Toast.js';

import modalEEHtml from '../views/partials/modals/modal-ee.html';
import '../styles/modals/modal-ee.css';

export class EEModule {
  constructor() {
    // Estado interno
    this.data = [];
    this.modalElement = null;
    this.initialized = false;
    this.table = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this._modalInjected = false;
    this.tbodyId = 'tabla-ee-body';
    this.instanceName = 'eeModuleInstance';
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
      onEdit: `${this.instanceName}.openEditModalFromMenu`,
      onToggleStatus: `${this.instanceName}.toggleEEStatus`,
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
      
      if (action === 'toggle' && typeof this.toggleEEStatus === 'function') {
        this.toggleEEStatus(rowId);
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
    if (this._modalInjected || document.getElementById('modal-ee')) {
      this.modalElement = document.getElementById('modal-ee');
      this._modalInjected = true;
      return;
    }
    const template = document.createElement('div');
    template.innerHTML = modalEEHtml;
    document.body.appendChild(template.firstElementChild);
    this.modalElement = document.getElementById('modal-ee');
    this._modalInjected = true;
    console.log('✅ [EEModule] Modal inyectado');
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
      const res = await window.electronAPI.listarEE();
      if (res.success) {
        this.data = res.rows || res.data;
        if (this.data.length > 0) {
          console.log('📄 [EEModule] Primer registro:', this.data[0]);
        }
        return true;
      }
      console.warn('⚠️ [EEModule] Error en respuesta IPC:', res.error);
      Toast.warning('No se pudieron cargar las EE', 4000);
      return false;
    } catch (error) {
      console.error('❌ [EEModule] Error cargando datos:', error);
      Toast.error('Error de conexión al cargar EE', 5000);
      return false;
    }
  }

  // =========================================
  // CONFIGURACIÓN DE COLUMNAS
  // =========================================
  _getColumns() {
    return [
      { 
        key: 'clave_ee', 
        label: 'Clave',
        format: (v) => `<strong style="font-family:monospace;">${v}</strong>` 
      },
      { 
        key: 'nombre', 
        label: 'Nombre',
        format: (v) => `<span title="${v}">${v?.length > 30 ? v.substring(0, 30) + '...' : v || '-'}</span>`
      },
      { 
        key: 'tipo', 
        label: 'Tipo',
        badge: true,
        format: (v) => {
          const colors = { 'Obligatoria': 'badge-success', 'Optativa': 'badge-warning', 'Taller': 'badge-info' };
          return `<span class="badge ${colors[v] || 'badge-secondary'}">${v || '-'}</span>`;
        }
      },
      { 
        key: 'creditos', 
        label: 'Créditos',
        format: (v) => v ? `${v} cr` : '-'
      },
      { 
        key: 'estado', 
        label: 'Estado',
        badge: true,
        format: (v, row) => {
          const estado = (row?.estado || v || '').toLowerCase();
          const map = {
            'activa': { label: 'Vigente', class: 'badge-success' },
            'inactiva': { label: 'Inactiva', class: 'badge-warning' },
            'archivada': { label: 'Archivada', class: 'badge-secondary' }
          };
          const config = map[estado] || { label: estado, class: 'badge-secondary' };
          return `<span class="badge ${config.class}">${config.label}</span>`;
        }
      }
    ];
  }

  // =========================================
  // BUSCADOR EN TIEMPO REAL
  // =========================================
  _setupSearch() {
    const input = document.getElementById('buscador-ee');
    if (!input) return;
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) { this.table?.setData(this.data); return; }
      const filtered = this.data.filter(item => {
        const searchable = [item.clave_ee, item.nombre, item.tipo, item.area, item.linea_investigacion].filter(v => v).join(' ').toLowerCase();
        return searchable.includes(txt);
      });
      this.table?.setData(filtered);
    });
  }

  // =========================================
  // EVENTOS DEL MODAL
  // =========================================
  _setupModalEvents() {
    const btnNuevo = document.getElementById('btn-nuevo-ee');
    const modal = this.modalElement;
    if (!btnNuevo || !modal) { console.warn('⚠️ [EEModule] Elementos del modal no encontrados'); return; }
    
    btnNuevo.onclick = (e) => { e.preventDefault(); this._openModal(); };
    
    const intentarCerrar = async () => {
      if (this.unsavedGuard?.hasUnsavedChanges) {
        const confirmado = await globalConfirm.ask('Tienes cambios sin guardar. ¿Deseas salir sin guardar?');
        if (!confirmado) return;
      }
      this._ejecutarCierre();
    };
    
    document.getElementById('btn-cerrar-modal-ee')?.addEventListener('click', intentarCerrar);
    document.getElementById('btn-cancelar-ee')?.addEventListener('click', intentarCerrar);
    modal.addEventListener('click', (e) => { if (e.target === modal) { e.preventDefault(); intentarCerrar(); } });
    
    const btnSave = document.getElementById('btn-guardar-ee');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async (e) => { e.preventDefault(); await this._saveEE(modal); });
    }
    
    // 🔹 Vincular listeners para cálculo automático de créditos
    this._setupCreditosListeners();
  }

  // =========================================
  // CERRAR MODAL (con restauración de título)
  // =========================================
  _ejecutarCierre() {
    // 🔹 Restaurar título a "Nueva Experiencia Educativa"
    const modalTitle = this.modalElement?.querySelector('.modal-header h3');
    if (modalTitle) modalTitle.textContent = 'Nueva Experiencia Educativa';
    
    this.unsavedGuard?.destroy(); this.unsavedGuard = null;
    this.formAutosave?.clear(); this.formAutosave = null;
    const form = document.getElementById('form-ee'); if (form) form.reset();
    if (this.modalElement) this.modalElement.classList.add('hidden');
  }

  // =========================================
  // 🔹 CÁLCULO DE CRÉDITOS EN TIEMPO REAL
  // =========================================
  _calcularCreditosTotales() {
    const teoria = parseInt(document.getElementById('ee-creditos-teoria')?.value) || 0;
    const practica = parseInt(document.getElementById('ee-creditos-practica')?.value) || 0;
    const otros = parseInt(document.getElementById('ee-creditos-otros')?.value) || 0;
    
    const total = teoria + practica + otros;
    
    // Actualizar display visual con animación
    const totalEl = document.getElementById('ee-creditos-total');
    if (totalEl) {
      totalEl.textContent = total;
      totalEl.classList.remove('animate');
      void totalEl.offsetWidth; // Trigger reflow para reiniciar animación
      totalEl.classList.add('animate');
    }
    
    // Actualizar campo oculto para enviar al backend
    const hiddenEl = document.getElementById('ee-creditos');
    if (hiddenEl) hiddenEl.value = total;
    
    return total;
  }

  // 🔹 Vincular listeners para cálculo automático
  _setupCreditosListeners() {
    ['ee-creditos-teoria', 'ee-creditos-practica', 'ee-creditos-otros'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this._calcularCreditosTotales());
        el.addEventListener('change', () => this._calcularCreditosTotales());
      }
    });
    
    // Calcular inicial al cargar (si el modal ya está en DOM)
    if (document.getElementById('ee-creditos-teoria')) {
      this._calcularCreditosTotales();
    }
  }

  // =========================================
  // ABRIR MODAL (Creación o Edición)
  // =========================================
  _openModal(ee = null) {
  const modal = this.modalElement;
  const form = document.getElementById('form-ee');
  if (!modal || !form) return;
  
  const modalTitle = modal.querySelector('.modal-header h3');
  if (modalTitle) modalTitle.textContent = ee ? 'Editar Experiencia Educativa' : 'Nueva Experiencia Educativa';
  
  form.reset();
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  setVal('ee-id', '');
  
  this.unsavedGuard = new UnsavedChangesGuard('#form-ee');
  this.formAutosave = new FormAutosave('form-ee', 'ee-form');
  
  if (ee) {
    // MODO EDICIÓN
    setVal('ee-id', ee.id);
    setVal('ee-clave', ee.clave_ee);
    setVal('ee-nombre', ee.nombre);
    setVal('ee-tipo', ee.tipo || 'Obligatoria');
    setVal('ee-creditos-teoria', ee.creditos_teoria ?? 0);
    setVal('ee-creditos-practica', ee.creditos_practica ?? 0);
    setVal('ee-creditos-otros', ee.creditos_otros ?? 0);
    
    // Fallback si solo hay total
    if (ee.creditos && !ee.creditos_teoria && !ee.creditos_practica && !ee.creditos_otros) {
      setVal('ee-creditos-teoria', ee.creditos);
      setVal('ee-creditos-practica', 0);
      setVal('ee-creditos-otros', 0);
    }
    
    this._calcularCreditosTotales();
    
    setVal('ee-h-teoria', ee.horas_teoria ?? 0);
    setVal('ee-h-practica', ee.horas_practica ?? 0);
    setVal('ee-programa', ee.programa_academico);
    setVal('ee-area', ee.area);
    setVal('ee-linea', ee.linea_investigacion);
    
    this.formAutosave?.clear();
  } else {
    setVal('ee-estado', 'activa');
    setVal('ee-tipo', 'Obligatoria');
    setVal('ee-creditos-teoria', 0);
    setVal('ee-creditos-practica', 0);
    setVal('ee-creditos-otros', 0);
    this._calcularCreditosTotales();
  }
  
  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('ee-clave')?.focus(), 100);
}

  // =========================================
  // 🔹 ABRIR MODAL DE EDICIÓN DESDE MENÚ CONTEXTUAL
  // =========================================
  async openEditModalFromMenu(rowId) {
    console.log('🔍 openEditModalFromMenu llamado con rowId:', rowId);
    
    // 1. Buscar la EE en los datos locales
    const ee = this.data.find(e => 
      String(e.id) === String(rowId) || 
      String(e.clave_ee) === String(rowId) ||
      e.id == rowId || 
      e.clave_ee == rowId
    );
    
    if (!ee) {
      console.error('❌ EE no encontrada para editar:', rowId);
      Toast.error('No se encontró la experiencia educativa para editar', 5000);
      return;
    }
    
    console.log('✅ EE encontrada para editar:', ee);
    
    // 2. Asegurar que el modal esté inyectado
    if (!this.modalElement) this._injectModal();
    
    // 3. Abrir modal en modo edición (reutiliza _openModal)
    this._openModal(ee);
    
    console.log('✅ Modal de edición abierto para EE:', ee.clave_ee);
  }

  // =========================================
  // 🔹 MÉTODO: Activar/Desactivar EE
  // =========================================
  async toggleEEStatus(rowId) {
    console.log('🔍 toggleEEStatus llamado con rowId:', rowId);
    
    // Búsqueda robusta: por id o clave_ee
    const ee = this.data.find(e => 
      String(e.id) === String(rowId) || 
      String(e.clave_ee) === String(rowId) ||
      e.id == rowId || 
      e.clave_ee == rowId
    );
    
    if (!ee) {
      console.error('❌ EE no encontrada para rowId:', rowId);
      Toast.error('No se encontró la EE para realizar la acción', 5000);
      return;
    }
    
    console.log('✅ EE encontrada:', { id: ee.id, clave_ee: ee.clave_ee, nombre: ee.nombre, estado: ee.estado });

    const nuevoEstado = ee.estado === 'activa' ? 'inactiva' : 'activa';
    const accionInfinitivo = nuevoEstado === 'activa' ? 'Activar' : 'Desactivar';
    const accionPasado = nuevoEstado === 'activa' ? 'activada' : 'desactivada';
    
    const nombreEE = ee.nombre || ee.clave_ee || 'esta experiencia educativa';

    const mensajeConfirmacion = nuevoEstado === 'inactiva' 
      ? `La experiencia educativa <strong>${nombreEE}</strong> quedará oculta en listas, búsquedas y no podrá ser asignada a docentes o alumnos.`
      : `La experiencia educativa <strong>${nombreEE}</strong> volverá a estar disponible para asignaciones y matrículas.`;

    const confirmado = await globalConfirm.ask(`¿${accionInfinitivo} experiencia educativa?`, mensajeConfirmacion);
    if (!confirmado) { console.log('⚠️ Usuario canceló la acción'); return; }

    try {
      console.log('📡 Enviando actualización a backend:', { id: ee.id, nuevoEstado });
      const res = await window.electronAPI.actualizarEstadoEE({ id: ee.id, nuevoEstado });
      
      if (res.success) {
        Toast.success(`EE ${accionPasado} correctamente: ${nombreEE}`, 5000);
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
  // GUARDAR EE (con cálculo de créditos correcto)
  // =========================================
  async _saveEE(modal) {
    const getVal = (id) => document.getElementById(id)?.value?.trim();
    
    // 🔹 Leer créditos desglosados desde los campos CORRECTOS
    const creditosTeoria = parseInt(document.getElementById('ee-creditos-teoria')?.value) || 0;
    const creditosPractica = parseInt(document.getElementById('ee-creditos-practica')?.value) || 0;
    const creditosOtros = parseInt(document.getElementById('ee-creditos-otros')?.value) || 0;
    const creditosTotal = creditosTeoria + creditosPractica + creditosOtros;
    
    const datos = {
      id: getVal('ee-id') ? parseInt(getVal('ee-id')) : null,
      clave_ee: getVal('ee-clave'),
      nombre: getVal('ee-nombre'),
      tipo: document.getElementById('ee-tipo')?.value,
      
      // 🔹 Créditos: total calculado + componentes individuales
      creditos: creditosTotal,
      creditos_teoria: creditosTeoria,
      creditos_practica: creditosPractica,
      creditos_otros: creditosOtros,
      
      // Horas (separado de créditos)
      horas_teoria: parseInt(getVal('ee-h-teoria')) || 0,
      horas_practica: parseInt(getVal('ee-h-practica')) || 0,
      
      // Otros campos
      area: getVal('ee-area'),
      linea_investigacion: getVal('ee-linea'),
      programa_academico: getVal('ee-programa'),
      estado: "activa"
    };
    
    // Validaciones
    if (!datos.clave_ee || !datos.nombre) {
      Toast.error('Campos obligatorios: Clave EE y Nombre', 6000);
      return;
    }
    
    // UI: Loading state
    const btnSave = document.getElementById('btn-guardar-ee');
    const originalText = btnSave?.innerHTML || '';
    if (btnSave) { btnSave.disabled = true; btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; }
    
    try {
      const res = await window.electronAPI.guardarEE(datos);
      if (res.success) {
        const accion = datos.id ? 'actualizada' : 'registrada';
        Toast.success(`EE ${accion} correctamente: ${datos.nombre}`, 5000);
        this._ejecutarCierre();
        await this._loadData();
        this.table?.setData(this.data);
      } else {
        Toast.error(`Error: ${res.error || 'No se pudo guardar'}`, 7000);
      }
    } catch (error) {
      console.error('💥 Error guardando EE:', error);
      Toast.error('Error de conexión al guardar EE', 6000);
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:50px; color:var(--text-muted)">
      <i class="fa-solid fa-book-open" style="font-size:2.5rem; margin:0 auto 15px; display:block; opacity:0.6"></i>
      <p style="margin:0">No hay experiencias educativas registradas</p></td></tr>`;
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
  _setupGlobalHelpers() { window.eeModuleInstance = this; }

  // =========================================
  // INTERACCIÓN DE FILAS
  // =========================================
  handleRowClick(event) {
    const row = event.target.closest('.data-row');
    if (!row || row.dataset.estado === 'inactivo' || row.dataset.estado === 'inactiva') return;
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
      setTimeout(() => {
        chips.innerHTML = `<span class="chip accent">👨‍🏫 2 Docentes</span><span class="chip">📅 2024-A</span><span class="chip">📚 8 Créditos</span>`;
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
    const row = expandedRow ? expandedRow.previousElementSibling : buttonEl?.closest('.data-row');
    if (!row?.classList.contains('data-row')) { console.warn('⚠️ [EEModule] No se encontró fila válida'); return; }
    
    const identificador = row.dataset.id?.trim();
    if (!identificador || !this.data?.length) return;
    
    const ee = this.data.find(e => e.clave_ee === identificador) || this.data.find(e => e.id == identificador);
    if (!ee) { console.error(`❌ EE no encontrada: ${identificador}`); return; }
    
    const nombreEE = ee.nombre || ee.clave_ee;
    window.assignmentModal.open({
      entityType: 'ee',
      entityId: ee.id,
      entityName: nombreEE,
      clave_ee: ee.clave_ee,
      tipo: ee.tipo,
      creditos: ee.creditos,
      area: ee.area
    });
    console.log(`✅ [EEModule] Modal abierto para: ${nombreEE}`);
  }

  // =========================================
  // CLEANUP
  // =========================================
  destroy() {
    this.unsavedGuard?.destroy(); this.unsavedGuard = null;
    this.formAutosave?.clear(); this.formAutosave = null;
    this.modalElement = null; this._modalInjected = false; this.table = null;
    console.log('🧹 [EEModule] Recursos liberados');
  }
}