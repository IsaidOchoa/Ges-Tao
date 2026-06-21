// src/renderer/utils/assignment-modal/relations/ee/EEListRenderer.js
import { DOMHelpers } from '../../utils/DOMHelpers.js';

/**
 * Renderiza y gestiona la lista de Experiencias Educativas asignadas
 */
export class EEListRenderer {
  constructor({ api, toast, confirm }) {
    this.api = api;
    this.toast = toast;
    this.confirm = confirm;
    this.helpers = new DOMHelpers();
  }

  /**
   * Renderiza la lista de EE asignadas
   */
  async render(docenteId, periodId, onRefresh) {
    const container = document.getElementById(`assigned-ee-list-${docenteId}`);
    if (!container) return;

    container.innerHTML = this.helpers.loadingTemplate('Cargando asignaciones...');

    try {
      const res = await this.api.obtenerEEDelDocente({ docenteId, periodoId: periodId });
      
      if (!res?.success) throw new Error(res?.error || 'Respuesta inválida');
      if (!res.data?.length) {
        container.innerHTML = this.helpers.emptyTemplate('Ninguna EE asignada en este periodo');
        return;
      }

      const fragment = document.createDocumentFragment();
      res.data.forEach(ee => {
        const item = this._createItemElement(ee, docenteId, periodId, onRefresh);
        fragment.appendChild(item);
      });
      
      container.innerHTML = '';
      container.appendChild(fragment);
      
    } catch (error) {
      console.error(`❌ [EEListRenderer] Error:`, error);
      container.innerHTML = this.helpers.errorTemplate(error.message);
    }
  }

  /**
   * Crea elemento de lista con estructura vertical
   */
  _createItemElement(ee, docenteId, periodId, onRefresh) {
    const item = this.helpers.createElement('div', 'ee-assigned-item', {
      'eeId': ee.id,
      'eeName': ee.nombre
    });
    
    item.innerHTML = `
      <div class="ee-info-header">
        <strong class="ee-name" style="color: var(--text-dark); display: block; margin-bottom: 0.25rem;">
          ${this.helpers.escapeHtml(ee.nombre)}
        </strong>
        <div class="ee-meta-tags" style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-muted);">
          <span><i class="fa-solid fa-key"></i> ${this.helpers.escapeHtml(ee.clave_ee)}</span>
          <span><i class="fa-regular fa-clock"></i> ${ee.carga_horaria || 0} hrs/sem</span>
        </div>
      </div>
      <button class="btn-action-remove-ee" style="width: 100%; margin-top: 0.75rem;">
        <i class="fa-solid fa-trash"></i> Desasignar Materia
      </button>
    `;

    const btnRemove = item.querySelector('.btn-action-remove-ee');
    btnRemove.onclick = async (e) => {
      e.stopPropagation();
      await this._handleRemove(ee, docenteId, periodId, onRefresh, btnRemove);
    };

    // Hover effects
    item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.1)';
    item.onmouseleave = () => item.style.background = 'var(--bg-white)';

    return item;
  }

  /**
   * Maneja la desasignación con confirmación
   */
  async _handleRemove(ee, docenteId, periodId, onRefresh, btnElement) {
    const originalState = { html: btnElement.innerHTML, disabled: btnElement.disabled };
    
    try {
      const confirmed = await this.confirm.ask(
        `¿Desasignar "${ee.nombre}"?`,
        `¿Estás seguro de remover <strong>"${this.helpers.escapeHtml(ee.nombre)}"</strong>?`
      );
      
      if (!confirmed) return;

      btnElement.disabled = true;
      btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';

      const res = await this.api.removerDocenteEE({ 
        docenteId, 
        eeId: ee.id, 
        periodoId: periodId 
      });
      
      if (!res?.success) throw new Error(res?.error);

      this.toast.success('EE desasignada correctamente', 4000);
      await onRefresh?.();

    } catch (error) {
      console.error('❌ Error al desasignar:', error);
      this.toast.error(`No se pudo desasignar: ${error.message}`, 8000);
    } finally {
      if (btnElement) {
        btnElement.disabled = originalState.disabled;
        btnElement.innerHTML = originalState.html;
      }
    }
  }
}