// src/renderer/components/modals/AssignmentModal/relations/generacion/GeneracionAlumnoRenderer.js

import { BaseRelationRenderer } from '../BaseRelationRenderer.js';

export class GeneracionAlumnosRenderer extends BaseRelationRenderer {
  constructor({ api, toast, confirm, stateManager, uiLoader }) {
    super({ api, toast, confirm, stateManager, moduleName: 'generacion', uiLoader });
  }

  async loadSelect() {
    if (!this._cardRefs?.select || !this._context) return;

    const { select, assignButton } = this._cardRefs;

    select.disabled = true;
    select.innerHTML = '<option value="">Cargando...</option>';
    if (assignButton) assignButton.disabled = true;

    try {
      const res = await this.api.listarGeneracionesSelect();
      const items = res?.success ? res.data : [];

      if (items.length === 0) {
        select.innerHTML = '<option value="" disabled>No hay generaciones disponibles</option>';
      } else {
        select.innerHTML = '<option value="">Seleccionar generación...</option>' +
          items.map(g => {
            const ingreso = g.periodo_ingreso ? ` - ${g.periodo_ingreso}` : '';
            return `<option value="${g.id}">${this.helpers.escapeHtml(g.clave)} - ${this.helpers.escapeHtml(g.nombre)}${this.helpers.escapeHtml(ingreso)}</option>`;
          }).join('');
      }

      select.disabled = items.length === 0;
      if (assignButton) assignButton.disabled = items.length === 0;
    } catch (error) {
      console.error('Error cargando generaciones:', error);
      select.innerHTML = '<option value="" disabled>Error al cargar</option>';
      select.disabled = true;
    }
  }

  async renderList() {
    if (!this._cardRefs?.listContainer || !this._context) return;

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context;

    this._showLoading();

    try {
      const res = await this.api.obtenerGeneracionDeAlumno({ alumnoId: entityId });

      if (!res?.success) throw new Error(res?.error || 'Respuesta inválida');

      const newItems = res.data || [];
      const newIds = newItems.map(item => String(item.id));
      const currentIds = Array.from(this._currentItems.keys());

      this._hideLoading();

      if (newIds.length === currentIds.length && newIds.every((id, idx) => id === currentIds[idx])) {
        return;
      }

      listContainer.innerHTML = '';
      this._currentItems.clear();

      if (newItems.length === 0) {
        listContainer.innerHTML = `
          <tr class="empty-row">
            <td colspan="${this._getColumnCount()}">Sin generación asignada</td>
          </tr>
        `;
        return;
      }

      const fragment = document.createDocumentFragment();
      newItems.forEach(g => {
        const item = this._createItem(g);
        fragment.appendChild(item);
      });
      listContainer.appendChild(fragment);

    } catch (error) {
      this._hideLoading();
      console.error('Error cargando generación del alumno:', error);
      listContainer.innerHTML = this.helpers.errorTemplate(error.message);
    }
  }

  async refreshCounter() {
    const count = this._currentItems.size;
    this._updateCounterText(count);
  }

  async assign() {
    if (!this._cardRefs?.select || !this._cardRefs?.assignButton) return;

    const { select, assignButton } = this._cardRefs;
    const { entityId } = this._context;
    const generacionId = select.value;

    if (!generacionId) {
      this.toast.warning('Seleccione una generación');
      return;
    }

    assignButton.disabled = true;
    assignButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Asignando...';

    try {
      const res = await this.api.asignarGeneracionAlumno({
        alumnoId: entityId,
        generacionId: generacionId
      });

      if (res?.success) {
        this.toast.success('Generación asignada correctamente');

        this.stateManager.invalidateModules(['generacion', 'counters', 'sidebar']);

        this._currentItems.clear();
        await this.renderList();
        await this.loadSelect();
      } else {
        this.toast.error(res?.error || 'Error al asignar');
      }
    } catch (error) {
      console.error('Error asignando generación:', error);
      this.toast.error(`Error: ${error.message}`);
    } finally {
      assignButton.disabled = false;
      assignButton.innerHTML = '<i class="fa-solid fa-plus"></i> Asignar';
    }
  }

  async remove(generacionId, generacionName) {
    if (!this._cardRefs) return;

    const confirmed = await this.confirm.ask(
      '¿Desasignar generación?',
      `¿Quitar al alumno de <strong>"${this.helpers.escapeHtml(generacionName)}"</strong>?`
    );

    if (!confirmed) return;

    const btn = this._cardRefs.listContainer.querySelector(`button[data-id="${generacionId}"]`);
    const originalState = btn ? { html: btn.innerHTML, disabled: btn.disabled } : null;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';
    }

    try {
      const { entityId } = this._context;

      const res = await this.api.removerGeneracionDeAlumno({ alumnoId: entityId });

      if (!res?.success) throw new Error(res?.error || 'Error al desasignar');

      this.toast.success('Generación desasignada correctamente');

      this._removeItemFromList(generacionId);
      await this.refreshCounter();
      await this.loadSelect();

      this.stateManager.invalidateModules(['generacion', 'counters', 'sidebar']);

    } catch (error) {
      console.error('Error desasignando generación:', error);
      this.toast.error(`No se pudo desasignar: ${error.message}`);

      if (btn && originalState) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }

  _createItem(g) {
    const row = document.createElement('tr');
    row.className = 'table-row';
    row.dataset.id = String(g.id);

    const clave = g.clave || '-';
    const nombre = g.nombre || 'Sin nombre';
    const ingreso = g.periodo_ingreso || '-';

    row.innerHTML = `
      <td class="col-clave">
        <span class="badge-clave">${this.helpers.escapeHtml(clave)}</span>
      </td>
      <td class="col-nombre">
        <strong>${this.helpers.escapeHtml(nombre)}</strong>
      </td>
      <td class="col-ingreso">
        <span style="color: var(--text-muted);">${this.helpers.escapeHtml(ingreso)}</span>
      </td>
      <td class="col-actions" style="text-align: center;">
        <button class="btn-remove-row" data-id="${g.id}" data-name="${this.helpers.escapeHtml(nombre)}" title="Desasignar Generación">
          <i class="fa-solid fa-users-slash"></i>
        </button>
      </td>
    `;

    this._currentItems.set(String(g.id), g);
    return row;
  }
}