// Componente de fila individual
export class DataTableRow {
  constructor(rowData, config) {
    this.data = rowData;
    this.config = config; // { columns, onExpand, onAction, etc. }
    this.rowId = this.getId();
    this.isExpanded = false;
  }

  getId() {
    return this.data.codigo || 
           this.data.clave_ee || 
           this.data.clave || 
           this.data.id || 
           `temp-${Math.random().toString(36).substr(2, 9)}`;
  }

  isActive() {
    const estado = (this.data.estado || this.data.estatus || '').toLowerCase();
    return ['activo', 'activa', 'vigente', 'abierto'].includes(estado);
  }

  render() {
    const esActivo = this.isActive();
    
    // Fila principal
    let html = `<tr class="data-row" 
                    data-id="${this.rowId}" 
                    data-estado="${esActivo ? 'activo' : 'inactivo'}"
                    ${this.config.onRowClick ? `onclick="${this.config.onRowClick}"` : ''}>`;
    
    // Columna de expansión
    if (this.config.expandable) {
      html += `<td class="col-expand">
                 <i class="fa-solid fa-chevron-right row-arrow"></i>
               </td>`;
    }

    // Columnas dinámicas
    this.config.columns.forEach(col => {
      html += this.renderCell(col, esActivo);
    });

    // Columna de acciones
    if (this.config.actions) {
      html += this.renderActionsColumn();
    }
    
    html += `</tr>`;
    
    // Fila expandible
    if (this.config.expandable) {
      html += this.renderExpandableRow();
    }
    
    return html;
  }

  renderCell(col, esActivo) {
    let val = this.data[col.key];
    
    if (col.key === 'estado') {
      const cls = esActivo ? 'status-active' : 'status-inactive';
      return `<td><div class="status-dot-container"><span class="status-dot ${cls}"></span></div></td>`;
    }
    
    if (col.badge) {
      const cls = esActivo ? 'badge-success' : 'badge-danger';
      return `<td><span class="badge ${cls}">${val || '-'}</span></td>`;
    }
    
    if (col.format) {
      return `<td>${col.format(val, this.data)}</td>`;
    }
    
    return `<td>${val || '-'}</td>`;
  }

  renderActionsColumn() {
    return `<td style="text-align:right; position:relative; width:50px;">
              <div id="menu-${this.rowId}" class="context-menu hidden"></div>
              <div class="action-icon-container">
                <button class="btn-action-menu" 
                        onclick="event.stopPropagation(); ${this.config.onAction || ''}"
                        title="Opciones">
                  <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </td>`;
  }

  renderExpandableRow() {
    return `<tr class="sub-row-details hidden" id="details-${this.rowId}">
              <td colspan="100%" class="expansion-cell">
                <div class="expansion-content">
                  <div class="info-panel">
                    <h5>Resumen de Asignaciones</h5>
                    <div class="summary-chips" id="summary-${this.rowId}">
                      <span class="chip">⏳ Cargando...</span>
                    </div>
                  </div>
                  <div class="action-panel">
                    <button class="btn-manage" onclick="${this.config.onExpandAction || ''}">
                      <i class="fa-solid fa-diagram-project"></i> Gestionar Asignaciones
                    </button>
                    <p class="hint">Abre el panel completo para editar relaciones.</p>
                  </div>
                </div>
              </td>
            </tr>`;
  }
}