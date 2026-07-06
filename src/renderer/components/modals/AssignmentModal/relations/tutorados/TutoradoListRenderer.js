// src/renderer/components/modals/AssignmentModal/relations/tutorados/TutoradoListRenderer.js

import { BaseRelationRenderer } from '../BaseRelationRenderer.js';

export class TutoradoListRenderer extends BaseRelationRenderer {
  constructor({ api, toast, confirm }) {
    super({ api, toast, confirm });
  }

  async loadSelect() {
    if (!this._cardRefs?.select || !this._context || !this._periodId) return;

    const { select } = this._cardRefs;
    const { entityId } = this._context;

    select.disabled = true;
    select.innerHTML = '<option value="">Cargando...</option>';

    try {
      const res = await this.api.listarAlumnosDisponibles({ 
        periodoId: this._periodId, 
        excludeDocenteId: entityId 
      });
      
      const items = res?.success ? res.data : [];
      
      if (items.length === 0) {
        select.innerHTML = '<option value="" disabled>Todos los alumnos asignados</option>';
      } else {
        select.innerHTML = '<option value="">Seleccionar alumno...</option>' +
          items.map(al => {
            const nombre = al.nombre_completo || `${al.nombres} ${al.apellido_paterno}`;
            return `<option value="${al.id}">${this.helpers.escapeHtml(nombre)} (${this.helpers.escapeHtml(al.matricula)})</option>`;
          }).join('');
      }
      
      select.disabled = items.length === 0;
    } catch (error) {
      console.error('Error cargando alumnos disponibles:', error);
      select.innerHTML = '<option value="" disabled>Error al cargar</option>';
      select.disabled = true;
    }
  }

  async renderList() {
    if (!this._cardRefs?.listContainer || !this._context || !this._periodId) return;

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context;

    listContainer.innerHTML = this.helpers.loadingTemplate('Cargando tutorados...');

    try {
      const res = await this.api.obtenerTutorados({ 
        docenteId: entityId, 
        periodoId: this._periodId 
      });
      
      if (!res?.success) throw new Error(res?.error || 'Respuesta inválida');
      
      const items = res.data || [];
      
      if (items.length === 0) {
        listContainer.innerHTML = this.helpers.emptyTemplate('Ningún alumno tutorado');
        return;
      }

      const fragment = document.createDocumentFragment();
      items.forEach(al => fragment.appendChild(this._createItem(al)));
      
      listContainer.innerHTML = '';
      listContainer.appendChild(fragment);
    } catch (error) {
      console.error('Error cargando tutorados:', error);
      listContainer.innerHTML = this.helpers.errorTemplate(error.message);
    }
  }

  async refreshCounter() {
    if (!this._cardRefs?.counter || !this._context || !this._periodId) return;

    const { counter } = this._cardRefs;
    const { entityId } = this._context;

    try {
      const res = await this.api.obtenerTutorados({ 
        docenteId: entityId, 
        periodoId: this._periodId 
      });
      
      const count = res?.data?.length || 0;
      counter.textContent = count;
    } catch (error) {
      console.error('Error actualizando contador tutorados:', error);
      counter.textContent = '0';
    }
  }

  async assign() {
    if (!this._cardRefs?.select || !this._cardRefs?.assignButton) return;

    const { select, assignButton } = this._cardRefs;
    const { entityId } = this._context;
    const alumnoId = select.value;

    if (!alumnoId) {
      this.toast.warning('Seleccione un alumno');
      return;
    }

    assignButton.disabled = true;
    assignButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Asignando...';

    try {
      const res = await this.api.asignarTutor({ 
        docenteId: entityId, 
        alumnoId: alumnoId, 
        periodoId: this._periodId 
      });
      
      if (res?.success) {
        this.toast.success('Tutorado asignado correctamente');
        await this.refresh();
      } else {
        this.toast.error(res?.error || 'Error al asignar');
      }
    } catch (error) {
      console.error('Error asignando tutorado:', error);
      this.toast.error(`Error: ${error.message}`);
    } finally {
      assignButton.disabled = false;
      assignButton.innerHTML = '<i class="fa-solid fa-plus"></i> Asignar';
    }
  }

  async remove(alumnoId, alumnoName) {
    if (!this._cardRefs) return;

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context;

    const confirmed = await this.confirm.ask(
      `¿Remover tutoría?`,
      `¿Quitar tutoría de <strong>"${this.helpers.escapeHtml(alumnoName)}"</strong>?`
    );

    if (!confirmed) return;

    const btn = listContainer.querySelector(`button[data-id="${alumnoId}"]`);
    const originalState = btn ? { html: btn.innerHTML, disabled: btn.disabled } : null;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';
    }

    try {
      const res = await this.api.removerTutor({ 
        docenteId: entityId, 
        alumnoId: alumnoId, 
        periodoId: this._periodId 
      });
      
      if (!res?.success) throw new Error(res?.error || 'Error al remover');

      this.toast.success('Tutoría removida correctamente');
      await this.refresh();
    } catch (error) {
      console.error('Error removiendo tutorado:', error);
      this.toast.error(`No se pudo remover: ${error.message}`);
      
      if (btn && originalState) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }

  _createItem(alumno) {
    const item = document.createElement('div');
    item.className = 'assigned-item';
    
    const nombre = alumno.nombre_completo || `${alumno.nombres} ${alumno.apellido_paterno}`;
    
    item.innerHTML = `
      <div class="item-content">
        <strong>${this.helpers.escapeHtml(nombre)}</strong>
        <div class="item-meta">
          <span><i class="fa-solid fa-id-card"></i> ${this.helpers.escapeHtml(alumno.matricula)}</span>
          ${alumno.programa_academico ? `<span><i class="fa-solid fa-graduation-cap"></i> ${this.helpers.escapeHtml(alumno.programa_academico)}</span>` : ''}
        </div>
      </div>
      <button class="btn-outline-danger" data-id="${alumno.id}" data-name="${this.helpers.escapeHtml(nombre)}">
        <i class="fa-solid fa-user-slash"></i> Remover Tutoría
      </button>
    `;

    return item;
  }
}