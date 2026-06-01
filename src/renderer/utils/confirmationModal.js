// src/renderer/utils/confirmationModal.js
export class ConfirmationModal {
  constructor() {
    this.modal = null;
    this._resolve = null;
    this._reject = null;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return true;
    
    try {
      this.modal = document.getElementById('modal-confirmacion');
      if (this.modal) {
        this._bindEvents();
        this._initialized = true;
        return true;
      }
      
      const html = `
        <div id="modal-confirmacion" class="modal-overlay hidden" style="z-index:10000; position:fixed; top:0; left:0; width:100%; height:100%;">
          <div class="modal-content modal-sm" style="max-width:450px; margin:15vh auto;">
            <div class="modal-header">
              <h3 id="confirmacion-titulo">Confirmación</h3>
              <button class="btn-close" id="btn-cerrar-confirmacion" type="button" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body">
              <div id="confirmacion-mensaje" style="margin:20px 0; text-align:left; font-size:0.95rem; color:var(--text-dark); line-height:1.6;"></div>
            </div>
            <div class="modal-footer" style="display:flex; justify-content:center; gap:12px; padding:16px;">
              <button class="btn btn-secondary" id="btn-confirmacion-cancelar" type="button" style="padding:8px 20px; cursor:pointer;">Cancelar</button>
              <button class="btn btn-primary" id="btn-confirmacion-aceptar" type="button" style="padding:8px 20px; cursor:pointer;">Aceptar</button>
            </div>
          </div>
        </div>`;
      
      document.body.insertAdjacentHTML('beforeend', html);
      this.modal = document.getElementById('modal-confirmacion');
      
      if (!this.modal) throw new Error('Modal no se inyectó correctamente');
      
      this._bindEvents();
      this._initialized = true;
      return true;
    } catch (e) {
      console.error('❌ [ConfirmationModal] Error en init():', e);
      return false;
    }
  }

  _bindEvents() {
    if (!this.modal) return;
    
    const close = (result) => {
      if (this.modal) this.modal.classList.add('hidden');
      if (this._resolve) {
        this._resolve(result);
        this._resolve = null;
      }
      if (this._reject) this._reject = null;
    };

    const btnAceptar = document.getElementById('btn-confirmacion-aceptar');
    const btnCancelar = document.getElementById('btn-confirmacion-cancelar');
    const btnCerrar = document.getElementById('btn-cerrar-confirmacion');
    
    if (btnAceptar) btnAceptar.onclick = () => close(true);
    if (btnCancelar) btnCancelar.onclick = () => close(false);
    if (btnCerrar) btnCerrar.onclick = () => close(false);
    
    this.modal.onclick = (e) => {
      if (e.target === this.modal) close(false);
    };
    
    const escHandler = (e) => {
      if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
        close(false);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Muestra un modal de confirmación
   * @param {string} titulo - Título claro y conciso (ej: "¿Desasignar materia?")
   * @param {string} mensaje - Descripción detallada (ej: "¿Estás seguro de desasignar 'Base de Datos' del periodo 2024-A?")
   * @param {object} options - Opciones adicionales
   * @param {string} options.btnAceptar - Texto del botón aceptar (default: "Aceptar")
   * @param {string} options.btnCancelar - Texto del botón cancelar (default: "Cancelar")
   * @returns {Promise<boolean>}
   */
  ask(titulo, mensaje = '', options = {}) {
    return new Promise((resolve, reject) => {
      if (!this._initialized) {
        const ok = this.init();
        if (!ok) {
          console.warn('⚠️ [ConfirmationModal] No se pudo inicializar, asumiendo "Cancelar"');
          resolve(false); // 🔹 Cambiado: mejor asumir "Cancelar" por seguridad
          return;
        }
      }
      
      if (!this.modal) {
        console.warn('⚠️ [ConfirmationModal] Modal no disponible, asumiendo "Cancelar"');
        resolve(false); // 🔹 Cambiado: mejor asumir "Cancelar" por seguridad
        return;
      }
      
      this._resolve = resolve;
      this._reject = reject;
      
      // 🔹 Actualizar título
      const tituloEl = document.getElementById('confirmacion-titulo');
      if (tituloEl) {
        tituloEl.textContent = titulo || '¿Confirmar acción?';
      }
      
      // 🔹 Actualizar mensaje (CORRECCIÓN PRINCIPAL)
      const msgEl = document.getElementById('confirmacion-mensaje');
      if (msgEl) {
        if (mensaje && mensaje.trim() !== '') {
          // Si hay mensaje explícito, usarlo
          msgEl.innerHTML = mensaje;
          msgEl.style.display = 'block';
        } else {
          // 🔹 Si NO hay mensaje, NO duplicar el título
          // En su lugar, mostrar un mensaje genérico o vacío
          msgEl.textContent = '¿Estás seguro de continuar?';
          msgEl.style.display = 'block';
        }
      }
      
      // 🔹 Actualizar textos de botones si se proporcionan
      const btnAceptar = document.getElementById('btn-confirmacion-aceptar');
      const btnCancelar = document.getElementById('btn-confirmacion-cancelar');
      
      if (btnAceptar) btnAceptar.textContent = options.btnAceptar || 'Aceptar';
      if (btnCancelar) btnCancelar.textContent = options.btnCancelar || 'Cancelar';
      
      this.modal.classList.remove('hidden');
      
      setTimeout(() => {
        document.getElementById('btn-confirmacion-cancelar')?.focus();
      }, 50);
    });
  }
  
  /**
   * Método helper para confirmaciones simples (solo título)
   * @param {string} mensaje - Mensaje descriptivo completo
   * @returns {Promise<boolean>}
   */
  askSimple(mensaje) {
    return this.ask('¿Confirmar?', mensaje);
  }
  
  /**
   * Método helper para confirmaciones destructivas
   * @param {string} recurso - Nombre del recurso a eliminar/desasignar
   * @param {string} detalle - Detalles adicionales
   * @returns {Promise<boolean>}
   */
  askDestructive(recurso, detalle = '') {
    const titulo = `¿Eliminar ${recurso}?`;
    const mensaje = detalle 
      ? `Esta acción no se puede deshacer. <strong>${detalle}</strong>`
      : 'Esta acción no se puede deshacer.';
    
    return this.ask(titulo, mensaje, {
      btnAceptar: 'Eliminar',
      btnCancelar: 'Cancelar'
    });
  }
  
  forceClose(result = false) {
    if (this.modal) this.modal.classList.add('hidden');
    if (this._resolve) {
      this._resolve(result);
      this._resolve = null;
      this._reject = null;
    }
  }
}

export const globalConfirm = new ConfirmationModal();