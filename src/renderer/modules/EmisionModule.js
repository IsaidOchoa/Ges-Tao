export class EmisionModule {
  constructor() {
    this.datosMaestros = {
      docentes: [],
      periodos: [],
      ee: [],
      programas: []
    };
  }

  async init() {
    console.log('🚀 [EmisionModule] Iniciando...');
    await this.cargarDatosIniciales();
    this.configurarVistaPrevia();
    this.configurarFormulario();
  }

  /**
   * Carga las listas para los selectores desde la BD
   */
  async cargarDatosIniciales() {
    try {
      const resp = await window.electronAPI.obtenerDatosConstancia();
      if (resp.success) {
        this.datosMaestros = resp.data;
        this.llenarSelectores();
      } else {
        alert('Error al cargar datos para emisión: ' + resp.error);
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Llena los <select> del formulario con los datos cargados
   */
  llenarSelectores() {
    // Helper para llenar un select
    const fill = (id, items, defaultText, valueKey = 'id', textFn) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = `<option value="">${defaultText}</option>`;
      items.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueKey];
        option.textContent = textFn(item);
        sel.appendChild(option);
      });
    };

    fill('sel-docente', this.datosMaestros.docentes, 'Seleccione un docente...', 'id', 
         d => `${d.codigo} - ${d.apellido_paterno}, ${d.nombres}`);
    
    fill('sel-periodo', this.datosMaestros.periodos, 'Sin periodo específico', 'id', 
         p => `${p.clave} (${p.descripcion})`);
    
    fill('sel-ee', this.datosMaestros.ee, 'Ninguna / General', 'id', 
         e => `${e.clave_ee} - ${e.nombre}`);
    
    fill('sel-programa', this.datosMaestros.programas, 'Ninguno', 'id', 
         p => p.nombre);
  }

  /**
   * Configura los listeners para actualizar la vista previa al cambiar selects
   */
  configurarVistaPrevia() {
    const ids = ['sel-docente', 'sel-tipo', 'sel-periodo', 'sel-ee', 'sel-programa'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        // Clonar para limpiar listeners viejos
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener('change', () => this.actualizarPreview());
      }
    });
    // Ejecutar una vez al inicio
    this.actualizarPreview();
  }

  /**
   * Actualiza el texto de la hoja de vista previa
   */
  actualizarPreview() {
    const docId = document.getElementById('sel-docente')?.value;
    const tipo = document.getElementById('sel-tipo')?.value;
    const perId = document.getElementById('sel-periodo')?.value;
    const eeId = document.getElementById('sel-ee')?.value;

    const docente = this.datosMaestros.docentes.find(d => d.id == docId);
    const periodo = this.datosMaestros.periodos.find(p => p.id == perId);
    const ee = this.datosMaestros.ee.find(e => e.id == eeId);

    // Actualizar DOM
    const elNombre = document.getElementById('preview-nombre');
    if(elNombre) elNombre.innerText = docente ? `${docente.nombres} ${docente.apellido_paterno}` : '[NOMBRE DEL DOCENTE]';

    const elTipo = document.getElementById('preview-tipo');
    if(elTipo) elTipo.innerText = tipo ? tipo.replace('_', ' ').toUpperCase() : '[TIPO]';

    const spanEE = document.getElementById('preview-ee');
    if(spanEE) {
      spanEE.style.display = ee ? 'inline' : 'none';
      if(ee) spanEE.innerText = `en la experiencia educativa "${ee.nombre}"`;
    }

    const spanPer = document.getElementById('preview-periodo');
    if(spanPer) {
      spanPer.style.display = periodo ? 'inline' : 'none';
      if(periodo) spanPer.innerText = `durante el periodo ${periodo.clave}`;
    }

    const hoy = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const elFecha = document.getElementById('preview-fecha');
    if(elFecha) elFecha.innerText = hoy;
  }

  /**
   * Maneja el envío del formulario de generación
   */
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
        docente_id: document.getElementById('sel-docente').value,
        tipo_constancia: document.getElementById('sel-tipo').value,
        periodo_id: document.getElementById('sel-periodo').value || null,
        ee_id: document.getElementById('sel-ee').value || null,
        programa_id: document.getElementById('sel-programa').value || null
      };

      if(!datos.docente_id || !datos.tipo_constancia) {
        alert('Por favor seleccione al menos el Docente y el Tipo de Constancia.');
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
      }

      try {
        const resultado = await window.electronAPI.guardarConstancia(datos);
        if(resultado.success) {
          alert(`✅ ${resultado.message}\nFolio generado: ${resultado.folio}`);
          form.reset();
          this.actualizarPreview();
        } else {
          alert('❌ Error: ' + resultado.error);
        }
      } catch (err) {
        alert('Error de conexión al generar.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }
}