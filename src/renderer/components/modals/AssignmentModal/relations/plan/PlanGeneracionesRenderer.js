// src/renderer/components/modals/AssignmentModal/relations/plan/GeneracionesDePlanRenderer.js

import { BaseRelationRenderer } from '../BaseRelationRenderer.js';

export class PlanGeneracionesRenderer extends BaseRelationRenderer {
  constructor({ api, toast, confirm, stateManager, uiLoader }) {
    super({ api, toast, confirm, stateManager, moduleName: 'generaciones', uiLoader });
  }

  // Solo lectura: no hay selector de asignación ni botón
  async loadSelect() {
    // Intencionalmente vacío: el card se renderiza en modo readOnly
  }

  async renderList() {
    if (!this._cardRefs?.listContainer || !this._context) return;

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context;

    this._showLoading();

    try {
      const res = await this.api.obtenerGeneracionesDePlan({ planId: entityId });

      if (!res?.success) throw new Error(res?.error || 'Respuesta inválida');

      const newItems = res.data || [];
      const newIds = newItems.map((item) => String(item.id));
      const currentIds = Array.from(this._currentItems.keys());

      this._hideLoading();

      if (
        newIds.length === currentIds.length &&
        newIds.every((id, idx) => id === currentIds[idx])
      ) {
        return;
      }

      listContainer.innerHTML = '';
      this._currentItems.clear();

      if (newItems.length === 0) {
        listContainer.innerHTML = `
          <tr class="empty-row">
            <td colspan="${this._getColumnCount()}">Ninguna generación usa este plan</td>
          </tr>
        `;
        return;
      }

      const fragment = document.createDocumentFragment();
      newItems.forEach((g) => {
        const item = this._createItem(g);
        fragment.appendChild(item);
      });
      listContainer.appendChild(fragment);

      await this.refreshCounter();
    } catch (error) {
      this._hideLoading();
      console.error('Error cargando generaciones del plan:', error);
      listContainer.innerHTML = this.helpers.errorTemplate(error.message);
    }
  }

  async refreshCounter() {
    const count = this._currentItems.size;
    this._updateCounterText(count);
  }

  _createItem(g) {
    const row = document.createElement('tr');
    row.className = 'table-row';
    row.dataset.id = String(g.id);

    const clave = g.clave || '-';
    const nombre = g.nombre || 'Sin nombre';
    const ingreso = g.periodo_ingreso || '-';
    const estado = g.estado || '-';

    row.innerHTML = `
      <td class="col-clave">
        <span class="badge-clave">${this.helpers.escapeHtml(clave)}</span>
      </td>
      <td class="col-nombre">
        <strong>${this.helpers.escapeHtml(nombre)}</strong>
      </td>
      <td>
        <span style="color: var(--text-muted);">${this.helpers.escapeHtml(ingreso)}</span>
      </td>
      <td style="text-align: left;">
        <span class="badge ${estado === 'activa' || estado === 'activo' ? 'badge-success' : 'badge-danger'}">
          ${this.helpers.escapeHtml(estado)}
        </span>
      </td>
    `;

    this._currentItems.set(String(g.id), g);
    return row;
  }
}