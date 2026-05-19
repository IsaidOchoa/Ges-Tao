// src/renderer/utils/confirmationModal.js
export class ConfirmationModal {
  constructor() {
    this.modal = null;
    this._resolve = null;
    this._reject = null;
    this._timeoutId = null;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return true;
    
    try {
      // Si ya existe, usarlo
      this.modal = document.getElementById('modal-confirmacion');
      if (this.modal) {
        this._bindEvents();
        this._initialized = true;
        return true;
      }
      
      // Inyectar HTML con z-index alto para asegurar visibilidad
      const html = `
        <div id="modal-confirmacion" class="modal-overlay hidden" style="z-index:10000; position:fixed; top:0; left:0; width:100%; height:100%;">
          <div class="modal-content modal-sm" style="max-width:400px; margin:20vh auto;">
            <div class="modal-header">
              <h3>Confirmación</h3>
              <button class="btn-close" id="btn-cerrar-confirmacion" type="button" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            <div class="modal-body">
              <p id="confirmacion-mensaje" style="margin:20px 0; text-align:center; font-size:1.05rem; color:var(--text-dark);"></p>
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
      console.log('✅ [ConfirmationModal] Inicializado correctamente');
      return true;
    } catch (e) {
      console.error('❌ [ConfirmationModal] Error en init():', e);
      return false;
    }
  }

  _bindEvents() {
    if (!this.modal) return;
    
    const close = (result) => {
      // Limpiar timeout de seguridad
      if (this._timeoutId) {
        clearTimeout(this._timeoutId);
        this._timeoutId = null;
      }
      
      // Ocultar modal
      if (this.modal) {
        this.modal.classList.add('hidden');
      }
      
      // Resolver promise
      if (this._resolve) {
        this._resolve(result);
        this._resolve = null;
      }
      if (this._reject) {
        this._reject = null;
      }
    };

    // Botones
    const btnAceptar = document.getElementById('btn-confirmacion-aceptar');
    const btnCancelar = document.getElementById('btn-confirmacion-cancelar');
    const btnCerrar = document.getElementById('btn-cerrar-confirmacion');
    
    if (btnAceptar) btnAceptar.onclick = () => close(true);
    if (btnCancelar) btnCancelar.onclick = () => close(false);
    if (btnCerrar) btnCerrar.onclick = () => close(false);
    
    // Click en overlay
    this.modal.onclick = (e) => {
      if (e.target === this.modal) close(false);
    };
    
    // Tecla Escape
    const escHandler = (e) => {
      if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
        close(false);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  ask(message, timeout = 15000) {
    return new Promise((resolve, reject) => {
      // Inicializar si no se ha hecho
      if (!this._initialized) {
        const ok = this.init();
        if (!ok) {
          console.warn('⚠️ [ConfirmationModal] No se pudo inicializar, asumiendo "Aceptar"');
          resolve(true);
          return;
        }
      }
      
      // Si aún no hay modal, resolver inmediatamente
      if (!this.modal) {
        console.warn('⚠️ [ConfirmationModal] Modal no disponible, asumiendo "Aceptar"');
        resolve(true);
        return;
      }
      
      // Guardar callbacks
      this._resolve = resolve;
      this._reject = reject;
      
      // Configurar mensaje
      const msgEl = document.getElementById('confirmacion-mensaje');
      if (msgEl) msgEl.textContent = message || '¿Estás seguro?';
      
      // Mostrar modal
      this.modal.classList.remove('hidden');
      
      // Timeout de seguridad: nunca bloquear más de X ms
      this._timeoutId = setTimeout(() => {
        console.warn('⚠️ [ConfirmationModal] Timeout de seguridad, resolviendo como "Aceptar"');
        if (this._resolve) {
          this._resolve(true);
          this._resolve = null;
          this._reject = null;
        }
        if (this.modal) this.modal.classList.add('hidden');
      }, timeout);
      
      // Enfocar botón cancelar para accesibilidad
      setTimeout(() => {
        document.getElementById('btn-confirmacion-cancelar')?.focus();
      }, 50);
    });
  }
  
  // Método de emergencia para forzar cierre
  forceClose(result = false) {
    if (this._timeoutId) clearTimeout(this._timeoutId);
    if (this.modal) this.modal.classList.add('hidden');
    if (this._resolve) {
      this._resolve(result);
      this._resolve = null;
      this._reject = null;
    }
  }
}

export const globalConfirm = new ConfirmationModal();