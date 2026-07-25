// src/renderer/components/modals/AssignmentModal/relations/ee/EEListRenderer.js

import { BaseRelationRenderer } from "../BaseRelationRenderer.js";

export class EEListRenderer extends BaseRelationRenderer {
  constructor({ api, toast, confirm, stateManager, uiLoader }) {
    super({
      api,
      toast,
      confirm,
      stateManager,
      moduleName: "ee_asignadas",
      uiLoader,
    });
  }

  async loadSelect() {
    if (!this._cardRefs?.select || !this._context || !this._periodId) return;

    const { select } = this._cardRefs;
    const { entityId } = this._context;

    try {
      const res = await this.api.listarEEDisponibles({
        periodoId: this._periodId,
        excludeAsignadasA: entityId,
      });

      const items = res?.success ? res.data : [];

      const currentOptions = Array.from(select.options)
        .map((opt) => opt.value)
        .filter((v) => v);
      const newOptions = items.map((ee) => ee.id);

      if (arraysEqual(currentOptions, newOptions)) {
        return;
      }

      select.disabled = true;
      select.innerHTML = '<option value="">Cargando...</option>';

      if (items.length === 0) {
        select.innerHTML =
          '<option value="" disabled>Todas las EE asignadas</option>';
      } else {
        select.innerHTML =
          '<option value="">Seleccionar materia...</option>' +
          items
            .map(
              (ee) =>
                `<option value="${ee.id}">${this.helpers.escapeHtml(ee.nombre)} (${this.helpers.escapeHtml(ee.clave_ee)})</option>`,
            )
            .join("");
      }

      select.disabled = items.length === 0;
    } catch (error) {
      console.error("Error cargando EE disponibles:", error);
      select.innerHTML = '<option value="" disabled>Error al cargar</option>';
      select.disabled = true;
    }
  }

  async renderList() {
    if (!this._cardRefs?.listContainer || !this._context || !this._periodId)
      return;

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context;

    try {
      const res = await this.api.obtenerEEDelDocente({
        docenteId: entityId,
        periodoId: this._periodId,
      });

      if (!res?.success) throw new Error(res?.error || "Respuesta inválida");

      const newItems = res.data || [];
      const newIds = newItems.map((item) => item.id);
      const currentIds = Array.from(this._currentItems.keys());

      // Si los IDs son idénticos, NO tocar el DOM
      if (arraysEqual(currentIds, newIds)) {
        return; // Sin parpadeo
      }

      // Solo mostrar loader si realmente hay cambios
      this._showLoading();

      listContainer.innerHTML = "";
      this._currentItems.clear();

      if (newItems.length === 0) {
        listContainer.innerHTML = `
          <tr class="empty-row">
            <td colspan="${this._getColumnCount()}">Ninguna Experiencia Educativa asignada</td>
          </tr>
        `;
        this._hideLoading();
        return;
      }

      const fragment = document.createDocumentFragment();
      newItems.forEach((ee) => {
        const item = this._createItem(ee);
        fragment.appendChild(item);
      });
      listContainer.appendChild(fragment);

      this._hideLoading();
    } catch (error) {
      this._hideLoading();
      console.error("Error cargando EE asignadas:", error);
      listContainer.innerHTML = this.helpers.errorTemplate(error.message);
    }
  }

  async refreshCounter() {
    if (!this._cardRefs?.counter) return;

    // Contar filas reales en la tabla (excluyendo la fila vacía)
    const rows =
      this._cardRefs.listContainer?.querySelectorAll("tr[data-id]") || [];
    const count = rows.length;

    this._updateCounterText(count);
  }

  async assign() {
    if (!this._cardRefs?.select || !this._cardRefs?.assignButton) return;

    const { select, assignButton } = this._cardRefs;
    const { entityId } = this._context;
    const eeId = select.value;

    if (!eeId) {
      this.toast.warning("Seleccione una materia");
      return;
    }

    const existingItemId = this._currentItems.keys().next().value;
    const existingItem = existingItemId
      ? this._currentItems.get(existingItemId)
      : null;

    if (existingItem) {
      const confirmed = await this.confirm.ask(
        "¿Reemplazar Experiencia Educativa?",
        `Actualmente tienes <strong>"${this.helpers.escapeHtml(existingItem.nombre)}"</strong>.<br>¿Reemplazar por <strong>"${this.helpers.escapeHtml(select.options[select.selectedIndex].text)}"</strong>?`,
      );

      if (!confirmed) return;

      try {
        await this.api.removerDocenteEE({
          docenteId: entityId,
          eeId: existingItemId,
          periodoId: this._periodId,
        });
        this._removeItemFromList(existingItemId);
      } catch (error) {
        this.toast.error("Error al desasignar EE actual");
        return;
      }
    }

    assignButton.disabled = true;
    assignButton.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Asignando...';

    try {
      const res = await this.api.asignarEEAdocente({
        docenteId: entityId,
        eeId: eeId,
        periodoId: this._periodId,
        cargaHoraria: 0,
      });

      if (res?.success) {
        this.toast.success("EE asignada correctamente");

        const selectedOption = select.options[select.selectedIndex];
        const newItem = {
          id: eeId,
          nombre: selectedOption.text.split("(")[0].trim(),
          clave_ee: selectedOption.text.match(/\(([^)]+)\)/)?.[1] || "",
          carga_horaria: 0,
        };

        await this._addItemToList(newItem);
        await this.refreshCounter();
        await this.loadSelect();

        this.stateManager.invalidateModules([
          "ee_asignadas",
          "counters",
          "sidebar",
        ]);
      } else {
        this.toast.error(res?.error || "Error al asignar");
      }
    } catch (error) {
      console.error("Error asignando EE:", error);
      this.toast.error(`Error: ${error.message}`);
    } finally {
      assignButton.disabled = false;
      assignButton.innerHTML = '<i class="fa-solid fa-plus"></i> Asignar';
    }
  }

  async remove(eeId, eeName) {
    if (!this._cardRefs) return;

    const confirmed = await this.confirm.ask(
      `¿Desasignar "${eeName}"?`,
      `¿Estás seguro de remover <strong>"${this.helpers.escapeHtml(eeName)}"</strong>?`,
    );

    if (!confirmed) return;

    const btn = this._cardRefs.listContainer.querySelector(
      `button[data-id="${eeId}"]`,
    );
    const originalState = btn
      ? { html: btn.innerHTML, disabled: btn.disabled }
      : null;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';
    }

    try {
      const res = await this.api.removerDocenteEE({
        docenteId: this._context.entityId,
        eeId: eeId,
        periodoId: this._periodId,
      });

      if (!res?.success) throw new Error(res?.error || "Error al desasignar");

      this.toast.success("EE desasignada correctamente");

      this._removeItemFromList(eeId);
      await this.refreshCounter();
      await this.loadSelect();

      this.stateManager.invalidateModules([
        "ee_asignadas",
        "counters",
        "sidebar",
      ]);
    } catch (error) {
      console.error("Error desasignando EE:", error);
      this.toast.error(`No se pudo desasignar: ${error.message}`);

      if (btn && originalState) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }

  _createItem(ee) {
    const row = document.createElement("tr");
    row.className = "table-row";
    row.dataset.id = ee.id;

    const nombre = ee.nombre || "Sin nombre";
    const clave = ee.clave_ee || "-";
    const carga = ee.carga_horaria || 0;

    row.innerHTML = `
    <td class="col-nombre">
      <strong>${this.helpers.escapeHtml(nombre)}</strong>
    </td>
    <td class="col-clave">
      <span class="badge-clave">${this.helpers.escapeHtml(clave)}</span>
    </td>
    <td class="col-carga">
      <span><i class="fa-regular fa-clock"></i> ${carga} hrs/sem</span>
    </td>
    <td class="col-actions">
      <button class="btn-remove-row" data-id="${ee.id}" data-name="${this.helpers.escapeHtml(nombre)}" title="Desasignar Materia">
        <i class="fa-solid fa-trash"></i>
      </button>
    </td>
  `;

    this._currentItems.set(ee.id, ee);
    return row;
  }
}

function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, idx) => val === arr2[idx]);
}
