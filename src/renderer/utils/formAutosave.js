// src/renderer/utils/formAutosave.js

/**
 * Auto-guardado de formularios con restauración confiable
 * Versión corregida: restaura ANTES del reset, dispara eventos, maneja IDs/names
 */
export class FormAutosave {
  constructor(formId, storageKey, options = {}) {
    this.form = document.getElementById(formId);
    this.storageKey = `autosave:${storageKey}`;
    this.debounceMs = options.debounceMs || 2000;
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24h por defecto
    this.timer = null;
    this._restored = false;
    this._fieldMap = options.fieldMap || {}; // Mapeo opcional: { storageKey: fieldId }
    
    if (!this.form) {
      console.warn(`[FormAutosave] Formulario "${formId}" no encontrado`);
      return;
    }
    
    // ✅ Restaurar PRIMERO (antes de cualquier reset o evento)
    this._restore();
    
    // Escuchar cambios para auto-guardar
    this.form.addEventListener('input', (e) => this._debounceSave(), { passive: true });
    this.form.addEventListener('change', (e) => this._debounceSave(), { passive: true });
  }
  
  _debounceSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this._save(), this.debounceMs);
  }
  
  _save() {
    if (!this.form) return;
    
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData.entries());
    data._savedAt = new Date().toISOString();
    data._formId = this.form.id;
    
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log(`💾 [FormAutosave] Guardado: ${this.storageKey}`);
    } catch (e) {
      console.warn('[FormAutosave] Error guardando:', e);
      // Si localStorage está lleno, limpiar entradas antiguas
      if (e.name === 'QuotaExceededError') {
        this._cleanupOldSaves();
        // Reintentar una vez
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e2) {
          console.error('[FormAutosave] No se pudo guardar tras cleanup:', e2);
        }
      }
    }
  }
  
  _restore() {
    if (this._restored || !this.form) return;
    this._restored = true;
    
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) return;
    
    try {
      const data = JSON.parse(saved);
      
      // Validar antigüedad
      if (data._savedAt) {
        const age = Date.now() - new Date(data._savedAt).getTime();
        if (age > this.maxAge) {
          console.log(`🗑️ [FormAutosave] Datos antiguos (${Math.round(age/3600000)}h), ignorando`);
          return;
        }
      }
      
      // ✅ Restaurar campos con lógica robusta
      let restoredCount = 0;
      
      Object.keys(data).forEach(key => {
        if (key.startsWith('_')) return; // Ignorar metadatos
        
        const value = data[key];
        // 1. Buscar por mapeo explícito si existe
        const fieldId = this._fieldMap[key] || key;
        let field = document.getElementById(fieldId);
        
        // 2. Si no, buscar por name attribute
        if (!field) {
          field = this.form.querySelector(`[name="${key}"]`);
        }
        
        // 3. Si aún no, intentar por key directa como ID
        if (!field) {
          field = document.getElementById(key);
        }
        
        if (field && field.value !== value) {
          field.value = value;
          
          // ✅ Disparar eventos para que otros listeners se actualicen
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          
          restoredCount++;
        }
      });
      
      if (restoredCount > 0) {
        console.log(`♻️ [FormAutosave] Restaurados ${restoredCount} campos: ${this.storageKey}`);
        // Feedback visual opcional
        this.form.classList.add('form-restored');
        setTimeout(() => this.form.classList.remove('form-restored'), 3000);
      }
    } catch (e) {
      console.warn('[FormAutosave] Error restaurando:', e);
      // No fallar silenciosamente: limpiar dato corrupto
      localStorage.removeItem(this.storageKey);
    }
  }
  
  // Limpia autosaves antiguos para evitar QuotaExceededError
  _cleanupOldSaves() {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('autosave:')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data._savedAt && (now - new Date(data._savedAt).getTime() > maxAge)) {
            localStorage.removeItem(key);
            console.log(`🗑️ [FormAutosave] Limpieza: ${key}`);
          }
        } catch (e) {
          // Si no se puede parsear, eliminar de todas formas
          localStorage.removeItem(key);
        }
      }
    }
  }
  
  // Limpia este autosave específico
  clear() {
    localStorage.removeItem(this.storageKey);
    console.log(`🧹 [FormAutosave] Limpiado: ${this.storageKey}`);
  }
  
  // Getter para saber si hay datos guardados
  get hasSavedData() {
    return !!localStorage.getItem(this.storageKey);
  }
  
  // Método para forzar guardado inmediato (útil antes de navegar)
  saveNow() {
    clearTimeout(this.timer);
    this._save();
  }
}