// src/renderer/components/modals/AssignmentModal/relations/tutorados/TutoradoListRenderer.js

import { BaseRelationRenderer } from "../BaseRelationRenderer.js";

export class TutoradoListRenderer extends BaseRelationRenderer {
  constructor({ api, toast, confirm, stateManager, uiLoader }) {
    super({
      api,
      toast,
      confirm,
      stateManager,
      moduleName: "tutorados",
      uiLoader,
    });
  }

  async loadSelect() {
    if (!this._cardRefs?.select || !this._context || !this._periodId) return;

    const { select, assignButton } = this._cardRefs;
    const { entityId } = this._context;

    // Estado de carga
    select.disabled = true;
    select.innerHTML = '<option value="">Cargando...</option>';
    if (assignButton) assignButton.disabled = true;

    try {
      const res = await this.api.listarAlumnosDisponibles({
        periodoId: this._periodId,
        excludeDocenteId: entityId,
      });

      const items = res?.success ? res.data : [];

      if (items.length === 0) {
        // CASO: Todos los alumnos ya tienen tutor asignado
        select.innerHTML =
          '<option value="" disabled> Todos los alumnos ya tienen tutor asignado</option>';
        select.disabled = true;
        if (assignButton) assignButton.disabled = true;
      } else {
        // CASO: Hay alumnos disponibles
        select.innerHTML =
          '<option value="">Seleccionar alumno...</option>' +
          items
            .map((al) => {
              const nombre =
                al.nombre_completo || `${al.nombres} ${al.apellido_paterno}`;
              return `<option value="${al.id}">${this.helpers.escapeHtml(nombre)} (${this.helpers.escapeHtml(al.matricula)})</option>`;
            })
            .join("");

        select.disabled = false;
        if (assignButton) assignButton.disabled = false;
      }
    } catch (error) {
      console.error("Error cargando alumnos disponibles:", error);
      select.innerHTML =
        '<option value="" disabled>Error al cargar lista</option>';
      select.disabled = true;
    }
  }

  async renderList() {
    if (!this._cardRefs?.listContainer || !this._context || !this._periodId) {
      console.log("[Tutorado] renderList abortado - faltan refs:", {
        hasListContainer: !!this._cardRefs?.listContainer,
        hasContext: !!this._context,
        hasPeriodId: !!this._periodId,
      });
      return;
    }

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context;

    console.log(
      "[Tutorado] Cargando tutorados para docente:",
      entityId,
      "periodo:",
      this._periodId,
    );

    this._showLoading();

    try {
      console.log("[Tutorado] Llamando a obtenerTutorados...");
      const res = await this.api.obtenerTutorados({
        docenteId: entityId,
        periodoId: this._periodId,
      });

      console.log("[Tutorado] Respuesta de obtenerTutorados:", res);

      if (!res?.success) throw new Error(res?.error || "Respuesta inválida");

      const newItems = res.data || [];
      console.log("[Tutorado] Tutorados recibidos:", newItems);

      const newIds = newItems.map((item) => item.id);
      const currentIds = Array.from(this._currentItems.keys());

      console.log(
        "[Tutorado] IDs nuevos:",
        newIds,
        "IDs actuales:",
        currentIds,
      );

      if (
        newIds.length === currentIds.length &&
        newIds.every((id, idx) => id === currentIds[idx])
      ) {
        console.log("[Tutorado] Sin cambios, no se re-renderiza");
        this._hideLoading();
        return;
      }

      listContainer.innerHTML = "";
      this._currentItems.clear();

      if (newItems.length === 0) {
        listContainer.innerHTML = `
          <tr class="empty-row">
            <td colspan="${this._getColumnCount()}">Ningun tutorado asignado</td>
          </tr>
        `;
        this._hideLoading();
        return;
      }

      const fragment = document.createDocumentFragment();
      newItems.forEach((al) => {
        console.log("[Tutorado] Creando item para alumno:", al);
        const item = this._createItem(al);
        fragment.appendChild(item);
      });
      listContainer.appendChild(fragment);

      this._hideLoading();
    } catch (error) {
      this._hideLoading();
      console.error("[Tutorado] Error cargando tutorados:", error);
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
    const alumnoId = select.value;

    if (!alumnoId) {
      this.toast.warning("Seleccione un alumno");
      return;
    }

    assignButton.disabled = true;
    assignButton.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Asignando...';

    try {
      const res = await this.api.asignarTutor({
        docenteId: entityId,
        alumnoId: alumnoId,
        periodoId: this._periodId,
      });

      if (res?.success) {
        this.toast.success("Tutorado asignado correctamente");

        const selectedOption = select.options[select.selectedIndex];
        const nombreCompleto = selectedOption.text.split("(")[0].trim();
        const matricula = selectedOption.text.match(/\(([^)]+)\)/)?.[1] || "";

        const newItem = {
          id: alumnoId,
          nombre_completo: nombreCompleto,
          matricula: matricula,
          programa_academico: "",
        };

        await this._addItemToList(newItem);
        await this.refreshCounter();
        await this.loadSelect();

        this.stateManager.invalidateModules([
          "tutorados",
          "counters",
          "sidebar",
        ]);
      } else {
        this.toast.error(res?.error || "Error al asignar");
      }
    } catch (error) {
      console.error("Error asignando tutorado:", error);
      this.toast.error(`Error: ${error.message}`);
    } finally {
      assignButton.disabled = false;
      assignButton.innerHTML = '<i class="fa-solid fa-plus"></i> Asignar';
    }
  }

  async remove(alumnoId, alumnoName) {
    if (!this._cardRefs) return;

    const confirmed = await this.confirm.ask(
      `¿Remover tutoría?`,
      `¿Quitar tutoría de <strong>"${this.helpers.escapeHtml(alumnoName)}"</strong>?`,
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
      const res = await this.api.removerTutor({
        docenteId: this._context.entityId,
        alumnoId: alumnoId,
        periodoId: this._periodId,
      });

      if (!res?.success) throw new Error(res?.error || "Error al remover");

      this.toast.success("Tutoría removida correctamente");

      this._removeItemFromList(alumnoId);
      await this.refreshCounter();
      await this.loadSelect();

      this.stateManager.invalidateModules(["tutorados", "counters", "sidebar"]);
    } catch (error) {
      console.error("Error removiendo tutorado:", error);
      this.toast.error(`No se pudo remover: ${error.message}`);

      if (btn && originalState) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }

  _createItem(alumno) {
    const row = document.createElement("tr");
    row.className = "table-row";
    row.dataset.id = alumno.id;

    const nombre =
      alumno.nombre_completo ||
      `${alumno.nombres || ""} ${alumno.apellido_paterno || ""}`.trim() ||
      "Sin nombre";
    const matricula = alumno.matricula || "-";
    const programa = alumno.programa_academico || "-";

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
    <td class="col-actions">
      <button class="btn-remove-row" data-id="${alumno.id}" data-name="${this.helpers.escapeHtml(nombre)}" title="Remover Tutoría">
        <i class="fa-solid fa-user-slash"></i>
      </button>
    </td>
  `;

    this._currentItems.set(alumno.id, alumno);
    return row;
  }
}

function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, idx) => val === arr2[idx]);
}
