// Detecta cambios en formularios y muestra advertencia al cerrar
export class UnsavedChangesGuard {
  constructor(formSelector, message = 'Tienes cambios sin guardar. ¿Deseas salir sin guardar?') {
    this.form = document.querySelector(formSelector);
    this.message = message;
    this.initialState = null;
    this.isDirty = false;
    
    if (!this.form) return;
    
    // Capturar estado inicial
    this.captureInitialState();
    
    // Escuchar cambios
    this.form.addEventListener('input', () => this.markDirty());
    this.form.addEventListener('change', () => this.markDirty());
    
    // Escuchar guardado exitoso para limpiar
    this.form.addEventListener('form-saved', () => this.clean());
    
    // Prevenir cierre de modal con cambios
    this.setupModalGuard();
    
    // Prevenir cierre de pestaña/navegador (opcional)
    window.addEventListener('beforeunload', (e) => {
      if (this.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }
  
  captureInitialState() {
    const formData = new FormData(this.form);
    this.initialState = new URLSearchParams(formData).toString();
    this.isDirty = false;
  }
  
  markDirty() {
    this.isDirty = true;
    // Feedback visual opcional
    this.form.classList.add('form-dirty');
  }
  
  clean() {
    this.isDirty = false;
    this.form.classList.remove('form-dirty');
    this.captureInitialState();
  }
  
  setupModalGuard() {
    const modal = this.form.closest('.modal-overlay');
    if (!modal) return;
    
    // Escuchar clic en botón cancelar o cerrar
    modal.addEventListener('click', (e) => {
      if (e.target === modal || 
          e.target.closest('.btn-close') || 
          e.target.closest('.btn-cancel')) {
        if (this.isDirty && !confirm(this.message)) {
          e.preventDefault();
          e.stopPropagation();
        } else {
          this.clean(); // Limpiar si el usuario confirma salir
        }
      }
    });
  }
  
  // Método para llamar manualmente antes de cerrar
  confirmExit(callback) {
    if (this.isDirty && !confirm(this.message)) {
      return false;
    }
    this.clean();
    callback?.();
    return true;
  }
}