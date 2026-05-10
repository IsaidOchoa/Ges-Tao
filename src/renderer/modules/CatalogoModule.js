// =======================================================
// IMPORTS DE MODALES Y MÓDULOS
// =======================================================
import modalEEHtml from '../views/partials/modals/modal-ee.html';
import modalTiposHtml from '../views/partials/modals/modal-tipos-constancia.html';
import modalPeriodoHtml from '../views/partials/modals/modal-periodo.html';
import modalProgramaHtml from '../views/partials/modals/modal-programa.html';

// ✅ IMPORTAR DocenteModule (módulo especializado para lógica de docentes)
import { DocenteModule } from './DocenteModule.js';

export class CatalogoModule {
  constructor() {
    this.data = {
      ee: [],
      tiposConstancia: [],
      periodos: [],
      programas: [],
      alumnos: [] // 🆕 Preparado para futura implementación
    };

    // ✅ CREAR INSTANCIA de DocenteModule para delegar lógica
    this.docenteModule = new DocenteModule();
    
    this.tabButtons = [];
    this.tabContents = [];
    
    // Timer para distinguir clic simple de doble clic
    this.clickTimer = null;
    this.DOUBLE_CLICK_DELAY = 250;
  }

  async init(defaultTab = null) {
    console.log('🚀 [CatalogoModule] Iniciando...');
    
    // 1. INYECTAR MODALES EN EL DOM
    this.injectModals();
    const tabsContainer = document.querySelector('.tabs-container');
    if (!tabsContainer) return true;

    this.setupTabs();
    await this.loadAllData();

    // ✅ 2. DELEGACIÓN: Escuchar clicks en pestañas para módulos especializados
    tabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      
      // Si es la pestaña de Docentes, delegar al módulo especializado
      if (btn.id === 'btn-tab-docentes') {
        console.log('🔗 [CatalogoModule] Delegando a DocenteModule...');
        // Pequeño delay para asegurar que la pestaña está visible en el DOM
        setTimeout(() => this.docenteModule.init(), 10);
      }
    });

    // ✅ 3. Inicializar DocenteModule si ya viene activa (acceso desde Home)
    if (defaultTab === 'btn-tab-docentes' || 
        document.getElementById('btn-tab-docentes')?.classList.contains('active')) {
      console.log('🎯 [CatalogoModule] Inicialización directa de DocenteModule');
      setTimeout(() => this.docenteModule.init(), 50);
    }

    // 4. Configurar listeners de modales (SOLO los que quedan en este módulo)
    this.setupModalEE();
    this.setupModalPeriodo();
    this.setupModalPrograma();
    this.setupModalTipoConstancia();

    // 🆕 5. Configurar Panel Inferior de EE
    this.setupPanelTabs();

    // Helpers globales
    window.abrirModal = (id) => {
        const modal = document.getElementById(id);
        if (modal) {
        modal.classList.remove('hidden');
        const form = modal.querySelector('form');
        if (form) form.reset();
        }
    };

    window.cerrarModal = (id) => {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('hidden');
    };

    // Listener global para cerrar menús
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.data-row') && !e.target.closest('.context-menu')) {
        this.closeAllMenus();
      }
    });

    // Activar pestaña específica si se solicita (excluyendo docentes que ya se manejó arriba)
    if (defaultTab && defaultTab !== 'btn-tab-docentes') {
      setTimeout(() => {
        const btn = document.getElementById(defaultTab);
        if (btn) {
          btn.click();
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 150);
    }

    return true;
  }

  injectModals() {
    const modals = [
      modalEEHtml,
      modalTiposHtml,
      modalPeriodoHtml,
      modalProgramaHtml
    ];

    modals.forEach(htmlString => {
      const template = document.createElement('div');
      template.innerHTML = htmlString;
      const modalElement = template.firstElementChild;
      
      if (modalElement) {
        document.body.appendChild(modalElement);
        console.log(`✅ Modal inyectado: ${modalElement.id}`);
      }
    });
  }

  setupTabs() {
    this.tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    this.tabContents = document.querySelectorAll('.tab-content');

    this.tabButtons.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      const index = this.tabButtons.indexOf(btn);
      this.tabButtons[index] = newBtn;

      newBtn.addEventListener('click', () => {
        this.tabButtons.forEach(b => b.classList.remove('active'));
        this.tabContents.forEach(c => c.classList.remove('active'));

        newBtn.classList.add('active');
        
        const targetId = newBtn.id.replace('btn-', ''); 
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');
      });
    });
  }

  async loadAllData() {
    try {
      // ✅ Promise.all SIN docentes (ya lo maneja DocenteModule)
      const [resEE, resTipos, resPer, resProg] = await Promise.all([
        window.electronAPI.listarEE(),
        window.electronAPI.listarTiposConstancia(),
        window.electronAPI.listarPeriodos(),
        window.electronAPI.listarProgramas()
      ]);

      if (resEE.success) {
        this.data.ee = resEE.rows || resEE.data;
        this.renderTable('tabla-ee-body', this.data.ee, this.getEEColumns(), 'ee');
        this.setupSearch('buscador-ee', this.data.ee, ['clave_ee', 'nombre', 'tipo'], this.renderTable.bind(this, 'tabla-ee-body', null, this.getEEColumns(), 'ee'));
      }

      if (resTipos.success) {
        this.data.tiposConstancia = resTipos.rows || resTipos.data;
        this.renderTable('tabla-tipos-constancia-body', this.data.tiposConstancia, this.getTipoConstanciaColumns(), 'tipos');
        this.setupSearch('buscador-tipos-constancia', this.data.tiposConstancia, ['nombre', 'clave'], this.renderTable.bind(this, 'tabla-tipos-constancia-body', null, this.getTipoConstanciaColumns(), 'tipos'));
      }

      if (resPer.success) {
        this.data.periodos = resPer.rows || resPer.data;
        this.renderTable('tabla-periodos-body', this.data.periodos, this.getPeriodoColumns(), 'periodos');
        this.setupSearch('buscador-periodos', this.data.periodos, ['clave', 'descripcion'], this.renderTable.bind(this, 'tabla-periodos-body', null, this.getPeriodoColumns(), 'periodos'));
      }

      if (resProg.success) {
        this.data.programas = resProg.rows || resProg.data;
        this.renderTable('tabla-programas-body', this.data.programas, this.getProgramaColumns(), 'programas');
        this.setupSearch('buscador-programas', this.data.programas, ['nombre', 'responsable'], this.renderTable.bind(this, 'tabla-programas-body', null, this.getProgramaColumns(), 'programas'));
      }

    } catch (error) {
      console.error('❌ [CatalogoModule] Error cargando datos:', error);
    }
  }

  // =======================================================
  // RENDER TABLE GENÉRICO (Para EE, Tipos, Periodos, Programas)
  // =======================================================
  renderTable(tbodyId, datos, columnasMap, tipo = 'generico') {
    console.log(`📊 Renderizando tabla: ${tbodyId} con ${datos?.length || 0} registros`);
  
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (!datos || datos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Sin registros</td></tr>';
      return;
    }

    datos.forEach(row => {
      const rowId = row.clave_ee || row.clave || row.id || row.matricula || Math.random().toString(36).substr(2, 9);
      const estadoVal = row.estado || row.estatus || '';
      const esActivo = ['activa','activo','vigente','abierto'].includes(estadoVal?.toLowerCase());
      
      let dataAttrs = `data-id="${rowId}" data-estado="${esActivo ? 'activo' : 'inactivo'}"`;

      // === FILA PRINCIPAL ===
      let html = `<tr class="data-row" 
                      ${dataAttrs}
                      onclick="catalogoModuleInstance.handleRowClick(event)"
                      oncontextmenu="catalogoModuleInstance.handleRowRightClick(event)"
                      ondblclick="catalogoModuleInstance.handleRowDoubleClick(event)">`;

      // ✅ PRIMERA CELDA: Columna de control (flecha)
      html += `<td class="col-expand">
                <i class="fa-solid fa-chevron-right row-arrow"></i>
              </td>`;

      // Columnas de datos dinámicas
      columnasMap.forEach(col => {
        let val = row[col.key];
        
        if (col.key === 'estado') {
          const dotClass = esActivo ? 'status-active' : 'status-inactive';
          const tooltip = esActivo ? 'Activo' : 'Inactivo';
          html += `<td><div class="status-dot-container" title="${tooltip}"><span class="status-dot ${dotClass}"></span></div></td>`;
        } else if (col.badge && col.key !== 'estado') {
          const cls = esActivo ? 'badge-success' : 'badge-danger';
          html += `<td><span class="badge ${cls}">${val}</span></td>`;
        } else if (col.date) {
          html += `<td>${val ? new Date(val).toLocaleDateString('es-MX') : '-'}</td>`;
        } else if (col.format) {
          html += `<td>${col.format(val, row)}</td>`;
        } else {
          html += `<td>${val || '-'}</td>`;
        }
      });

      // ✅ ÚLTIMA CELDA: Acciones (3 puntos)
      html += `<td style="text-align:right; position:relative; width:50px;">
                <div id="menu-${rowId}" class="context-menu hidden"></div>
                <div class="action-icon-container">
                  <button class="btn-action-menu" 
                          onclick="event.stopPropagation(); catalogoModuleInstance.toggleActionMenu(event, '${rowId}')"
                          title="Opciones">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </div>
              </td></tr>`;
        
        // === FILA EXPANDIBLE (Oculta por defecto) ===
        html += `<tr class="sub-row-details hidden" id="details-${rowId}">
                   <td colspan="100%" class="expansion-cell">
                     <div class="expansion-content">
                       <div class="info-panel">
                         <h5>Resumen de Asignaciones</h5>
                         <div class="summary-chips" id="summary-${rowId}">
                           <span class="chip">⏳ Cargando...</span>
                         </div>
                       </div>
                       <div class="action-panel">
                         <button class="btn-manage" onclick="event.stopPropagation(); window.openAssignmentModal('${rowId}', '${tipo}')">
                           <i class="fa-solid fa-diagram-project"></i> Gestionar Asignaciones
                         </button>
                         <p class="hint">Abre el panel completo para editar relaciones.</p>
                       </div>
                     </div>
                   </td>
                 </tr>`;
        
        tbody.innerHTML += html;
      });
    }

  setupSearch(inputId, dataList, searchKeys, renderCallback) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    newInput.addEventListener('input', (e) => {
      const txt = e.target.value.toLowerCase();
      const filtered = dataList.filter(item => 
        searchKeys.some(key => (item[key] || '').toString().toLowerCase().includes(txt))
      );
      renderCallback(filtered);
    });
  }

  // =======================================================
  // FUNCIONES GLOBALES PARA EXPANSIÓN DE FILAS
  // =======================================================

  toggleRowExpansion(rowElement) {
    if (!rowElement) return;
    
    rowElement.classList.toggle('expanded');
    
    const detailsRow = rowElement.nextElementSibling;
    
    if (detailsRow && detailsRow.classList.contains('sub-row-details')) {
      detailsRow.classList.toggle('hidden');
      
      if (!detailsRow.classList.contains('hidden')) {
        const rowId = rowElement.dataset.id;
        const tipo = this.getTipoPorTablaId(rowElement.closest('table').querySelector('tbody').id);
        this.loadRowSummary(rowId, tipo, detailsRow);
      }
    }
  }

  async loadRowSummary(rowId, tipo, container) {
    const chipsContainer = container.querySelector('.summary-chips');
    if (!chipsContainer) return;
    
    chipsContainer.innerHTML = '<span class="chip">⏳ Cargando...</span>';
    
    try {
      let summary = [];
      
      // ✅ SIN caso 'docentes' (ya lo maneja DocenteModule)
      if (tipo === 'ee') {
        summary = [
          { label: '👨‍🏫 2 Docentes', class: 'accent' },
          { label: '📅 Vigente', class: '' }
        ];
      } else if (tipo === 'alumnos') {
        summary = [
          { label: '👨‍🏫 Tutor: Dr. Pérez', class: 'accent' },
          { label: '📚 5 EE Cursadas', class: '' }
        ];
      } else {
        summary = [{ label: 'Sin asignaciones', class: '' }];
      }
      
      chipsContainer.innerHTML = summary.map(item => 
        `<span class="chip ${item.class || ''}">${item.label}</span>`
      ).join('');
      
    } catch (error) {
      console.error('Error cargando resumen:', error);
      chipsContainer.innerHTML = '<span class="chip" style="color:var(--danger-color)">Error al cargar</span>';
    }
  }

  // =======================================================
  // LÓGICA DE INTERACCIÓN DE FILAS
  // =======================================================

  handleRowClick(event) {
    if (event.detail === 1) {
      const row = event.target.closest('.data-row');
      if (!row) return;

      if (event.target.closest('.btn-action-menu') || event.target.closest('.context-menu') || event.target.closest('.btn-manage')) {
        return;
      }

      const tbodyId = row.closest('table').querySelector('tbody').id;
      const tipo = this.getTipoPorTablaId(tbodyId);
      const id = row.dataset.id;

      // 🆕 LÓGICA ESPECIAL PARA EE: Abrir panel inferior con 1 clic
      if (tipo === 'ee') {
        clearTimeout(this.clickTimer);
        document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        this.abrirPanelEE(id);
        this.closeAllMenus();
        return;
      }

      // LÓGICA PARA OTROS: Alternar expansión de fila
      clearTimeout(this.clickTimer);
      
      if (row.classList.contains('selected')) {
        row.classList.remove('selected');
      } else {
        document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
      }
      
      this.toggleRowExpansion(row);
      this.closeAllMenus();
    }
  }

  handleRowDoubleClick(event) {
    const row = event.target.closest('.data-row');
    if (!row) return;

    const tipo = this.getTipoPorTablaId(row.closest('table').querySelector('tbody').id);
    
    if (tipo === 'ee') return;

    const id = row.dataset.id;
    console.log(`Doble clic detectado en ${tipo}: ${id}`);
  }

  handleRowRightClick(event) {
    event.preventDefault();
    clearTimeout(this.clickTimer);
    
    const row = event.target.closest('.data-row');
    if (!row) return;

    if (row.classList.contains('expanded')) {
      this.toggleRowExpansion(row);
    }

    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
    this.showContextMenuForRow(row);
  }

  toggleActionMenu(event, rowId) {
    event.stopPropagation();
    this.closeAllMenus();
    
    const menu = document.getElementById(`menu-${rowId}`);
    if (!menu) return;

    if (!menu.classList.contains('hidden')) {
      menu.classList.add('hidden');
      return;
    }

    const row = document.querySelector(`.data-row[data-id="${rowId}"]`);
    if (row) {
      this.showContextMenuForRow(row);
    }
  }

  showContextMenuForRow(row) {
    if (!row) return;
    
    const id = row.dataset.id;
    const estado = row.dataset.estado;
    const tipo = this.getTipoPorTablaId(row.closest('table').querySelector('tbody').id);

    const menu = document.getElementById(`menu-${id}`);
    if (!menu) return;

    let opcionesHTML = '';
    
    opcionesHTML += `
      <div class="context-item" onclick="catalogoModuleInstance.abrirModalEdicion('${tipo}', '${id}'); catalogoModuleInstance.closeAllMenus();">
        <i class="fa-solid fa-pen-to-square"></i> Editar
      </div>`;
    
    if (estado === 'activo') {
      opcionesHTML += `
        <div class="context-item text-warning" onclick="catalogoModuleInstance.cambiarEstado('${tipo}', '${id}', 'inactivo'); catalogoModuleInstance.closeAllMenus();">
          <i class="fa-solid fa-toggle-off"></i> Desactivar
        </div>`;
    } else {
      opcionesHTML += `
        <div class="context-item text-success" onclick="catalogoModuleInstance.cambiarEstado('${tipo}', '${id}', 'activo'); catalogoModuleInstance.closeAllMenus();">
          <i class="fa-solid fa-toggle-on"></i> Activar
        </div>`;
    }
    
    // ✅ SIN caso especial para docentes (ya lo maneja DocenteModule)
    
    menu.innerHTML = opcionesHTML;
    menu.classList.remove('hidden');
  }

  closeAllMenus() {
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
  }

  getTipoPorTablaId(tbodyId) {
    // ✅ SIN caso 'docentes'
    if (tbodyId.includes('ee')) return 'ee';
    if (tbodyId.includes('tipos')) return 'tipos';
    if (tbodyId.includes('periodos')) return 'periodos';
    if (tbodyId.includes('programas')) return 'programas';
    if (tbodyId.includes('alumnos')) return 'alumnos';
    return 'generico';
  }

  abrirModalEdicion(tipo, id) {
    // 🆕 Lógica especial para EE: Abrir Panel Inferior
    if (tipo === 'ee') {
      this.abrirPanelEE(id);
      return;
    }

    // Lógica para Tipos de Constancia
    if (tipo === 'tipos') {
      const item = this.data.tiposConstancia.find(t => t.id == id || t.id == parseInt(id));
      if (item) {
        const modal = document.getElementById('modal-tipo-constancia');
        const titulo = document.getElementById('modal-titulo-tipo');
        
        document.getElementById('tipo-id').value = item.id;
        document.getElementById('tipo-clave-original').value = item.clave;
        document.getElementById('tipo-nombre').value = item.nombre;
        document.getElementById('tipo-descripcion').value = item.descripcion || '';
        document.getElementById('tipo-requiere-ee').checked = item.requiere_ee;
        document.getElementById('tipo-requiere-periodo').checked = item.requiere_periodo;
        
        titulo.textContent = `Editar: ${item.nombre}`;
        modal.classList.remove('hidden');
      }
      return;
    }
    
    console.log(`Editando ${tipo}: ${id}`);
    alert(`Función de edición para ${tipo} en desarrollo.`);
  }

  async cambiarEstado(tipo, id, nuevoEstado) {
    const accion = nuevoEstado === 'activo' ? 'ACTIVAR' : 'DESACTIVAR';
    if(!confirm(`¿Estás seguro de ${accion} este registro?`)) return;
    
    console.log(`Cambiando ${tipo} ${id} a ${nuevoEstado}`);
    alert(`✅ Estado cambiado a ${nuevoEstado.toUpperCase()} (Simulado)`);
    this.loadAllData();
  }

  // =======================================================
  // PANEL INFERIOR DE DETALLES (EE)
  // =======================================================

  abrirPanelEE(eeId) {
    const ee = this.data.ee.find(e => e.id == eeId || e.clave_ee == eeId);
    if (!ee) return;

    const panel = document.getElementById('panel-detalles-ee');
    const titulo = document.getElementById('panel-ee-titulo');
    const clave = document.getElementById('panel-ee-clave');

    if (!panel) {
      console.warn('⚠️ El panel de detalles no existe en el DOM.');
      return;
    }

    titulo.innerText = ee.nombre;
    clave.innerText = ee.clave_ee;
    panel.classList.remove('hidden');

    this.cargarContenidosEE(ee);
    this.cargarDocentesEE(ee);
    
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  cerrarPanelEE() {
    const panel = document.getElementById('panel-detalles-ee');
    if(panel) panel.classList.add('hidden');
    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
  }

  setupPanelTabs() {
    const tabs = document.querySelectorAll('.panel-tab-btn');
    tabs.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));
        
        newBtn.classList.add('active');
        const targetId = newBtn.dataset.target;
        document.getElementById(targetId).classList.add('active');
      });
    });
  }

  cargarContenidosEE(ee) {
    const container = document.getElementById('lista-contenidos-ee');
    if (!container) return;

    const temasMock = [
      { id: 1, descripcion: 'Introducción y fundamentos', orden: 1 },
      { id: 2, descripcion: 'Desarrollo de temas avanzados', orden: 2 },
      { id: 3, descripcion: 'Proyecto final', orden: 3 }
    ];

    if (temasMock.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay contenidos registrados.</div>';
      return;
    }

    container.innerHTML = temasMock.map(tema => `
      <div class="item-row">
        <div>
          <strong>Tema ${tema.orden}:</strong> ${tema.descripcion}
        </div>
        <div class="actions">
          <button class="btn btn-sm btn-outline text-danger" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  cargarDocentesEE(ee) {
    const container = document.getElementById('lista-docentes-ee');
    if (!container) return;

    const docentesMock = [
      { id: 1, nombre: 'Juan Pérez', periodo: '2024-A' },
      { id: 2, nombre: 'María López', periodo: '2024-B' }
    ];

    if (docentesMock.length === 0) {
      container.innerHTML = '<div class="empty-state">No hay docentes asignados.</div>';
      return;
    }

    container.innerHTML = docentesMock.map(doc => `
      <div class="item-row">
        <div>
          <strong>${doc.nombre}</strong>
          <small class="text-muted ml-2">Periodo: ${doc.periodo}</small>
        </div>
        <div class="actions">
          <button class="btn btn-sm btn-outline text-danger" title="Quitar asignación"><i class="fa-solid fa-user-slash"></i></button>
        </div>
      </div>
    `).join('');
  }

  // =======================================================
  // CONFIGURACIONES DE COLUMNAS (SOLO ENTIDADES RESTANTES)
  // =======================================================
  
  getEEColumns() {
    return [
      { key: 'clave_ee' },
      { key: 'nombre' },
      { key: 'tipo' },
      { key: 'creditos' },
      { key: 'estado', badge: true }
    ];
  }

  getTipoConstanciaColumns() {
    return [
      { key: 'clave', format: (v) => `<strong>${v}</strong>` },
      { key: 'nombre' },
      { 
        key: 'requiere_ee', 
        format: (v) => v ? '<i class="fa-solid fa-check" style="color:var(--success-color)"></i>' : '<span style="color:var(--text-muted)">-</span>' 
      },
      { 
        key: 'requiere_periodo', 
        format: (v) => v ? '<i class="fa-solid fa-check" style="color:var(--success-color)"></i>' : '<span style="color:var(--text-muted)">-</span>' 
      },
      { key: 'estado', badge: true }
    ];
  }

  getPeriodoColumns() {
    return [
      { key: 'clave' },
      { key: 'descripcion' },
      { key: 'fecha_inicio', date: true },
      { key: 'fecha_fin', date: true },
      { key: 'estado', badge: true }
    ];
  }

  getProgramaColumns() {
    return [
      { key: 'nombre' },
      { key: 'responsable' },
      { key: 'fecha_registro', date: true },
      { key: 'estado', badge: true }
    ];
  }

  // =======================================================
  // SETUP DE MODALES (SOLO LOS RESTANTES)
  // =======================================================
  
  setupModalEE() {
    const btn = document.getElementById('btn-nuevo-ee');
    const modal = document.getElementById('modal-ee');
    if (!btn || !modal) return;
    btn.onclick = () => { document.getElementById('form-ee')?.reset(); document.getElementById('ee-id').value=''; modal.classList.remove('hidden'); };
    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('modal-ee')?.querySelector('.btn-close')?.addEventListener('click', cerrar);
    const btnSave = document.getElementById('modal-ee')?.querySelector('.btn-primary');
    if(btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', () => this.handleGuardarEE(cerrar));
    }
  }

  async handleGuardarEE(onSuccessCallback) {
    const datos = {
      id: document.getElementById('ee-id')?.value || null,
      clave_ee: document.getElementById('ee-clave')?.value,
      nombre: document.getElementById('ee-nombre')?.value,
      tipo: document.getElementById('ee-tipo')?.value,
      creditos: parseInt(document.getElementById('ee-creditos')?.value) || 0,
      horas_teoria: parseInt(document.getElementById('ee-h-teoria')?.value) || 0,
      horas_practica: parseInt(document.getElementById('ee-h-practica')?.value) || 0,
      programa_academico: document.getElementById('ee-programa')?.value,
      estado: document.getElementById('ee-estado')?.value
    };
    if (!datos.clave_ee || !datos.nombre) return alert('Faltan datos obligatorios (Clave, Nombre)');
    const res = await window.electronAPI.guardarEE(datos);
    if (res.success) {
      alert('✅ EE guardada correctamente');
      onSuccessCallback();
      this.loadAllData();
    } else {
      alert('❌ Error: ' + res.error);
    }
  }

  setupModalPeriodo() {
    const btn = document.getElementById('btn-nuevo-periodo'); 
    const modal = document.getElementById('modal-periodo');
    if (!btn || !modal) return;
    btn.onclick = () => { document.getElementById('form-periodo')?.reset(); document.getElementById('per-id').value=''; modal.classList.remove('hidden'); };
    const cerrar = () => modal.classList.add('hidden');
    const btnSave = document.getElementById('modal-periodo')?.querySelector('.btn-primary');
    if(btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', () => this.handleGuardarPeriodo(cerrar));
    }
  }

  async handleGuardarPeriodo(onSuccessCallback) {
    const datos = {
      id: document.getElementById('per-id')?.value || null,
      clave: document.getElementById('per-clave')?.value,
      descripcion: document.getElementById('per-desc')?.value,
      fecha_inicio: document.getElementById('per-inicio')?.value,
      fecha_fin: document.getElementById('per-fin')?.value,
      estado: document.getElementById('per-estado')?.value
    };
    if (!datos.clave || !datos.fecha_inicio) return alert('Faltan datos obligatorios');
    const res = await window.electronAPI.guardarPeriodo(datos);
    if (res.success) {
      alert('✅ Periodo guardado correctamente');
      onSuccessCallback();
      this.loadAllData();
    } else {
      alert('❌ Error: ' + res.error);
    }
  }

  setupModalPrograma() {
    const btn = document.getElementById('btn-nuevo-programa'); 
    const modal = document.getElementById('modal-programa');
    if (!btn || !modal) return;
    btn.onclick = () => { document.getElementById('form-programa')?.reset(); document.getElementById('prog-id').value=''; modal.classList.remove('hidden'); };
    const cerrar = () => modal.classList.add('hidden');
    const btnSave = document.getElementById('modal-programa')?.querySelector('.btn-primary');
    if(btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', () => this.handleGuardarPrograma(cerrar));
    }
  }

  async handleGuardarPrograma(onSuccessCallback) {
    const datos = {
      id: document.getElementById('prog-id')?.value || null,
      nombre: document.getElementById('prog-nombre')?.value,
      descripcion: document.getElementById('prog-desc')?.value,
      responsable: document.getElementById('prog-resp')?.value,
      fecha_registro: document.getElementById('prog-fecha')?.value || new Date().toISOString().split('T')[0],
      estado: document.getElementById('prog-estado')?.value
    };
    if (!datos.nombre) return alert('Faltan datos obligatorios');
    const res = await window.electronAPI.guardarPrograma(datos);
    if (res.success) {
      alert('✅ Programa guardado correctamente');
      onSuccessCallback();
      this.loadAllData();
    } else {
      alert('❌ Error: ' + res.error);
    }
  }

  setupModalTipoConstancia() {
    const btnNuevo = document.getElementById('btn-nuevo-tipo-constancia');
    const modal = document.getElementById('modal-tipo-constancia');
    if (!btnNuevo || !modal) return;

    btnNuevo.onclick = () => {
      document.getElementById('form-tipo-constancia').reset();
      document.getElementById('tipo-id').value = '';
      document.getElementById('modal-titulo-tipo').textContent = 'Nuevo Tipo de Constancia';
      modal.classList.remove('hidden');
      document.getElementById('tipo-nombre').focus();
    };

    const cerrar = () => modal.classList.add('hidden');
    modal.querySelector('.btn-close').onclick = cerrar;
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrar(); });

    const btnSave = document.getElementById('btn-guardar-tipo-constancia');
    if(btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      
      newBtn.addEventListener('click', async () => {
        const id = document.getElementById('tipo-id').value;
        const nombre = document.getElementById('tipo-nombre').value.trim();
        const descripcion = document.getElementById('tipo-descripcion').value.trim();
        
        if (!nombre) return alert('El nombre es obligatorio');

        let clave = '';
        if (id) {
           clave = document.getElementById('tipo-clave-original')?.value || ''; 
           if(!clave) return alert('Error interno: No se encontró la clave original.');
        } else {
          const palabras = nombre.toUpperCase().split(' ').filter(p => p.length > 2);
          clave = palabras.slice(0, 2).map(p => p.substring(0, 4)).join('-');
          if(clave.length < 3) clave = 'TIPO-' + Date.now().toString().slice(-4);
        }

        const datos = {
          id: id ? parseInt(id) : null,
          clave: clave, 
          nombre: nombre,
          descripcion: descripcion,
          requiere_ee: document.getElementById('tipo-requiere-ee').checked,
          requiere_periodo: document.getElementById('tipo-requiere-periodo').checked,
          estado: 'activo'
        };

        const res = await window.electronAPI.guardarTipoConstancia(datos);
        if(res.success) {
          alert('✅ Guardado correctamente');
          cerrar();
          this.loadAllData();
        } else {
          alert('❌ Error: ' + res.error);
        }
      });
    }
  }
}

// Instancia Global
window.catalogoModuleInstance = new CatalogoModule();
document.addEventListener('DOMContentLoaded', () => {
  window.catalogoModuleInstance.init();
});