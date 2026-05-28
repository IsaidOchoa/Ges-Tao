// src/renderer/modules/ConfiguracionModule.js
import { Toast } from '../components/common/Toast.js';

export class ConfiguracionModule {
  constructor() {
    this.config = { rutaConstancias: '', temaOscuro: false };
    this.STORAGE_KEY_DARK = 'gesTao_darkMode';
  }

  async init() {
    console.log('⚙️ [ConfiguracionModule] Iniciando...');
    try {
      // 1. Cargar configuración del backend (async)
      await this.cargarConfigBackend();
      
      // 2. Aplicar tema desde localStorage (fuente principal para UI)
      this.aplicarTemaDesdeLocalStorage();
      
      // 3. Configurar eventos (listeners con protección)
      this.configurarEventos();
      
      // 4. 🔹 CRÍTICO: Actualizar la UI con los datos ya resueltos
      this.actualizarCampoRuta();
    } catch (error) {
      console.error(' Error en ConfiguracionModule.init:', error);
      // Fallback visual si falla la carga
      this.config.rutaConstancias = 'Error al cargar. Use "Examinar".';
      this.actualizarCampoRuta();
    }
  }

  async cargarConfigBackend() {
    try {
      if (!window.electronAPI?.obtenerConfig) {
        console.warn('⚠️ electronAPI.obtenerConfig no disponible');
        return;
      }
      const backendConfig = await window.electronAPI.obtenerConfig();
      if (backendConfig && backendConfig.rutaConstancias) {
        this.config.rutaConstancias = backendConfig.rutaConstancias;
        console.log('✅ Ruta cargada desde backend:', this.config.rutaConstancias);
      } else {
        this.config.rutaConstancias = '';
      }
    } catch (err) {
      console.warn('⚠️ Fallo al cargar config del backend (usando fallback):', err.message);
      this.config.rutaConstancias = '';
    }
  }

  aplicarTemaDesdeLocalStorage() {
    const isDark = localStorage.getItem(this.STORAGE_KEY_DARK) === 'true';
    this.config.temaOscuro = isDark;
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  configurarEventos() {
    // 1. Botón Examinar Ruta
    const btnExaminar = document.getElementById('btn-seleccionar-ruta');
    if (btnExaminar && !btnExaminar.dataset.listenerAttached) {
      btnExaminar.dataset.listenerAttached = 'true';
      btnExaminar.addEventListener('click', async () => {
        try {
          const ruta = await window.electronAPI.seleccionarDirectorio();
          if (ruta) {
            this.config.rutaConstancias = ruta;
            this.actualizarCampoRuta(); // Actualiza UI inmediatamente
            await this.guardarRutaEnBackend();
          }
        } catch (err) {
          this.mostrarToastSeguro('error', 'Error al seleccionar carpeta', err.message);
        }
      });
    }

    // 2. Toggle Modo Oscuro
    const toggleDark = document.getElementById('toggle-dark-mode');
    if (toggleDark && !toggleDark.dataset.listenerAttached) {
      toggleDark.dataset.listenerAttached = 'true';
      toggleDark.checked = this.config.temaOscuro; // Sincronizar estado visual

      toggleDark.addEventListener('change', async (e) => {
        const isDark = e.target.checked;
        this.config.temaOscuro = isDark;
        document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem(this.STORAGE_KEY_DARK, isDark);
        await this.sincronizarTemaConBackend(isDark);
      });
    }
  }

  /**
   * Actualiza el input de ruta de forma segura
   * Se llama después de cargar datos Y después de seleccionar nueva ruta
   */
  actualizarCampoRuta() {
    const input = document.getElementById('input-ruta-pdf');
    const msg = document.getElementById('msg-estado-ruta');

    if (input) {
      // Muestra la ruta guardada o un mensaje amigable si está vacío
      input.value = this.config.rutaConstancias || 'No configurada (se usará Documentos por defecto)';
      input.style.color = this.config.rutaConstancias ? 'var(--text-dark)' : 'var(--text-muted)';
    } else {
      console.warn('⚠️ #input-ruta-pdf no encontrado en el DOM');
    }

    if (msg) msg.textContent = ''; // Limpiar mensajes previos
  }

  async guardarRutaEnBackend() {
    try {
      if (window.electronAPI?.guardarConfig) {
        await window.electronAPI.guardarConfig({ key: 'rutaConstancias', value: this.config.rutaConstancias });
        console.log('💾 Ruta guardada en backend');
      }
    } catch (err) {
      console.warn('⚠️ No se pudo guardar ruta en backend:', err.message);
    }
  }

  async sincronizarTemaConBackend(isDark) {
    try {
      if (window.electronAPI?.guardarConfig) {
        await window.electronAPI.guardarConfig({ key: 'temaOscuro', value: isDark });
      }
    } catch (err) {
      console.warn('⚠️ No se pudo sincronizar tema con backend:', err.message);
    }
  }

  mostrarToastSeguro(type, title, message, duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container && typeof Toast !== 'undefined' && typeof Toast._init === 'function') {
      try { Toast._init(); } catch {}
    }

    if (document.getElementById('toast-container') && typeof Toast?.show === 'function') {
      const fullMsg = title ? `${title}: ${message}` : message;
      Toast.show(fullMsg, type, duration);
    } else {
      console.error(`[Toast fallback] ${type.toUpperCase()}: ${title} - ${message}`);
      if (type === 'error') alert(`❌ ${title}\n${message}`);
    }
  }
}