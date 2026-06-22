import { DOMHelpers } from '../../utils/DOMHelpers.js';

export class EEListRenderer {
  constructor({ api, toast, confirm, modalInstance }) {
    this.api = api;
    this.toast = toast;
    this.confirm = confirm;
    this.modalInstance = modalInstance;
    this.helpers = new DOMHelpers();
  }

  async render(docenteId, periodId) {
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
      res.data.forEach((ee) => fragment.appendChild(this._createItem(ee, docenteId, periodId)));
      container.innerHTML = '';
      container.appendChild(fragment);
    } catch (error) {
      console.error(`❌ [EEListRenderer] Error:`, error);
      container.innerHTML = this.helpers.errorTemplate(error.message);
    }
  }

  _createItem(ee, docenteId, periodId) {
    const item = document.createElement('div');
    item.className = 'ee-assigned-item';
    item.style.cssText = "display:flex; flex-direction:column; gap:0.75rem; background:var(--bg-white); padding:1rem; border-radius:8px; border:1px solid var(--border-color); margin-bottom:0.5rem;";
    
    item.innerHTML = `
      <div>
        <strong style="color: var(--text-dark); display: block; margin-bottom: 0.25rem;">${this.helpers.escapeHtml(ee.nombre)}</strong>
        <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-muted);">
          <span><i class="fa-solid fa-key"></i> ${this.helpers.escapeHtml(ee.clave_ee)}</span>
          <span><i class="fa-regular fa-clock"></i> ${ee.carga_horaria || 0} hrs/sem</span>
        </div>
      </div>
      <button class="btn-action-remove-ee" 
              data-action="remove-ee" 
              data-ee-id="${ee.id}" 
              data-ee-name="${this.helpers.escapeHtml(ee.nombre)}" 
              style="width: 100%;">
        <i class="fa-solid fa-trash"></i> Desasignar Materia
      </button>
    `;

    const btn = item.querySelector('.btn-action-remove-ee');
    btn.onclick = async (e) => {
      e.stopPropagation();
      await this._handleRemove(ee, docenteId, periodId, btn);
    };
    item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.1)';
    item.onmouseleave = () => item.style.background = 'var(--bg-white)';
    return item;
  }

  async _handleRemove(ee, docenteId, periodId, btn) {
    const originalState = { html: btn.innerHTML, disabled: btn.disabled };
    try {
      const confirmed = await this.confirm.ask(
        `¿Desasignar "${ee.nombre}"?`,
        `¿Estás seguro de remover <strong>"${this.helpers.escapeHtml(ee.nombre)}"</strong>?`
      );
      if (!confirmed) return;

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';

      const res = await this.api.removerDocenteEE({ docenteId, eeId: ee.id, periodoId: periodId });
      if (!res?.success) throw new Error(res?.error || 'El backend rechazó la operación');

      this.toast.success('EE desasignada correctamente', 4000);
      
      if (this.modalInstance?._refreshAll) {
        await this.modalInstance._refreshAll('ee_asignadas');
      }
    } catch (error) {
      console.error('❌ Error al desasignar:', error);
      this.toast.error(`No se pudo desasignar: ${error.message}`, 8000);
    } finally {
      if (btn) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }
}