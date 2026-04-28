export class CatalogoModule {
  constructor() {
    // Estado local del módulo (privado)
    this.data = {
      docentes: [],
      ee: [],
      periodos: [],
      programas: []
    };
    
    // Referencias DOM (se llenan en init)
    this.tabButtons = [];
    this.tabContents = [];
  }

  /**
   * Inicializa el módulo: carga datos y configura eventos.
   */
  async init() {
    console.log('🚀 [CatalogoModule] Iniciando...');
    
    const tabsContainer = document.querySelector('.tabs-container');
    if (!tabsContainer) return;

    // 1. Configurar navegación de pestañas
    this.setupTabs();

    // 2. Cargar todos los datos en paralelo
    await this.loadAllData();

    this.setupModalDocente();
    this.setupModalEE();
    this.setupModalPeriodo();
    this.setupModalPrograma();

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
  }

  /**
   * Configura la lógica de cambio de pestañas (UI)
   */
  setupTabs() {
    this.tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    this.tabContents = document.querySelectorAll('.tab-content');

    this.tabButtons.forEach(btn => {
      // Clonar para limpiar listeners viejos
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Actualizar referencia en el array
      const index = this.tabButtons.indexOf(btn);
      this.tabButtons[index] = newBtn;

      newBtn.addEventListener('click', () => {
        // Desactivar todos
        this.tabButtons.forEach(b => b.classList.remove('active'));
        this.tabContents.forEach(c => c.classList.remove('active'));

        // Activar actual
        newBtn.classList.add('active');
        
        // Mostrar contenido correspondiente
        const targetId = newBtn.id.replace('btn-', ''); // ej: btn-tab-ee -> tab-ee
        const targetContent = document.getElementById(targetId);
        if (targetContent) targetContent.classList.add('active');
      });
    });
  }

  /**
   * Carga todas las listas de la BD
   */
  async loadAllData() {
    try {
      const [resDoc, resEE, resPer, resProg] = await Promise.all([
        window.electronAPI.listarDocentes(),
        window.electronAPI.listarEE(),
        window.electronAPI.listarPeriodos(),
        window.electronAPI.listarProgramas()
      ]);

      if (resDoc.success) {
        this.data.docentes = resDoc.rows || resDoc.data; // Manejar variación de respuesta
        this.renderTable('tabla-docentes-body', this.data.docentes, this.getDocenteColumns());
        this.setupSearch('buscador-docentes', this.data.docentes, ['codigo', 'nombres', 'apellido_paterno', 'correo_contacto'], this.renderTable.bind(this, 'tabla-docentes-body', null, this.getDocenteColumns()));
        this.setupModalDocente();
      }

      if (resEE.success) {
        this.data.ee = resEE.rows || resEE.data;
        this.renderTable('tabla-ee-body', this.data.ee, this.getEEColumns());
        this.setupSearch('buscador-ee', this.data.ee, ['clave_ee', 'nombre', 'tipo'], this.renderTable.bind(this, 'tabla-ee-body', null, this.getEEColumns()));
        // Aquí iría setupModalEE() si lo implementamos
      }

      if (resPer.success) {
        this.data.periodos = resPer.rows || resPer.data; // Ojo con la clave 'data' vs 'rows'
        this.renderTable('tabla-periodos-body', this.data.periodos, this.getPeriodoColumns());
        this.setupSearch('buscador-periodos', this.data.periodos, ['clave', 'descripcion'], this.renderTable.bind(this, 'tabla-periodos-body', null, this.getPeriodoColumns()));
      }

      if (resProg.success) {
        this.data.programas = resProg.rows || resProg.data;
        this.renderTable('tabla-programas-body', this.data.programas, this.getProgramaColumns());
        this.setupSearch('buscador-programas', this.data.programas, ['nombre', 'responsable'], this.renderTable.bind(this, 'tabla-programas-body', null, this.getProgramaColumns()));
      }

    } catch (error) {
      console.error('❌ [CatalogoModule] Error cargando datos:', error);
    }
  }

  /**
   * Renderizador genérico de tablas
   */
  renderTable(tbodyId, datos, columnasMap) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = '';
    if (!datos || datos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Sin registros</td></tr>';
      return;
    }

    datos.forEach(row => {
      let html = '<tr>';
      columnasMap.forEach(col => {
        let val = row[col.key];
        
        // Lógica de formato
        if (col.badge) {
          const cls = ['activa','activo','vigente','abierto'].includes(val) ? 'badge-success' : 'badge-danger';
          html += `<td><span class="badge ${cls}">${val}</span></td>`;
        } else if (col.date) {
          html += `<td>${val ? new Date(val).toLocaleDateString('es-MX') : '-'}</td>`;
        } else if (col.format) {
          html += `<td>${col.format(val, row)}</td>`;
        } else {
          html += `<td>${val || '-'}</td>`;
        }
      });
      // Botón de acciones (fijo por ahora)
      html += `<td style="text-align:right"><button class="btn btn-sm btn-outline text-danger"><i class="fa-solid fa-trash"></i></button></td></tr>`;
      tbody.innerHTML += html;
    });
  }

  /**
   * Configurador genérico de buscadores
   */
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
  // CONFIGURACIONES ESPECÍFICAS POR TABLA (Columnas)
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
  // LÓGICA DE MODALES (Ejemplo: Docente)
  // =======================================================

  setupModalDocente() {
    const btnNuevo = document.getElementById('btn-nuevo-docente');
    const modal = document.getElementById('modal-docente');
    if (!btnNuevo || !modal) return;

    // Abrir
    btnNuevo.onclick = () => {
      document.getElementById('form-docente')?.reset();
      modal.classList.remove('hidden');
    };

    // Cerrar helpers
    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('btn-cerrar-modal')?.addEventListener('click', cerrar);
    document.getElementById('btn-cancelar-modal')?.addEventListener('click', cerrar);
    modal.addEventListener('click', (e) => { if(e.target === modal) cerrar(); });

    // Guardar
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
      this.loadAllData(); // Recargar todo
    } else {
      alert('❌ Error: ' + res.error);
    }
  }

  // ... dentro de la clase CatalogoModule ...

  // =======================================================
  // LÓGICA DE MODALES ADICIONALES (EE, PERIODOS, PROGRAMAS)
  // =======================================================

  async init() {
    console.log('🚀 [CatalogoModule] Iniciando...');
    this.setupTabs();
    await this.loadAllData();
    
    // Inicializar listeners de los nuevos modales
    this.setupModalEE();
    this.setupModalPeriodo();
    this.setupModalPrograma();
  }

  // ... (métodos existentes loadAllData, renderTable, etc.) ...

  // --- CONFIGURACIÓN MODAL EE ---
  setupModalEE() {
    const btn = document.getElementById('btn-nuevo-ee'); // Asegúrate que este ID exista en el HTML de la pestaña EE
    const modal = document.getElementById('modal-ee');
    if (!btn || !modal) return;

    btn.onclick = () => { document.getElementById('form-ee')?.reset(); modal.classList.remove('hidden'); };
    
    const cerrar = () => modal.classList.add('hidden');
    document.getElementById('modal-ee')?.querySelector('.btn-close')?.addEventListener('click', cerrar);
    // Nota: Los botones de cancelar/cerrar en el HTML ya tienen onclick="cerrarModal(...)"

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
      creditos: document.getElementById('ee-creditos')?.value,
      horas_teoria: document.getElementById('ee-h-teoria')?.value,
      horas_practica: document.getElementById('ee-h-practica')?.value,
      programa_academico: document.getElementById('ee-programa')?.value,
      estado: document.getElementById('ee-estado')?.value
    };

    if (!datos.clave_ee || !datos.nombre) return alert('Faltan datos obligatorios (Clave, Nombre)');

    const res = await window.electronAPI.guardarEE(datos);
    if (res.success) {
      alert('✅ EE guardada correctamente');
      onSuccessCallback();
      this.loadAllData(); // Recargar tabla
    } else {
      alert('❌ Error: ' + res.error);
    }
  }

  // --- CONFIGURACIÓN MODAL PERIODO ---
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

  // --- CONFIGURACIÓN MODAL PROGRAMA ---
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