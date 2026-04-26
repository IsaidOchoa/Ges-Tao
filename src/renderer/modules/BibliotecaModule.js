export class BibliotecaModule {
  constructor() {
    this.constanciasData = [];
  }

  async init() {
    console.log('🚀 [BibliotecaModule] Iniciando...');
    await this.cargarConstancias();
    this.configurarBuscador();
  }

  async cargarConstancias() {
    const tbody = document.getElementById('tabla-biblioteca-body');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Cargando biblioteca...</td></tr>';

    try {
      const resp = await window.electronAPI.obtenerBibliotecaConstancias();
      if (resp.success) {
        this.constanciasData = resp.rows;
        this.renderizarTabla(this.constanciasData);
      } else {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Error: ${resp.error}</td></tr>`;
      }
    } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error de conexión</td></tr>';
    }
  }

  renderizarTabla(datos) {
    const tbody = document.getElementById('tabla-biblioteca-body');
    const noResults = document.getElementById('no-results');
    if(!tbody) return;

    tbody.innerHTML = '';

    if (datos.length === 0) {
      if(noResults) noResults.style.display = 'block';
      return;
    } else {
      if(noResults) noResults.style.display = 'none';
    }

    datos.forEach(row => {
      const nombreCompleto = `${row.apellido_paterno || ''} ${row.nombres || ''}`.trim();
      const badgeClass = row.estado === 'emitida' ? 'badge-success' : 'badge-danger';
      const fechaFmt = new Date(row.fecha_emision).toLocaleDateString('es-MX');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:monospace; font-weight:bold; color:var(--primary-color);">${row.folio}</td>
        <td>${nombreCompleto || 'Sin asignar'}</td>
        <td>${row.tipo_constancia ? row.tipo_constancia.replace('_', ' ') : '-'}</td>
        <td>${row.periodo_clave || '-'}</td>
        <td>${fechaFmt}</td>
        <td><span class="badge ${badgeClass}">${row.estado}</span></td>
        <td style="text-align:right;">
          <button class="btn-action btn-view" title="Ver / Abrir PDF">
            <i class="fa-solid fa-eye"></i> Ver
          </button>
        </td>
      `;

      // Evento para el botón Ver
      const btnVer = tr.querySelector('.btn-view');
      btnVer.addEventListener('click', () => this.abrirConstancia(row));

      tbody.appendChild(tr);
    });
  }

  async abrirConstancia(row) {
    if (!row.ruta_archivo) {
      alert('⚠️ Esta constancia no tiene un archivo PDF asociado.\n\nNota: En esta versión de demostración, la generación del PDF físico está simulada. El registro existe en la base de datos.');
      return;
    }

    const resultado = await window.electronAPI.abrirArchivoPDF(row.ruta_archivo);
    
    if (!resultado.success) {
      alert(`❌ No se pudo abrir el archivo.\n\nDetalles: ${resultado.error}\n\nEs posible que el archivo haya sido movido o eliminado manualmente de la carpeta.`);
    }
  }

  configurarBuscador() {
    const buscador = document.getElementById('buscador-biblioteca');
    if(!buscador) return;

    const newBuscador = buscador.cloneNode(true);
    buscador.parentNode.replaceChild(newBuscador, buscador);

    newBuscador.addEventListener('input', (e) => {
      const texto = e.target.value.toLowerCase();
      
      const filtrados = this.constanciasData.filter(row => {
        const nombre = `${row.apellido_paterno} ${row.nombres}`.toLowerCase();
        const folio = (row.folio || '').toLowerCase();
        const tipo = (row.tipo_constancia || '').toLowerCase();
        
        return nombre.includes(texto) || folio.includes(texto) || tipo.includes(texto);
      });
      
      this.renderizarTabla(filtrados);
    });
  }
}