import { DOMHelpers } from '../../utils/DOMHelpers.js';

export class TutoradoListRenderer {
  constructor({ api, toast, confirm, modalInstance }) {
    this.api = api;
    this.toast = toast;
    this.confirm = confirm;
    this.modalInstance = modalInstance; // 🔹 Referencia directa
    this.helpers = new DOMHelpers();
  }

  async render(docenteId, periodId) {
    const container = document.getElementById(`assigned-tutorados-list-${docenteId}`);
    if (!container) return;

    container.innerHTML = this.helpers.loadingTemplate('Cargando tutorados...');
    try {
      const res = await this.api.obtenerTutorados({ docenteId, periodoId: periodId });
      if (!res?.success) throw new Error(res?.error || 'Respuesta inválida');
      if (!res.data?.length) {
        container.innerHTML = this.helpers.emptyTemplate('Ningún alumno tutorado');
        return;
      }
      const fragment = document.createDocumentFragment();
      res.data.forEach((al) => fragment.appendChild(this._createItem(al, docenteId, periodId)));
      container.innerHTML = '';
      container.appendChild(fragment);
    } catch (error) {
      container.innerHTML = this.helpers.errorTemplate(error.message);
    }
  }

  _createItem(alumno, docenteId, periodId) {
    const item = document.createElement('div');
    item.className = 'tutorado-assigned-item';
    item.style.cssText = "display:flex; flex-direction:column; gap:0.75rem; background:var(--bg-white); padding:1rem; border-radius:8px; border:1px solid var(--border-color); margin-bottom:0.5rem;";
    const nombre = alumno.nombre_completo || `${alumno.nombres} ${alumno.apellido_paterno}`;
    
    item.innerHTML = `
      <div>
        <strong style="color: var(--text-dark); display: block; margin-bottom: 0.25rem;">${this.helpers.escapeHtml(nombre)}</strong>
        <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-muted);">
          <span><i class="fa-solid fa-id-card"></i> ${this.helpers.escapeHtml(alumno.matricula)}</span>
          ${alumno.programa_academico ? `<span><i class="fa-solid fa-graduation-cap"></i> ${this.helpers.escapeHtml(alumno.programa_academico)}</span>` : ''}
        </div>
      </div>
      <button class="btn-action-remove-tutorado" style="width: 100%;"><i class="fa-solid fa-user-slash"></i> Remover Tutoría</button>
    `;

    const btn = item.querySelector('.btn-action-remove-tutorado');
    btn.onclick = async (e) => {
      e.stopPropagation();
      await this._handleRemove(alumno, docenteId, periodId, btn);
    };
    item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.1)';
    item.onmouseleave = () => item.style.background = 'var(--bg-white)';
    return item;
  }

  async _handleRemove(alumno, docenteId, periodId, btn) {
    const originalState = { html: btn.innerHTML, disabled: btn.disabled };
    const nombre = alumno.nombre_completo || alumno.nombres;
    try {
      const confirmed = await this.confirm.ask(
        `¿Remover tutoría?`,
        `¿Quitar tutoría de <strong>"${this.helpers.escapeHtml(nombre)}"</strong>?`
      );
      if (!confirmed) return;

      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';

      const res = await this.api.removerTutor({ docenteId, alumnoId: alumno.id, periodoId: periodId });
      if (!res?.success) throw new Error(res?.error);

      this.toast.success('Tutoría removida correctamente', 4000);
      
      // 🔹 LLAMADA DIRECTA - MISMA FUNCIÓN que usa el botón de asignar
      if (this.modalInstance?._refreshAll) {
        console.log('🔹 [DEBUG] Ejecutando this.modalInstance._refreshAll() desde TutoradoListRenderer');
        await this.modalInstance._refreshAll('tutorados');
      }

    } catch (error) {
      console.error('❌ Error al remover tutorado:', error);
      this.toast.error(`No se pudo remover: ${error.message}`, 8000);
    } finally {
      if (btn) {
        btn.disabled = originalState.disabled;
        btn.innerHTML = originalState.html;
      }
    }
  }
}