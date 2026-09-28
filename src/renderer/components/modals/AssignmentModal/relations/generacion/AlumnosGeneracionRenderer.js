// src/renderer/components/modals/AssignmentModal/relations/generacion/AlumnosGeneracionRenderer.js

import { BaseRelationRenderer } from "../BaseRelationRenderer.js";

export class AlumnosGeneracionRenderer extends BaseRelationRenderer {
  constructor({ api, toast, confirm, stateManager, uiLoader }) {
    super({
      api,
      toast,
      confirm,
      stateManager,
      moduleName: "alumnos",
      uiLoader,
    });
  }

  async loadSelect() {
    if (!this._cardRefs?.select || !this._context) return;

    const { select, assignButton } = this._cardRefs;

    select.disabled = true;
    select.innerHTML = '<option value="">Cargando...</option>';
    if (assignButton) assignButton.disabled = true;

    try {
      const res = await this.api.listarAlumnosSinGeneracion();
      const items = res?.success ? res.data : [];

      if (items.length === 0) {
        select.innerHTML =
          '<option value="" disabled>Todos los alumnos ya tienen generación asignada</option>';
      } else {
        select.innerHTML =
          '<option value="">Seleccionar alumno...</option>' +
          items
            .map((al) => {
              const nombre =
                `${al.apellido_paterno || ""} ${al.nombres || ""}`.trim();
              return `<option value="${al.id}">${this.helpers.escapeHtml(nombre)} (${this.helpers.escapeHtml(al.matricula)})</option>`;
            })
            .join("");
      }

      select.disabled = items.length === 0;
      if (assignButton) assignButton.disabled = items.length === 0;
    } catch (error) {
      console.error("Error cargando alumnos sin generación:", error);
      select.innerHTML = '<option value="" disabled>Error al cargar</option>';
      select.disabled = true;
      if (assignButton) assignButton.disabled = true;
    }
  }

  async renderList() {
    if (!this._cardRefs?.listContainer || !this._context) return;

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context;

    this._showLoading();

    try {
      const res = await this.api.obtenerAlumnosDeGeneracion({
        generacionId: entityId,
      });

      if (!res?.success) throw new Error(res?.error || "Respuesta inválida");

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

      listContainer.innerHTML = "";
      this._currentItems.clear();

      if (newItems.length === 0) {
        listContainer.innerHTML = `
          <tr class="empty-row">
            <td colspan="${this._getColumnCount()}">Ningún alumno en esta generación</td>
          </tr>
        `;
        return;
      }

      const fragment = document.createDocumentFragment();
      newItems.forEach((al) => {
        const item = this._createItem(al);
        fragment.appendChild(item);
      });
      listContainer.appendChild(fragment);
    } catch (error) {
      this._hideLoading();
      console.error("Error cargando alumnos de generación:", error);
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
    const alumnoId = select.value;

    if (!alumnoId) {
      this.toast.warning("Seleccione un alumno");
      return;
    }

    assignButton.disabled = true;
    assignButton.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Asignando...';

    try {
      const res = await this.api.asignarGeneracionAlumno({
        alumnoId: alumnoId,
        generacionId: entityId,
      });

      if (res?.success) {
        this.toast.success("Alumno agregado a la generación");

        this.stateManager.invalidateModules(["alumnos", "counters", "sidebar"]);

        this._currentItems.clear();
        await this.renderList();
        await this.loadSelect();
      } else {
        this.toast.error(res?.error || "Error al asignar");
      }
    } catch (error) {
      console.error("Error asignando alumno a generación:", error);
      this.toast.error(`Error: ${error.message}`);
    } finally {
      assignButton.disabled = false;
      assignButton.innerHTML = '<i class="fa-solid fa-plus"></i> Asignar';
    }
  }

  async remove(alumnoId, alumnoName) {
    if (!this._cardRefs) return;

    const confirmed = await this.confirm.ask(
      "¿Quitar de la generación?",
      `¿Quitar a <strong>"${this.helpers.escapeHtml(alumnoName)}"</strong> de esta generación?`,
    );

    if (!confirmed) return;

    const btn = this._cardRefs.listContainer.querySelector(
      `button[data-id="${alumnoId}"]`,
    );
    const originalState = btn
      ? { html: btn.innerHTML, disabled: btn.disabled }
      : null;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';
    }

    try {
      const res = await this.api.removerGeneracionDeAlumno({
        alumnoId: alumnoId,
      });

      if (!res?.success) throw new Error(res?.error || "Error al quitar");

      this.toast.success("Alumno quitado de la generación");

      this._removeItemFromList(alumnoId);
      await this.refreshCounter();
      await this.loadSelect();

      this.stateManager.invalidateModules(["alumnos", "counters", "sidebar"]);
    } catch (error) {
      console.error("Error quitando alumno de la generación:", error);
      this.toast.error(`No se pudo quitar: ${error.message}`);

      if (btn && originalState) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }

  _createItem(al) {
    const row = document.createElement("tr");
    row.className = "table-row";
    row.dataset.id = String(al.id);

    const nombre =
      `${al.apellido_paterno || ""} ${al.nombres || ""}`.trim() || "Sin nombre";
    const matricula = al.matricula || "-";
    const programa = al.programa_academico || "-";

    row.innerHTML = `
      <td class="col-nombre">
        <strong>${this.helpers.escapeHtml(nombre)}</strong>
      </td>
      <td class="col-matricula">
        <span class="badge-matricula">${this.helpers.escapeHtml(matricula)}</span>
      </td>
      <td class="col-programa">
        <span>${this.helpers.escapeHtml(programa)}</span>
      </td>
      <td class="col-actions" style="text-align: center;">
        <button class="btn-remove-row" data-id="${al.id}" data-name="${this.helpers.escapeHtml(nombre)}" title="Quitar de la Generación">
          <i class="fa-solid fa-user-slash"></i>
        </button>
      </td>
    `;

    this._currentItems.set(String(al.id), al);
    return row;
  }
}
