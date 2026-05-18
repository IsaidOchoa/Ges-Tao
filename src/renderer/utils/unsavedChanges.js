// src/renderer/utils/unsavedChanges.js

/**
 * Guard para detectar cambios no guardados en formularios
 * Versión corregida: SIN interceptación de UI, solo detección de estado
 */
export class UnsavedChangesGuard {
  constructor(formSelector, options = {}) {
    this.form = document.querySelector(formSelector);
    this.message = options.message || 'Tienes cambios sin guardar.';
    this.initialState = null;
    this.isDirty = false;
    this._listeners = [];
    this._beforeUnloadHandler = null;
    this._destroyed = false;
    
    if (!this.form) {
      console.warn(`[UnsavedChangesGuard] Form "${formSelector}" not found`);
      return;
    }
    
    this._init();
  }
  
  _init() {
    this._captureState();
    
    // Escuchar cambios
    const handler = () => this._markDirty();
    this.form.addEventListener('input', handler);
    this.form.addEventListener('change', handler);
    this._listeners.push({ el: this.form, type: 'input', handler });
    this._listeners.push({ el: this.form, type: 'change', handler });
    
    // Escuchar guardado exitoso
    const savedHandler = () => this.clean();
    this.form.addEventListener('form-saved', savedHandler);
    this._listeners.push({ el: this.form, type: 'form-saved', handler: savedHandler });
    
    // beforeunload para cierre de pestaña (solo si es necesario)
    this._beforeUnloadHandler = (e) => {
      if (!this._destroyed && this.isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', this._beforeUnloadHandler);
  }
  
  _captureState() {
    try {
      const formData = new FormData(this.form);
      this.initialState = new URLSearchParams(formData).toString();
      this.isDirty = false;
      this.form.classList?.remove('form-dirty');
    } catch (e) {
      console.warn('[UnsavedChangesGuard] Error capturing state:', e);
    }
  }
  
  _markDirty() {
    if (this._destroyed) return;
    this.isDirty = true;
    this.form.classList?.add('form-dirty');
  }
  
  /**
   * Limpia estado y marca como "guardado"
   */
  clean() {
    if (this._destroyed) return;
    this.isDirty = false;
    this.form.classList?.remove('form-dirty');
    this._captureState();
  }
  
  /**
   * Getter para que el módulo consulte el estado
   */
  get hasUnsavedChanges() {
    return !this._destroyed && this.isDirty;
  }
  
  /**
   * Destruye el guard y libera todos los recursos (CRÍTICO)
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    
    // Remover listeners del formulario
    this._listeners.forEach(({ el, type, handler }) => {
      el?.removeEventListener(type, handler);
    });
    this._listeners = [];
    
    // Remover beforeunload
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
    
    // Limpiar referencias
    this.form = null;
    this.initialState = null;
  }
}