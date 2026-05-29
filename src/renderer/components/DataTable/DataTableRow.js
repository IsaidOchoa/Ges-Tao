// renderer/components/DataTable/DataTableRow.js
export class DataTableRow {
  constructor(rowData, config) {
    this.data = rowData;
    this.config = config; // { columns, onExpand, onAction, etc. }
    this.rowId = this.getId();
    this.isExpanded = false;
  }

  getId() {

  const id = (
    this.data.codigo ||
    this.data.clave_ee ||
    this.data.clave ||
    this.data.id ||
    `temp-${Math.random().toString(36).substr(2, 9)}`
  );
  
  return String(id);
}

  isActive() {
    const estado = (this.data.estado || this.data.estatus || "").toLowerCase();
    return ["activo", "activa", "vigente", "abierto"].includes(estado);
  }

  render() {
    const esActivo = this.isActive();

    // Fila principal
    let html = `<tr class="data-row" 
                  data-id="${this.rowId}" 
                  data-estado="${esActivo ? "activo" : "inactivo"}"
                  ${this.config.onRowClick ? `onclick="${this.config.onRowClick}"` : ""}
                  oncontextmenu="event.preventDefault(); window.toggleRowContextMenu(event, '${this.rowId}')">`;

    // Columna de expansión
    if (this.config.expandable) {
      html += `<td class="col-expand">
               <i class="fa-solid fa-chevron-right row-arrow"></i>
             </td>`;
    }

    // Columnas dinámicas
    this.config.columns.forEach((col) => {
      html += this.renderCell(col, esActivo);
    });

    // Columna de acciones
    if (this.config.actions) {
      html += this.renderActionsColumn(esActivo);
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

    if (col.key === "estado") {
      const cls = esActivo ? "status-active" : "status-inactive";
      return `<td><div class="status-dot-container"><span class="status-dot ${cls}"></span></div></td>`;
    }

    if (col.badge) {
      const cls = esActivo ? "badge-success" : "badge-danger";
      return `<td><span class="badge ${cls}">${val || "-"}</span></td>`;
    }

    if (col.format) {
      return `<td>${col.format(val, this.data)}</td>`;
    }

    return `<td>${val || "-"}</td>`;
  }

  renderActionsColumn(esActivo) {
  const menuId = `menu-${this.rowId}`;
  const safeRowId = this.rowId.replace(/'/g, "\\'"); // Escapar comillas por seguridad

  return `
    <td class="col-actions" style="position:relative; width:60px;">
      <div id="${menuId}" class="context-menu hidden">
        <!-- 🔹 Usamos data-action y data-id en lugar de onclick -->
        <div class="context-item" data-action="edit" data-id="${safeRowId}">
          <i class="fa-solid fa-pen-to-square"></i> Editar
        </div>
        <div class="context-item" data-action="toggle" data-id="${safeRowId}">
          <i class="fa-solid ${esActivo ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> 
          ${esActivo ? 'Desactivar' : 'Activar'}
        </div>
      </div>
      
      <div class="action-icon-container">
        <button class="btn-action-menu" 
                onclick="event.stopPropagation(); window.toggleRowContextMenu(event, '${safeRowId}')"
                title="Opciones">
          <i class="fa-solid fa-ellipsis-vertical"></i>
        </button>
      </div>
    </td>`;
}

  renderExpandableRow() {
    const action = this.config.onExpandAction;

    const buttonContent = action
      ? `<button class="btn-manage" onclick="${action}" type="button">
         <i class="fa-solid fa-diagram-project"></i> Gestionar Asignaciones
       </button>`
      : `<button class="btn-manage" disabled title="Acción no configurada" type="button">
         <i class="fa-solid fa-diagram-project"></i> Gestionar
       </button>`;

    return `<tr class="sub-row-details hidden" id="details-${this.rowId}">
            <td colspan="100%" class="expansion-cell">
              <div class="expansion-content">
                <div class="info-panel">
                  <h5 style="text-align:left; margin:0 0 10px 0;">Resumen de Asignaciones</h5>
                  <div class="summary-chips" id="summary-${this.rowId}">
                    <span class="chip">⏳ Cargando...</span>
                  </div>
                </div>
                <div class="action-panel">
                  ${buttonContent}
                  <p class="hint">Abre el panel completo para editar relaciones.</p>
                </div>
              </div>
            </td>
          </tr>`;
  }
}
