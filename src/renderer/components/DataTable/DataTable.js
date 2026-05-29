// src/renderer/components/DataTable/DataTable.js
import { DataTableRow } from './DataTableRow.js';

export class DataTable {
  constructor(config) {
    this.tbodyId = config.tbodyId;
    this.columns = config.columns;
    this.expandable = config.expandable ?? true;
    this.actions = config.actions ?? true;
    this.data = [];
    
    // Callbacks
    this.onRowClick = config.onRowClick ?? null;
    this.onExpand = config.onExpand ?? null;
    this.onAction = config.onAction ?? null;
    this.onExpandAction = config.onExpandAction ?? null;
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  // 🔹 NUEVO: Renderizar header dinámico según configuración
  renderHeader() {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) return;
    
    const table = tbody.closest('table');
    if (!table) return;
    
    let thead = table.querySelector('thead');
    if (!thead) {
      thead = document.createElement('thead');
      table.insertBefore(thead, tbody);
    }
    
    let headerHTML = '<tr>';
    
    // 1. Columna de expansión (SOLO si expandable = true)
    if (this.expandable) {
      headerHTML += '<th class="col-expand" scope="col" style="width:40px;min-width:40px;"></th>';
    }
    
    // 2. Columnas dinámicas
    this.columns.forEach(col => {
      const style = col.width ? `style="width:${col.width};"` : '';
      headerHTML += `<th scope="col" ${style}>${col.label}</th>`;
    });
    
    // 3. Columna de acciones (SOLO si actions = true)
    if (this.actions) {
      headerHTML += '<th scope="col" style="width:80px;text-align:center">ACCIONES</th>';
    }
    
    headerHTML += '</tr>';
    thead.innerHTML = headerHTML;
    
    console.log(`✅ DataTable: Header renderizado con ${this.columns.length} columnas + expandable:${this.expandable} + actions:${this.actions}`);
  }

  render() {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) {
      console.error(`❌ DataTable: tbody "${this.tbodyId}" no encontrado`);
      return;
    }
    
    // 🔹 Renderizar header dinámico PRIMERO
    this.renderHeader();
    
    tbody.innerHTML = '';
    
    if (!this.data?.length) {
      tbody.innerHTML = this.renderEmptyState();
      return;
    }

    const rowConfig = {
      columns: this.columns,
      expandable: this.expandable,
      actions: this.actions,
      onRowClick: this.onRowClick,
      onAction: this.onAction,
      onExpand: this.onExpand,
      onExpandAction: this.onExpandAction
    };

    this.data.forEach(rowData => {
      const row = new DataTableRow(rowData, rowConfig);
      tbody.innerHTML += row.render();
    });

    console.log(`✅ DataTable: ${this.data.length} filas renderizadas en ${this.tbodyId}`);
  }

  renderEmptyState() {
    // Calcular colspan dinámico: columnas + (expandable?1:0) + (actions?1:0)
    const extraCols = (this.expandable ? 1 : 0) + (this.actions ? 1 : 0);
    const colspan = this.columns.length + extraCols;
    
    return `<tr class="empty-state"><td colspan="${colspan}" style="text-align:center; padding:50px; color:var(--text-muted)">
              <i class="fa-regular fa-folder-open" style="font-size:2.5rem;margin:0 auto 15px;display:block;opacity:0.6"></i>
              <p style="margin:0">No hay registros</p>
            </td></tr>`;
  }

  updateRow(rowId, newData) {
    const index = this.data.findIndex(r => {
      const id = r.codigo || r.clave_ee || r.clave || r.id;
      return id == rowId;
    });
    
    if (index !== -1) {
      this.data[index] = newData;
      this.render();
    }
  }
}