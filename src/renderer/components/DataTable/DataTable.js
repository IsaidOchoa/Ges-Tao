// Contenedor principal de tabla
import { DataTableRow } from './DataTableRow.js';

export class DataTable {
  constructor(config) {
    this.tbodyId = config.tbodyId;
    this.columns = config.columns;
    this.expandable = config.expandable ?? true;
    this.actions = config.actions ?? true;
    this.data = [];
    this.onRowClick = config.onRowClick ?? null;
    this.onExpand = config.onExpand ?? null;
    this.onAction = config.onAction ?? null;
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  render() {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) {
      console.error(`❌ DataTable: tbody "${this.tbodyId}" no encontrado`);
      return;
    }
    
    tbody.innerHTML = '';
    
    if (!this.data?.length) {
      tbody.innerHTML = this.renderEmptyState();
      return;
    }

    // Configurar cada fila
    const rowConfig = {
      columns: this.columns,
      expandable: this.expandable,
      actions: this.actions,
      onRowClick: this.onRowClick,
      onAction: this.onAction,
      onExpandAction: this.onExpand ? `docenteModuleInstance.loadRowSummary('${this.tbodyId}', event)` : ''
    };

    // Renderizar filas
    this.data.forEach(rowData => {
      const row = new DataTableRow(rowData, rowConfig);
      tbody.innerHTML += row.render();
    });

    console.log(`✅ DataTable: ${this.data.length} filas renderizadas en ${this.tbodyId}`);
  }

  renderEmptyState() {
    return `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">
              <i class="fa-regular fa-folder-open" style="font-size:2rem; margin-bottom:10px; display:block;"></i>
              Sin registros
            </td></tr>`;
  }

  // Método para actualizar una fila específica (optimización futura)
  updateRow(rowId, newData) {
    const index = this.data.findIndex(r => {
      const id = r.codigo || r.clave_ee || r.clave || r.id;
      return id == rowId;
    });
    
    if (index !== -1) {
      this.data[index] = newData;
      this.render(); // Por ahora re-renderiza todo, luego optimizamos
    }
  }
}