// src/renderer/components/modals/AssignmentModal/relations/ee/EEListRenderer.js

import { BaseRelationRenderer } from '../BaseRelationRenderer.js';

export class EEListRenderer extends BaseRelationRenderer {
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
      const res = await this.api.listarEEDisponibles({ 
        periodoId: this._periodId, 
        excludeAsignadasA: entityId 
      });
      
      const items = res?.success ? res.data : [];
      
      if (items.length === 0) {
        select.innerHTML = '<option value="" disabled>Todas las EE asignadas</option>';
      } else {
        select.innerHTML = '<option value="">Seleccionar materia...</option>' +
          items.map(ee => `<option value="${ee.id}">${this.helpers.escapeHtml(ee.nombre)} (${this.helpers.escapeHtml(ee.clave_ee)})</option>`).join('');
      }
      
      select.disabled = items.length === 0;
    } catch (error) {
      console.error('Error cargando EE disponibles:', error);
      select.innerHTML = '<option value="" disabled>Error al cargar</option>';
      select.disabled = true;
    }
  }

  async renderList() {
    if (!this._cardRefs?.listContainer || !this._context || !this._periodId) return;

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context;

    listContainer.innerHTML = this.helpers.loadingTemplate('Cargando asignaciones...');

    try {
      const res = await this.api.obtenerEEDelDocente({ 
        docenteId: entityId, 
        periodoId: this._periodId 
      });
      
      if (!res?.success) throw new Error(res?.error || 'Respuesta inválida');
      
      const items = res.data || [];
      
      if (items.length === 0) {
        listContainer.innerHTML = this.helpers.emptyTemplate('Ninguna EE asignada');
        return;
      }

      const fragment = document.createDocumentFragment();
      items.forEach(ee => fragment.appendChild(this._createItem(ee)));
      
      listContainer.innerHTML = '';
      listContainer.appendChild(fragment);
    } catch (error) {
      console.error('Error cargando EE asignadas:', error);
      listContainer.innerHTML = this.helpers.errorTemplate(error.message);
    }
  }

  async refreshCounter() {
    if (!this._cardRefs?.counter || !this._context || !this._periodId) return;

    const { counter } = this._cardRefs;
    const { entityId } = this._context;

    try {
      const res = await this.api.obtenerEEDelDocente({ 
        docenteId: entityId, 
        periodoId: this._periodId 
      });
      
      const count = res?.data?.length || 0;
      counter.textContent = count;
    } catch (error) {
      console.error('Error actualizando contador EE:', error);
      counter.textContent = '0';
    }
  }

  async assign() {
    if (!this._cardRefs?.select || !this._cardRefs?.assignButton) return;

    const { select, assignButton, listContainer, counter } = this._cardRefs;
    const { entityId } = this._context;
    const eeId = select.value;

    if (!eeId) {
      this.toast.warning('Seleccione una materia');
      return;
    }

    const existingItem = listContainer.querySelector('.assigned-item');
    if (existingItem) {
      const currentName = existingItem.querySelector('strong')?.textContent;
      const newName = select.options[select.selectedIndex]?.text;
      
      const confirmed = await this.confirm.ask(
        '¿Reemplazar Experiencia Educativa?',
        `Actualmente tienes <strong>"${this.helpers.escapeHtml(currentName)}"</strong>.<br>¿Reemplazar por <strong>"${this.helpers.escapeHtml(newName)}"</strong>?`
      );
      
      if (!confirmed) return;
      
      const removeBtn = existingItem.querySelector('button[data-id]');
      const currentId = removeBtn?.dataset?.id;
      
      if (currentId) {
        try {
          await this.api.removerDocenteEE({ 
            docenteId: entityId, 
            eeId: currentId, 
            periodoId: this._periodId 
          });
        } catch (error) {
          this.toast.error('Error al desasignar EE actual');
          return;
        }
      }
    }

    assignButton.disabled = true;
    assignButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Asignando...';

    try {
      const res = await this.api.asignarEEAdocente({ 
        docenteId: entityId, 
        eeId: eeId, 
        periodoId: this._periodId, 
        cargaHoraria: 0 
      });
      
      if (res?.success) {
        this.toast.success('EE asignada correctamente');
        await this.refresh();
      } else {
        this.toast.error(res?.error || 'Error al asignar');
      }
    } catch (error) {
      console.error('Error asignando EE:', error);
      this.toast.error(`Error: ${error.message}`);
    } finally {
      assignButton.disabled = false;
      assignButton.innerHTML = '<i class="fa-solid fa-plus"></i> Asignar';
    }
  }

  async remove(eeId, eeName) {
    if (!this._cardRefs) return;

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context;

    const confirmed = await this.confirm.ask(
      `¿Desasignar "${eeName}"?`,
      `¿Estás seguro de remover <strong>"${this.helpers.escapeHtml(eeName)}"</strong>?`
    );

    if (!confirmed) return;

    const btn = listContainer.querySelector(`button[data-id="${eeId}"]`);
    const originalState = btn ? { html: btn.innerHTML, disabled: btn.disabled } : null;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';
    }

    try {
      const res = await this.api.removerDocenteEE({ 
        docenteId: entityId, 
        eeId: eeId, 
        periodoId: this._periodId 
      });
      
      if (!res?.success) throw new Error(res?.error || 'Error al desasignar');

      this.toast.success('EE desasignada correctamente');
      await this.refresh();
    } catch (error) {
      console.error('Error desasignando EE:', error);
      this.toast.error(`No se pudo desasignar: ${error.message}`);
      
      if (btn && originalState) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }

  _createItem(ee) {
    const item = document.createElement('div');
    item.className = 'assigned-item';
    
    item.innerHTML = `
      <div class="item-content">
        <strong>${this.helpers.escapeHtml(ee.nombre)}</strong>
        <div class="item-meta">
          <span><i class="fa-solid fa-key"></i> ${this.helpers.escapeHtml(ee.clave_ee)}</span>
          <span><i class="fa-regular fa-clock"></i> ${ee.carga_horaria || 0} hrs/sem</span>
        </div>
      </div>
      <button class="btn-outline-danger" data-id="${ee.id}" data-name="${this.helpers.escapeHtml(ee.nombre)}">
        <i class="fa-solid fa-trash"></i> Desasignar Materia
      </button>
    `;

    return item;
  }
}