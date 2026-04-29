import modalDocenteHtml from '../views/partials/modals/modal-docente.html';
import modalEEHtml from '../views/partials/modals/modal-ee.html';
import modalTiposHtml from '../views/partials/modals/modal-tipos-constancia.html';
import modalPeriodoHtml from '../views/partials/modals/modal-periodo.html';
import modalProgramaHtml from '../views/partials/modals/modal-programa.html';

export class CatalogoModule {
  constructor() {
    this.data = {
      docentes: [],
      ee: [],
      tiposConstancia: [],
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
    
    // 1. INYECTAR MODALES EN EL DOM (Antes de cualquier otra cosa)
    this.injectModals();

    const tabsContainer = document.querySelector('.tabs-container');
    if (!tabsContainer) return;

    this.setupTabs();
    await this.loadAllData();

    // 2. Configurar listeners de modales
    this.setupModalDocente();
    this.setupModalEE();
    this.setupModalPeriodo();
    this.setupModalPrograma();
    this.setupModalTipoConstancia(); // 🆕 Agregado

    // Helpers globales para modales
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

    // Listener global para cerrar menús al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.data-row') && !e.target.closest('.context-menu')) {
        this.closeAllMenus();
      }
    });
  }

  /**
   * 🆕 Método para inyectar el HTML de los modales en el body
   */
  injectModals() {
    const modals = [
      modalDocenteHtml,
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
      const [resDoc, resEE, resTipos, resPer, resProg] = await Promise.all([
        window.electronAPI.listarDocentes(),
        window.electronAPI.listarEE(),
        window.electronAPI.listarTiposConstancia(), // 🆕
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

      // 🆕 Carga de Tipos de Constancia
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

  renderTable(tbodyId, datos, columnasMap, tipo = 'generico') {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (!datos || datos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Sin registros</td></tr>';
      return;
    }

    datos.forEach(row => {
      const rowId = row.codigo || row.clave_ee || row.clave || row.id || Math.random().toString(36).substr(2, 9);
      const estadoVal = row.estado || row.estatus || '';
      const esActivo = ['activa','activo','vigente','abierto'].includes(estadoVal?.toLowerCase());
      
      let dataAttrs = `data-id="${rowId}" data-estado="${esActivo ? 'activo' : 'inactivo'}"`;
      
      if (tipo === 'docentes') {
        dataAttrs += ` data-email="${row.correo_contacto || ''}" data-nombre="${(row.nombres || '') + ' ' + (row.apellido_paterno || '')}".trim()`;
      }

      let html = `<tr class="data-row" 
                      ${dataAttrs}
                      onclick="catalogoModuleInstance.handleRowClick(event)"
                      oncontextmenu="catalogoModuleInstance.handleRowRightClick(event)"
                      ondblclick="catalogoModuleInstance.handleRowDoubleClick(event)">`;
      
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

      html += `<td style="text-align:right; position:relative; width:40px;">
                 <div id="menu-${rowId}" class="context-menu hidden"></div>
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
  // LÓGICA DE INTERACCIÓN DE FILAS
  // =======================================================

  handleRowClick(event) {
    if (event.detail === 1) {
      this.clickTimer = setTimeout(() => {
        const row = event.target.closest('.data-row');
        if (!row) return;
        if (row.classList.contains('selected')) return;

        document.querySelectorAll('.data-row.selected').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        this.closeAllMenus();
      }, this.DOUBLE_CLICK_DELAY);
    }
  }

  handleRowDoubleClick(event) {
    clearTimeout(this.clickTimer);
    const row = event.target.closest('.data-row');
    if (!row) return;

    const id = row.dataset.id;
    const tipo = this.getTipoPorTablaId(row.closest('table').querySelector('tbody').id);
    this.abrirModalEdicion(tipo, id);
  }

  handleRowRightClick(event) {
    event.preventDefault();
    clearTimeout(this.clickTimer);
    
    const row = event.target.closest('.data-row');
    if (!row) return;

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
    if (tbodyId.includes('tipos')) return 'tipos';
    if (tbodyId.includes('periodos')) return 'periodos';
    if (tbodyId.includes('programas')) return 'programas';
    return 'generico';
  }

    abrirModalEdicion(tipo, id) {
    if (tipo === 'tipos') {
      // Buscar el dato en la memoria local
      const item = this.data.tiposConstancia.find(t => t.id == id || t.id == parseInt(id));
      if (item) {
        const modal = document.getElementById('modal-tipo-constancia');
        const titulo = document.getElementById('modal-titulo-tipo');
        
        // Llenar formulario
        document.getElementById('tipo-id').value = item.id;
        document.getElementById('tipo-clave-original').value = item.clave; // Guardar clave original
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
    alert(`Edición genérica para ${tipo} (Implementar lógica específica)`);
  }

  async cambiarEstado(tipo, id, nuevoEstado) {
    const accion = nuevoEstado === 'activo' ? 'ACTIVAR' : 'DESACTIVAR';
    if(!confirm(`¿Estás seguro de ${accion} este registro?`)) return;
    
    console.log(`Cambiando ${tipo} ${id} a ${nuevoEstado}`);
    alert(`✅ Estado cambiado a ${nuevoEstado.toUpperCase()}`);
    this.loadAllData();
  }

  mostrarEnConstruccion(email, nombre) {
    alert(`🚧 Función en construcción.\n\nPróximamente podrás enviar un correo a:\n${nombre} <${email}>`);
  }

  // =======================================================
  // CONFIGURACIONES DE COLUMNAS
  // =======================================================
  
  getDocenteColumns() {
    return [
      { key: 'codigo', format: (v) => `<strong>${v}</strong>` },
      { key: 'nombres', format: (v, row) => `${row.apellido_paterno} ${row.apellido_materno||''} ${v}`.trim() },
      { key: 'correo_contacto' },
      { key: 'estado', badge: true }
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
  // SETUP DE MODALES Y GUARDADO
  // =======================================================
  
  setupModalDocente() {
    const btnNuevo = document.getElementById('btn-nuevo-docente');
    const modal = document.getElementById('modal-docente');
    if (!btnNuevo || !modal) return;

    btnNuevo.onclick = () => {
      document.getElementById('form-docente')?.reset();
      document.getElementById('doc-id').value = ''; // Limpiar ID oculto
      modal.classList.remove('hidden');
    };

    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal-docente')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-docente')?.addEventListener('click', cerrar);
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
      id: document.getElementById('doc-id')?.value || null,
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

    // Abrir Modal (Modo Creación)
    btnNuevo.onclick = () => {
      document.getElementById('form-tipo-constancia').reset();
      document.getElementById('tipo-id').value = ''; // Sin ID = Modo Creación
      document.getElementById('modal-titulo-tipo').textContent = 'Nuevo Tipo de Constancia';
      modal.classList.remove('hidden');
      document.getElementById('tipo-nombre').focus();
    };

    const cerrar = () => modal.classList.add('hidden');
    modal.querySelector('.btn-close').onclick = cerrar;
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrar(); });

    // Botón Guardar
    const btnSave = document.getElementById('btn-guardar-tipo-constancia');
    if(btnSave) {
      const newBtn = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtn, btnSave);
      
      newBtn.addEventListener('click', async () => {
        const id = document.getElementById('tipo-id').value;
        const nombre = document.getElementById('tipo-nombre').value.trim();
        const descripcion = document.getElementById('tipo-descripcion').value.trim();
        
        if (!nombre) return alert('El nombre es obligatorio');

        //  Lógica Inteligente de Clave
        let clave = '';
        if (id) {
          // Si es EDICIÓN, necesitamos obtener la clave original de la fila seleccionada o del data actual.
          // Para simplificar, si estamos editando, asumimos que la clave no cambia o deberíamos haberla cargado en un input oculto.
          // MEJOR OPCIÓN: Cargar la clave original en un input hidden al editar. 
          // Pero como lo quitamos del HTML, haremos esto:
          // Si es edición, la clave se mantiene igual en la BD, así que no la enviamos o enviamos la misma.
          // Necesitamos saber la clave anterior. Agreguemos un input hidden para la clave original.
           clave = document.getElementById('tipo-clave-original')?.value || ''; 
           if(!clave) {
             // Fallback si no encontramos la clave original (error de flujo)
             return alert('Error interno: No se encontró la clave original para editar.');
           }
        } else {
          // Si es CREACIÓN, generamos la clave automáticamente
          // Ej: "Participación como Docente" -> "PART-DOC"
          const palabras = nombre.toUpperCase().split(' ').filter(p => p.length > 2);
          clave = palabras.slice(0, 2).map(p => p.substring(0, 4)).join('-');
          // Asegurar que sea única simple (podría mejorar verificando en BD, pero esto basta para proto)
          if(clave.length < 3) clave = 'TIPO-' + Date.now().toString().slice(-4);
        }

        const datos = {
          id: id ? parseInt(id) : null,
          clave: clave, 
          nombre: nombre,
          descripcion: descripcion,
          requiere_ee: document.getElementById('tipo-requiere-ee').checked,
          requiere_periodo: document.getElementById('tipo-requiere-periodo').checked,
          estado: 'activo' // Siempre activo por defecto
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

// IMPORTANTE: Crear una instancia global
window.catalogoModuleInstance = new CatalogoModule();
document.addEventListener('DOMContentLoaded', () => {
  window.catalogoModuleInstance.init();
});