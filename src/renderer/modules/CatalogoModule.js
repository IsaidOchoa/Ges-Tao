export class CatalogoModule {
  constructor() {
    this.data = {
      docentes: [],
      ee: [],
      periodos: [],
      programas: []
    };
    
    this.tabButtons = [];
    this.tabContents = [];
    
    // 🆕 Timer para distinguir clic simple de doble clic
    this.clickTimer = null;
    this.DOUBLE_CLICK_DELAY = 250;
  }

  async init() {
    console.log('🚀 [CatalogoModule] Iniciando...');
    
    const tabsContainer = document.querySelector('.tabs-container');
    if (!tabsContainer) return;

    this.setupTabs();
    await this.loadAllData();

    this.setupModalDocente();
    this.setupModalEE();
    this.setupModalPeriodo();
    this.setupModalPrograma();

    // Helpers globales para modales (si los usas desde HTML)
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

    // 🆕 Registrar listener global para cerrar menús al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.data-row') && !e.target.closest('.context-menu')) {
        this.closeAllMenus();
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
      const [resDoc, resEE, resPer, resProg] = await Promise.all([
        window.electronAPI.listarDocentes(),
        window.electronAPI.listarEE(),
        window.electronAPI.listarPeriodos(),
        window.electronAPI.listarProgramas()
      ]);

      if (resDoc.success) {
        this.data.docentes = resDoc.rows || resDoc.data;
        this.renderTable('tabla-docentes-body', this.data.docentes, this.getDocenteColumns(), 'docentes');
        this.setupSearch('buscador-docentes', this.data.docentes, ['codigo', 'nombres', 'apellido_paterno', 'correo_contacto'], this.renderTable.bind(this, 'tabla-docentes-body', null, this.getDocenteColumns(), 'docentes'));
      }

      if (resEE.success) {
        this.data.ee = resEE.rows || resEE.data;
        this.renderTable('tabla-ee-body', this.data.ee, this.getEEColumns(), 'ee');
        this.setupSearch('buscador-ee', this.data.ee, ['clave_ee', 'nombre', 'tipo'], this.renderTable.bind(this, 'tabla-ee-body', null, this.getEEColumns(), 'ee'));
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

  /**
   * 🆕 RENDERIZADOR MEJORADO CON SOPORTE PARA FILAS INTELIGENTES
   * @param {string} tbodyId - ID del tbody
   * @param {array} datos - Array de datos
   * @param {array} columnasMap - Definición de columnas
   * @param {string} tipo - 'docentes', 'ee', 'periodos', 'programas'
   */
  renderTable(tbodyId, datos, columnasMap, tipo = 'generico') {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (!datos || datos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Sin registros</td></tr>';
      return;
    }

    datos.forEach(row => {
      // 🆕 Determinar ID único y datos para la fila
      const rowId = row.codigo || row.clave_ee || row.clave || row.id || Math.random().toString(36).substr(2, 9);
      const estadoVal = row.estado || row.estatus || '';
      const esActivo = ['activa','activo','vigente','abierto'].includes(estadoVal?.toLowerCase());
      
      // 🆕 Construir atributos data- para la fila interactiva
      let dataAttrs = `data-id="${rowId}" data-estado="${esActivo ? 'activo' : 'inactivo'}"`;
      
      // Solo docentes tienen email para el menú contextual
      if (tipo === 'docentes') {
        dataAttrs += ` data-email="${row.correo_contacto || ''}" data-nombre="${(row.nombres || '') + ' ' + (row.apellido_paterno || '')}".trim()`;
      }

      // 🆕 Iniciar fila con clases y eventos
      let html = `<tr class="data-row" 
                      ${dataAttrs}
                      onclick="catalogoModuleInstance.handleRowClick(event)"
                      oncontextmenu="catalogoModuleInstance.handleRowRightClick(event)"
                      ondblclick="catalogoModuleInstance.handleRowDoubleClick(event)">`;
      
      columnasMap.forEach(col => {
        let val = row[col.key];
        
        if (col.key === 'estado') {
          // 🆕 Renderizar Estado como DOT en lugar de badge de texto
          const dotClass = esActivo ? 'status-active' : 'status-inactive';
          const tooltip = esActivo ? 'Activo' : 'Inactivo';
          html += `<td><div class="status-dot-container" title="${tooltip}"><span class="status-dot ${dotClass}"></span></div></td>`;
        } else if (col.badge && col.key !== 'estado') {
          // Otros badges (si los hubiera) que no sean estado
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

            // 🆕 Columna de Acciones: Contenedor con el botón OCULTO por defecto
      html += `<td style="text-align:right; position:relative; width:40px;">
                 <!-- El menú desplegable -->
                 <div id="menu-${rowId}" class="context-menu hidden"></div>
                 
                 <!-- El botón de 3 puntos (Solo visible si .selected) -->
                 <div class="action-icon-container">
                   <button class="btn-action-menu" 
                           onclick="event.stopPropagation(); catalogoModuleInstance.toggleActionMenu(event, '${rowId}')"
                           title="Opciones">
                     <i class="fa-solid fa-ellipsis-vertical"></i>
                   </button>
                 </div>
               </td></tr>`;
      
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
  // 🆕 LÓGICA DE INTERACCIÓN DE FILAS (CLIC, DOBLE CLIC, DERECHO)
  // =======================================================

    // 1. Clic Izquierdo: SELECCIONAR fila (Mostrar icono)
  handleRowClick(event) {
    // Evitar conflicto con doble clic
    if (event.detail === 1) {
      this.clickTimer = setTimeout(() => {
        const row = event.target.closest('.data-row');
        if (!row) return;

        // Si ya estaba seleccionada, no hacemos nada (o podrías deseleccionar)
        if (row.classList.contains('selected')) return;

        // Deseleccionar todas las demás
        document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
        
        // Seleccionar esta
        row.classList.add('selected');
        
        // Cerrar cualquier menú abierto
        this.closeAllMenus();
      }, this.DOUBLE_CLICK_DELAY);
    }
  }

  // 2. Doble Clic: EDICIÓN RÁPIDA (Ignora selección)
  handleRowDoubleClick(event) {
    clearTimeout(this.clickTimer); // Cancelar selección pendiente
    
    const row = event.target.closest('.data-row');
    if (!row) return;

    const id = row.dataset.id;
    const tipo = this.getTipoPorTablaId(row.closest('table').querySelector('tbody').id);
    this.abrirModalEdicion(tipo, id);
  }

  // 3. Clic Derecho: MENÚ DIRECTO (Sin necesidad de seleccionar antes)
  handleRowRightClick(event) {
    event.preventDefault();
    clearTimeout(this.clickTimer);
    
    const row = event.target.closest('.data-row');
    if (!row) return;

    // Opcional: También seleccionar la fila al hacer clic derecho
    document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');

    this.showContextMenuForRow(row);
  }

  // 🆕 4. Toggle del Menú (Al hacer clic en los 3 puntos)
  toggleActionMenu(event, rowId) {
    event.stopPropagation(); // Evitar que el clic cierre la selección
    
    // Cerrar otros menús
    this.closeAllMenus();
    
    const menu = document.getElementById(`menu-${rowId}`);
    if (!menu) return;

    // Si el menú ya estaba abierto, lo cerramos. Si no, lo llenamos y abrimos.
    if (!menu.classList.contains('hidden')) {
      menu.classList.add('hidden');
      return;
    }

    // Buscar la fila para obtener datos
    const row = document.querySelector(`.data-row[data-id="${rowId}"]`);
    if (row) {
      this.showContextMenuForRow(row);
    }
  }

  // 5. Función Maestra (Llenar menú - Igual que antes)
  showContextMenuForRow(row) {
    if (!row) return;
    
    const id = row.dataset.id;
    const estado = row.dataset.estado;
    const tipo = this.getTipoPorTablaId(row.closest('table').querySelector('tbody').id);
    const email = row.dataset.email || '';
    const nombre = row.dataset.nombre || '';

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

    if (tipo === 'docentes' && email) {
      opcionesHTML += `
        <div class="context-item" onclick="catalogoModuleInstance.mostrarEnConstruccion('${email}', '${nombre}'); catalogoModuleInstance.closeAllMenus();">
          <i class="fa-regular fa-envelope"></i> Enviar Correo
        </div>`;
    }
    
    menu.innerHTML = opcionesHTML;
    menu.classList.remove('hidden');
  }

  closeAllMenus() {
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
  }

  getTipoPorTablaId(tbodyId) {
    if (tbodyId.includes('docentes')) return 'docentes';
    if (tbodyId.includes('ee')) return 'ee';
    if (tbodyId.includes('periodos')) return 'periodos';
    if (tbodyId.includes('programas')) return 'programas';
    return 'generico';
  }

  // =======================================================
  // ACCIONES DE NEGOCIO
  // =======================================================

  abrirModalEdicion(tipo, id) {
    console.log(`Editando ${tipo}: ${id}`);
    // 🛠️ AQUÍ DEBES IMPLEMENTAR LA LÓGICA PARA CARGAR DATOS Y ABRIR EL MODAL CORRECTO
    // Ejemplo básico:
    alert(`Abriendo edición para ${tipo} con ID: ${id}\n(Aquí cargarías los datos en el formulario correspondiente)`);
    
    // Ejemplo para docentes:
    // if (tipo === 'docentes') {
    //   const docente = this.data.docentes.find(d => d.codigo === id);
    //   if (docente) {
    //     document.getElementById('doc-codigo').value = docente.codigo;
    //     // ... rellenar resto de campos ...
    //     document.getElementById('modal-docente').classList.remove('hidden');
    //   }
    // }
  }

  async cambiarEstado(tipo, id, nuevoEstado) {
    const accion = nuevoEstado === 'activo' ? 'ACTIVAR' : 'DESACTIVAR';
    if(!confirm(`¿Estás seguro de ${accion} este registro?`)) return;
    
    console.log(`Cambiando ${tipo} ${id} a ${nuevoEstado}`);
    
    // 🛠️ LLAMADA AL BACKEND
    // let res;
    // if (tipo === 'docentes') res = await window.electronAPI.actualizarEstadoDocente(id, nuevoEstado);
    // if (tipo === 'ee') res = await window.electronAPI.actualizarEstadoEE(id, nuevoEstado);
    // ... etc ...
    
    // Simulación de éxito:
    alert(`✅ Estado cambiado a ${nuevoEstado.toUpperCase()}`);
    this.loadAllData(); // Recargar tablas
  }

  mostrarEnConstruccion(email, nombre) {
    alert(`🚧 Función en construcción.\n\nPróximamente podrás enviar un correo a:\n${nombre} <${email}>`);
  }

  // =======================================================
  // CONFIGURACIONES DE COLUMNAS (Actualizadas para quitar badge de estado)
  // =======================================================
  
  getDocenteColumns() {
    return [
      { key: 'codigo', format: (v) => `<strong>${v}</strong>` },
      { key: 'nombres', format: (v, row) => `${row.apellido_paterno} ${row.apellido_materno||''} ${v}`.trim() },
      { key: 'correo_contacto' },
      { key: 'estado', badge: true } // Se procesa especial en renderTable para ser dot
    ];
  }

  getEEColumns() {
    return [
      { key: 'clave_ee' },
      { key: 'nombre' },
      { key: 'tipo' },
      { key: 'creditos' },
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

  // ... (El resto de tus métodos setupModal... y handleGuardar... se mantienen igual) ...
  // Asegúrate de mantener tus métodos setupModalDocente, setupModalEE, etc. tal como los tenías.
  
  setupModalDocente() {
    const btnNuevo = document.getElementById('btn-nuevo-docente');
    const modal = document.getElementById('modal-docente');
    if (!btnNuevo || !modal) return;

    btnNuevo.onclick = () => {
      document.getElementById('form-docente')?.reset();
      modal.classList.remove('hidden');
    };

    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-modal')?.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrar(); });

    const btnSave = document.getElementById('btn-guardar-docente');
    if (btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      newBtn.addEventListener('click', async () => this.handleGuardarDocente(cerrar));
    }
  }

  async handleGuardarDocente(onSuccessCallback) {
    const datos = {
      codigo: document.getElementById('doc-codigo')?.value,
      apellido_paterno: document.getElementById('doc-ap-paterno')?.value,
      apellido_materno: document.getElementById('doc-ap-materno')?.value,
      nombres: document.getElementById('doc-nombres')?.value,
      correo_contacto: document.getElementById('doc-correo')?.value,
      telefono_contacto: document.getElementById('doc-telefono')?.value,
      nivel_academico: document.getElementById('doc-nivel')?.value,
      estado: document.getElementById('doc-estado')?.value
    };

    if (!datos.codigo || !datos.apellido_paterno || !datos.nombres) {
      alert('Faltan campos obligatorios (Código, Ap. Paterno, Nombres)');
      return;
    }

    const res = await window.electronAPI.guardarDocente(datos);
    if (res.success) {
      alert('✅ Docente guardado correctamente');
      onSuccessCallback();
      this.loadAllData();
    } else {
      alert('❌ Error: ' + res.error);
    }
  }

  // ... (Mantén aquí tus métodos setupModalEE, handleGuardarEE, setupModalPeriodo, etc. sin cambios) ...
  // Por brevedad no los repito, pero deben estar en tu archivo final.
  
  setupModalEE() {
    const btn = document.getElementById('btn-nuevo-ee');
    const modal = document.getElementById('modal-ee');
    if (!btn || !modal) return;
    btn.onclick = () => { document.getElementById('form-ee')?.reset(); modal.classList.remove('hidden'); };
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
    btn.onclick = () => { document.getElementById('form-periodo')?.reset(); modal.classList.remove('hidden'); };
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
    btn.onclick = () => { document.getElementById('form-programa')?.reset(); modal.classList.remove('hidden'); };
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
}

//IMPORTANTE: Crear una instancia global para que los eventos HTML puedan acceder a los métodos
window.catalogoModuleInstance = new CatalogoModule();
document.addEventListener('DOMContentLoaded', () => {
  window.catalogoModuleInstance.init();
});