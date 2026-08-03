// src/renderer/components/modals/AssignmentModal/relations/docente/DocenteRenderer.js

import { BaseRelationRenderer } from '../BaseRelationRenderer.js';

export class DocenteRenderer extends BaseRelationRenderer {
  constructor({ api, toast, confirm, stateManager, uiLoader }) {
    super({ api, toast, confirm, stateManager, moduleName: 'docente_asignado', uiLoader });
  }

  async loadSelect() {
    if (!this._cardRefs?.select || !this._context || !this._periodId) return;

    const { select, assignButton } = this._cardRefs;

    select.disabled = true;
    select.innerHTML = '<option value="">Cargando...</option>';
    if (assignButton) assignButton.disabled = true;

    try {
      const res = await this.api.listarDocentesDisponibles({ 
        periodoId: this._periodId 
      });
      
      const items = res?.success ? res.data : [];
      
      if (items.length === 0) {
        select.innerHTML = '<option value="" disabled>No hay docentes disponibles</option>';
      } else {
        select.innerHTML = '<option value="">Seleccionar docente...</option>' +
          items.map(doc => {
            const nombre = `${doc.tratamiento || ''} ${doc.apellido_paterno || ''} ${doc.apellido_materno || ''} ${doc.nombres || ''}`.trim();
            return `<option value="${doc.id}">${this.helpers.escapeHtml(nombre)} (${this.helpers.escapeHtml(doc.codigo)})</option>`;
          }).join('');
      }
      
      select.disabled = items.length === 0;
      if (assignButton) assignButton.disabled = items.length === 0;
    } catch (error) {
      console.error('Error cargando docentes disponibles:', error);
      select.innerHTML = '<option value="" disabled>Error al cargar</option>';
      select.disabled = true;
    }
  }

  async renderList() {
    if (!this._cardRefs?.listContainer || !this._context || !this._periodId) return;

    const { listContainer } = this._cardRefs;
    const { entityId } = this._context; // entityId aquí es el eeId

    this._showLoading();

    try {
      const res = await this.api.obtenerDocenteDeEE({ 
        eeId: entityId, 
        periodoId: this._periodId 
      });
      
      if (!res?.success) throw new Error(res?.error || 'Respuesta inválida');
      
      const newItems = res.data || [];
      const newIds = newItems.map(item => item.id);
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
            <td colspan="${this._getColumnCount()}">Sin docente asignado</td>
          </tr>
        `;
        return;
      }

      const fragment = document.createDocumentFragment();
      newItems.forEach(doc => {
        const item = this._createItem(doc);
        fragment.appendChild(item);
      });
      listContainer.appendChild(fragment);
      
    } catch (error) {
      this._hideLoading();
      console.error('Error cargando docente asignado:', error);
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
    const docenteId = select.value;

    if (!docenteId) {
      this.toast.warning('Seleccione un docente');
      return;
    }

    const { entityId } = this._context; // eeId

    assignButton.disabled = true;
    assignButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Asignando...';

    try {
      const res = await this.api.asignarEEAdocente({ 
        docenteId: docenteId, 
        eeId: entityId, 
        periodoId: this._periodId 
      });
      
      if (res?.success) {
        this.toast.success('Docente asignado correctamente');
        
        const selectedOption = select.options[select.selectedIndex];
        const nombreCompleto = selectedOption.text.split('(')[0].trim();
        const codigo = selectedOption.text.match(/\(([^)]+)\)/)?.[1] || '';

        const newItem = {
          id: docenteId,
          nombre_completo: nombreCompleto,
          codigo: codigo,
          correo: '',
          carga_horaria: 0
        };
        
        await this._addItemToList(newItem);
        await this.refreshCounter();
        await this.loadSelect();
        
        this.stateManager.invalidateModules(['docente_asignado', 'counters', 'sidebar']);
      } else {
        this.toast.error(res?.error || 'Error al asignar');
      }
    } catch (error) {
      console.error('Error asignando docente:', error);
      this.toast.error(`Error: ${error.message}`);
    } finally {
      assignButton.disabled = false;
      assignButton.innerHTML = '<i class="fa-solid fa-plus"></i> Asignar';
    }
  }

  async remove(docenteId, docenteName) {
    if (!this._cardRefs) return;

    const confirmed = await this.confirm.ask(
      `¿Desasignar docente?`,
      `¿Quitar al docente <strong>"${this.helpers.escapeHtml(docenteName)}"</strong> de esta Experiencia Educativa?`
    );

    if (!confirmed) return;

    const btn = this._cardRefs.listContainer.querySelector(`button[data-id="${docenteId}"]`);
    const originalState = btn ? { html: btn.innerHTML, disabled: btn.disabled } : null;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';
    }

    try {
      const { entityId } = this._context; // eeId
      
      const res = await this.api.removerDocenteEE({ 
        docenteId: docenteId, 
        eeId: entityId, 
        periodoId: this._periodId 
      });

      if (!res?.success) throw new Error(res?.error || 'Error al desasignar');

      this.toast.success('Docente desasignado correctamente');
      
      this._removeItemFromList(docenteId);
      await this.refreshCounter();
      await this.loadSelect();
      
      this.stateManager.invalidateModules(['docente_asignado', 'counters', 'sidebar']);
      
    } catch (error) {
      console.error('Error desasignando docente:', error);
      this.toast.error(`No se pudo desasignar: ${error.message}`);
      
      if (btn && originalState) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }

  _createItem(doc) {
    const row = document.createElement('tr');
    row.className = 'table-row';
    row.dataset.id = doc.id;
    
    const nombre = doc.nombre_completo || `${doc.tratamiento || ''} ${doc.apellido_paterno || ''} ${doc.nombres || ''}`.trim() || 'Sin nombre';
    const codigo = doc.codigo || '-';
    const correo = doc.correo || '-';
    const carga = doc.carga_horaria ?? doc.num_alumnos ?? 0;

    row.innerHTML = `
      <td class="col-nombre">
        <strong>${this.helpers.escapeHtml(nombre)}</strong>
      </td>
      <td class="col-codigo">
        <span class="badge-clave">${this.helpers.escapeHtml(codigo)}</span>
      </td>
      <td class="col-correo">
        <span>${this.helpers.escapeHtml(correo)}</span>
      </td>
      <td class="col-carga">
        <span class="editable-relation-value" data-id="${doc.id}" data-field="carga" title="Editar carga horaria / alumnos inscritos" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-pen-to-square" style="font-size: 0.75rem; opacity: 0.6;"></i>
          ${carga}
        </span>
      </td>
      <td class="col-actions">
        <button class="btn-remove-row" data-id="${doc.id}" data-name="${this.helpers.escapeHtml(nombre)}" title="Desasignar Docente">
          <i class="fa-solid fa-user-slash"></i>
        </button>
      </td>
    `;

    this._currentItems.set(doc.id, doc);
    return row;
  }

  bindEvents() {
    super.bindEvents();
    
    if (!this._cardRefs?.listContainer) return;

    this._cardRefs.listContainer.addEventListener('click', (e) => {
      const editableSpan = e.target.closest('.editable-relation-value');
      if (editableSpan) {
        const docenteId = editableSpan.dataset.id;
        const docData = this._currentItems.get(docenteId);
        if (docData) {
          this._editRelationValue(docenteId, docData);
        }
      }
    });
  }

  async _editRelationValue(docenteId, docData) {
    const currentVal = docData.carga_horaria ?? docData.num_alumnos ?? 0;
    
    const newValStr = prompt(
      `Editar carga horaria o número de alumnos inscritos en esta Experiencia Educativa:`, 
      currentVal
    );
    
    if (newValStr === null) return;
    
    const newVal = parseInt(newValStr, 10);
    if (isNaN(newVal) || newVal < 0) {
      this.toast.error('Por favor, ingrese un número válido mayor o igual a 0');
      return;
    }

    try {
      const { entityId } = this._context; // eeId
      
      const res = await this.api.actualizarRelacionDocenteEE({
        docenteId: docenteId,
        eeId: entityId,
        periodoId: this._periodId,
        carga_horaria: newVal
      });

      if (res?.success) {
        this.toast.success('Detalles del grupo actualizados correctamente');
        
        docData.carga_horaria = newVal;
        this._currentItems.set(docenteId, docData);
        
        const row = this._cardRefs.listContainer.querySelector(`tr[data-id="${docenteId}"]`);
        if (row) {
          const cargaCell = row.querySelector('.col-carga .editable-relation-value');
          if (cargaCell) {
            cargaCell.innerHTML = `<i class="fa-solid fa-pen-to-square" style="font-size: 0.75rem; opacity: 0.6;"></i> ${newVal}`;
          }
        }
      } else {
        this.toast.error(res?.error || 'Error al actualizar la relación');
      }
    } catch (error) {
      console.error('Error actualizando relación:', error);
      this.toast.error(`Error: ${error.message}`);
    }
  }
}