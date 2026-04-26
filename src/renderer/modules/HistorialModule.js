export class HistorialModule {
  constructor() {
    this.historialData = [];
  }

  async init() {
    console.log('🚀 [HistorialModule] Iniciando...');
    await this.cargarHistorial();
    this.configurarBuscador();
  }

  async cargarHistorial() {
    const tbody = document.getElementById('tabla-historial-body');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando bitácora...</td></tr>';

    try {
      const resp = await window.electronAPI.obtenerHistorial();
      if (resp.success) {
        this.historialData = resp.rows || resp.data;
        this.renderizarTabla(this.historialData);
      } else {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error: ${resp.error}</td></tr>`;
      }
    } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error de conexión</td></tr>';
    }
  }

  renderizarTabla(datos) {
    const tbody = document.getElementById('tabla-historial-body');
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
      let badgeClass = 'audit-edit';
      let accionLabel = row.accion;
      
      if (row.accion.includes('EMITIR')) { badgeClass = 'audit-emission'; accionLabel = 'Emisión de Constancia'; }
      else if (row.accion.includes('LOGIN')) { badgeClass = 'audit-login'; accionLabel = 'Inicio de Sesión'; }
      else if (row.accion.includes('ELIMINAR')) { badgeClass = 'audit-delete'; accionLabel = 'Eliminación de Registro'; }
      
      let detallesHtml = `<span class="audit-details">${row.tabla_afectada || 'Sistema'}</span>`;
      
      if (row.folio) {
        const nombreDocente = row.nombres ? `${row.nombres} ${row.apellido_paterno || ''}` : 'Desconocido';
        detallesHtml += `<span class="audit-meta">Docente: <strong>${nombreDocente}</strong></span>`;
        if(row.tipo_constancia) {
          detallesHtml += `<span class="audit-meta">Tipo: ${row.tipo_constancia.replace('_', ' ')}</span>`;
        }
      }

      const fecha = new Date(row.fecha_sistema).toLocaleString('es-MX', { 
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' 
      });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-size:0.85rem; color:var(--text-muted);">${fecha}</td>
        <td><span class="badge-audit ${badgeClass}">${accionLabel}</span></td>
        <td>${detallesHtml}</td>
        <td style="font-family:monospace; font-weight:bold; color:var(--primary-color);">${row.folio || '-'}</td>
        <td style="text-align:right;"><i class="fa-solid fa-check-circle" style="color:var(--success-color);"></i></td>
      `;
      tbody.appendChild(tr);
    });
  }

  configurarBuscador() {
    const buscador = document.getElementById('buscador-historial');
    if(!buscador) return;

    const newBuscador = buscador.cloneNode(true);
    buscador.parentNode.replaceChild(newBuscador, buscador);

    newBuscador.addEventListener('input', (e) => {
      const texto = e.target.value.toLowerCase();
      
      const filtrados = this.historialData.filter(row => {
        const matchAccion = row.accion.toLowerCase().includes(texto);
        const matchTabla = (row.tabla_afectada || '').toLowerCase().includes(texto);
        const matchFolio = (row.folio || '').toLowerCase().includes(texto);
        const matchNombre = (row.nombres || '').toLowerCase().includes(texto) || 
                             (row.apellido_paterno || '').toLowerCase().includes(texto);
        const matchDetalles = (row.detalles || '').toLowerCase().includes(texto);

        return matchAccion || matchTabla || matchFolio || matchNombre || matchDetalles;
      });
      
      this.renderizarTabla(filtrados);
    });
  }
}