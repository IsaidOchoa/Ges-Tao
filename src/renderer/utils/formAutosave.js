// Utilidad global: src/renderer/utils/formAutosave.js
export class FormAutosave {
  constructor(formId, storageKey, debounceMs = 2000) {
    this.form = document.getElementById(formId);
    this.storageKey = `autosave:${storageKey}`;
    this.debounceMs = debounceMs;
    this.timer = null;
    
    if (!this.form) return;
    
    // Restaurar datos guardados al cargar
    this.restore();
    
    // Guardar al cambiar cualquier campo
    this.form.addEventListener('input', (e) => this.debounceSave());
    this.form.addEventListener('change', (e) => this.debounceSave());
  }
  
  debounceSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), this.debounceMs);
  }
  
  save() {
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData.entries());
    data._savedAt = new Date().toISOString();
    localStorage.setItem(this.storageKey, JSON.stringify(data));
    console.log(`Auto-guardado: ${this.storageKey}`);
  }
  
  restore() {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) return;
    
    try {
      const data = JSON.parse(saved);
      const maxAge = 24 * 60 * 60 * 1000; // 24 horas
      
      // Solo restaurar si no es muy antiguo
      if (Date.now() - new Date(data._savedAt).getTime() < maxAge) {
        Object.keys(data).forEach(key => {
          if (key === '_savedAt') return;
          const field = this.form.querySelector(`[name="${key}"], #${key}`);
          if (field) field.value = data[key];
        });
        console.log(`Datos restaurados: ${this.storageKey}`);
      }
    } catch (e) {
      console.warn('No se pudieron restaurar datos auto-guardados');
    }
  }
  
  clear() {
    localStorage.removeItem(this.storageKey);
  }
}