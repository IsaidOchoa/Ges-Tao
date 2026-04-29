export class EmisionModule {
  constructor() {
    this.datosMaestros = {
      docentes: [],
      periodos: [],
      ee: [],
      programas: [],
      tipos: []
    };
  }

  async init() {
    console.log('🚀 [EmisionModule] Iniciando...');
    await this.cargarDatosIniciales();
    this.configurarVistaPrevia();
    this.configurarFormulario();
  }

  async cargarDatosIniciales() {
    try {
      const resp = await window.electronAPI.obtenerDatosConstancia();
      if (resp.success) {
        this.datosMaestros = resp.data;
        
        // Fallback por si el endpoint maestro no trae los tipos aún
        if (!this.datosMaestros.tipos || this.datosMaestros.tipos.length === 0) {
          const respTipos = await window.electronAPI.listarTiposConstancia();
          if(respTipos.success) {
            this.datosMaestros.tipos = respTipos.rows || respTipos.data;
          }
        }
        
        this.llenarSelectores();
      } else {
        alert('Error al cargar datos para emisión: ' + resp.error);
      }
    } catch (e) {
      console.error('❌ Error crítico en EmisionModule:', e);
    }
  }

  llenarSelectores() {
    const fill = (id, items, defaultText, valueKey = 'id', textFn) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = `<option value="">${defaultText}</option>`;
      if (!items) return;
      
      items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        // Guardamos metadatos para validación lógica
        if (item.requiere_ee !== undefined) option.dataset.requiereEe = item.requiere_ee;
        if (item.requiere_periodo !== undefined) option.dataset.requierePeriodo = item.requiere_periodo;
        option.textContent = textFn(item);
        sel.appendChild(option);
      });
    };

    fill('sel-docente', this.datosMaestros.docentes, 'Seleccione un docente...', 'id', 
         d => `${d.codigo} - ${d.apellido_paterno}, ${d.nombres}`);
    
    fill('sel-tipo', this.datosMaestros.tipos, 'Seleccione un tipo...', 'id', 
         t => t.nombre);
    
    // Periodo SIEMPRE visible
    fill('sel-periodo', this.datosMaestros.periodos, 'Seleccione un periodo (Opcional)', 'id', 
         p => `${p.clave} - ${p.descripcion}`);
    
    // EE SIEMPRE visible (pero puede ser opcional según el tipo)
    fill('sel-ee', this.datosMaestros.ee, 'Seleccione una materia (Opcional)', 'id', 
         e => `${e.clave_ee} - ${e.nombre}`);
    
    // Programa SIEMPRE visible (Dato de asignación interna)
    fill('sel-programa', this.datosMaestros.programas, 'Seleccione un programa (Asignación interna)', 'id', 
         p => p.nombre);

    // Aplicar estado inicial de obligatoriedad
    this.actualizarObligatoriedad();
  }

  /**
   * 🆕 Lógica corregida: Solo afecta el atributo 'required', NO oculta campos.
   */
  actualizarObligatoriedad() {
    const selectTipo = document.getElementById('sel-tipo');
    if (!selectTipo) return;

    const opcionSeleccionada = selectTipo.options[selectTipo.selectedIndex];
    if (!opcionSeleccionada) return;

    const requiereEE = opcionSeleccionada.dataset.requiereEe === '1';
    const requierePeriodo = opcionSeleccionada.dataset.requierePeriodo === '1';

    const inputEE = document.getElementById('sel-ee');
    const inputPer = document.getElementById('sel-periodo');
    
    // Actualizar atributo required
    if (inputEE) inputEE.required = requiereEE;
    if (inputPer) inputPer.required = requierePeriodo;

    // Feedback visual opcional (cambiar label o placeholder)
    const labelEE = inputEE?.previousElementSibling;
    const labelPer = inputPer?.previousElementSibling;

    if (labelEE) {
      labelEE.innerHTML = requiereEE ? 'Materia (EE) <span style="color:red">*</span>' : 'Materia (EE) <small>(Opcional)</small>';
    }
    if (labelPer) {
      labelPer.innerHTML = requierePeriodo ? 'Periodo <span style="color:red">*</span>' : 'Periodo <small>(Opcional)</small>';
    }
  }

  configurarVistaPrevia() {
    const ids = ['sel-docente', 'sel-tipo', 'sel-periodo', 'sel-ee', 'sel-programa'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        
        newEl.addEventListener('change', () => {
          if (id === 'sel-tipo') this.actualizarObligatoriedad();
          this.actualizarPreview();
        });
      }
    });
    this.actualizarPreview();
  }

  actualizarPreview() {
    const docId = document.getElementById('sel-docente')?.value;
    const tipoId = document.getElementById('sel-tipo')?.value;
    const perId = document.getElementById('sel-periodo')?.value;
    const eeId = document.getElementById('sel-ee')?.value;

    const docente = this.datosMaestros.docentes.find(d => d.id == docId);
    const periodo = this.datosMaestros.periodos.find(p => p.id == perId);
    const ee = this.datosMaestros.ee.find(e => e.id == eeId);
    const tipoObj = this.datosMaestros.tipos.find(t => t.id == tipoId);

    const elNombre = document.getElementById('preview-nombre');
    if(elNombre) elNombre.innerText = docente ? `${docente.nombres} ${docente.apellido_paterno}` : '[NOMBRE DEL DOCENTE]';

    const elTipo = document.getElementById('preview-tipo');
    if(elTipo) elTipo.innerText = tipoObj ? tipoObj.nombre.toUpperCase() : '[TIPO]';

    // En la vista previa del PDF, mostramos EE solo si existe
    const spanEE = document.getElementById('preview-ee');
    if(spanEE) {
      spanEE.style.display = ee ? 'inline' : 'none';
      if(ee) spanEE.innerText = `en la experiencia educativa "${ee.nombre}"`;
    }

    // En la vista previa del PDF, mostramos Periodo solo si existe
    const spanPer = document.getElementById('preview-periodo');
    if(spanPer) {
      spanPer.style.display = periodo ? 'inline' : 'none';
      if(periodo) spanPer.innerText = `durante el periodo ${periodo.clave}`;
    }

    const hoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const elFecha = document.getElementById('preview-fecha');
    if(elFecha) elFecha.innerText = hoy;
  }

  configurarFormulario() {
    const form = document.getElementById('form-constancia');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const btn = document.getElementById('btn-generar');
      if(!btn) return;

      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';

      const datos = {
        docente_id: parseInt(document.getElementById('sel-docente').value),
        tipo_constancia_id: parseInt(document.getElementById('sel-tipo').value),
        periodo_id: document.getElementById('sel-periodo').value ? parseInt(document.getElementById('sel-periodo').value) : null,
        ee_id: document.getElementById('sel-ee').value ? parseInt(document.getElementById('sel-ee').value) : null,
        programa_id: document.getElementById('sel-programa').value ? parseInt(document.getElementById('sel-programa').value) : null
      };

      // Validaciones básicas
      if(!datos.docente_id || !datos.tipo_constancia_id) {
        alert('⚠️ Seleccione Docente y Tipo de Constancia.');
        btn.disabled = false; btn.innerHTML = originalText; return;
      }

      // Validaciones condicionales (Solo si el tipo lo exige)
      const tipoObj = this.datosMaestros.tipos.find(t => t.id == datos.tipo_constancia_id);
      if (tipoObj) {
        if (tipoObj.requiere_ee && !datos.ee_id) {
          alert('⚠️ Este tipo requiere seleccionar una Materia.');
          btn.disabled = false; btn.innerHTML = originalText; return;
        }
        if (tipoObj.requiere_periodo && !datos.periodo_id) {
          alert('⚠️ Este tipo requiere seleccionar un Periodo.');
          btn.disabled = false; btn.innerHTML = originalText; return;
        }
      }

      try {
        const resultado = await window.electronAPI.guardarConstancia(datos);
        if(resultado.success) {
          alert(`✅ ${resultado.message}\nFolio: ${resultado.folio}`);
          form.reset();
          this.actualizarPreview();
          this.actualizarObligatoriedad(); // Resetear labels
        } else {
          alert('❌ Error: ' + resultado.error);
        }
      } catch (err) {
        console.error(err);
        alert('Error de conexión.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }
}