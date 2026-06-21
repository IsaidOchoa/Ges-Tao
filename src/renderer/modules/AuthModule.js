/* /renderer/modules/AuthModule.js */
import { WelcomeCurtain } from '../components/WelcomeCurtain.js';

// 🔹 CONFIGURACIÓN RÁPIDA (Cambiar aquí para activar/desactivar)
const CONFIG = {
  SHOW_WELCOME_CURTAIN: false, // ← Cambiar a false para desactivar la cortina
};

export class AuthModule {
  constructor() {
    this.currentUser = null;
    this.loaderElement = null;
    this.welcomeCurtain = null; // Referencia a la cortina
    
    // Referencias al DOM (se inicializan cuando el DOM está listo)
    this.loginForm = null;
    this.viewLogin = null;
    this.viewDashboard = null;
  }

  /**
   * Inicializa el módulo: busca elementos en el DOM y asigna eventos.
   * Debe llamarse después de que el DOM cargue.
   */
  init() {
    this.viewLogin = document.getElementById('view-login');
    this.viewDashboard = document.getElementById('view-dashboard');
    this.loginForm = document.getElementById('loginForm');

    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Exponer método global para logout (usado en el dropdown HTML)
    window.doLogout = () => this.logout();
    
    // Verificar si hay sesión activa (opcional, si usas sessionStorage)
    const savedSession = sessionStorage.getItem('userSession');
    if (savedSession) {
      this.currentUser = JSON.parse(savedSession);
      this.switchToDashboard();
    }
  }

  /**
   * Maneja el evento de submit del formulario
   */
  async handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnLogin');
    const errorMsg = document.getElementById('errorMsg');

    this.showLoading("Verificando credenciales...", "Conectando con la base de datos segura");

    btn.disabled = true;
    btn.innerText = 'Verificando...';
    if(errorMsg) errorMsg.classList.add('hidden');

    try {
      // Simulación de retraso (puedes borrar esto en producción)
      await new Promise(r => setTimeout(r, 1000));

      const result = await window.electronAPI.loginUser({ username, password });
      
      this.hideLoading();

      if (result.success) {
        this.currentUser = result.user;
        this.switchToDashboard();
      } else {
        if(errorMsg) {
          errorMsg.innerText = result.error;
          errorMsg.classList.remove('hidden');
        }
        btn.disabled = false;
        btn.innerText = 'Ingresar';
      }
    } catch (err) {
      this.hideLoading();
      console.error(err);
      if(errorMsg) {
        errorMsg.innerText = "Error de conexión con el sistema.";
        errorMsg.classList.remove('hidden');
      }
      btn.disabled = false;
      btn.innerText = 'Ingresar';
    }
  }

  /**
   * Cambia la vista de Login a Dashboard
   * Muestra la cortina de bienvenida si está activada
   */
  switchToDashboard() {
    if (this.viewLogin) this.viewLogin.classList.add('hidden');
    if (this.viewDashboard) {
      this.viewDashboard.classList.remove('hidden');
      
      // Pequeño delay para asegurar renderizado
      setTimeout(() => {
        if (this.currentUser) {
          this.updateUserInfo();
          
          // 🔹 MOSTRAR CORTINA DE BIENVENIDA (si está activada)
          if (CONFIG.SHOW_WELCOME_CURTAIN) {
            this.showWelcomeCurtain();
          } else {
            // Si no hay cortina, notificar directamente
            if (window.onLoginSuccess) window.onLoginSuccess();
          }
        }
      }, 150);
    }
  }

  /**
   * Muestra la cortina de bienvenida post-login
   */
  showWelcomeCurtain() {
    // Destruir cortina anterior si existe
    if (this.welcomeCurtain) {
      this.welcomeCurtain.destroy();
    }

    // Crear nueva instancia
    this.welcomeCurtain = new WelcomeCurtain({
      enabled: true,
      autoDismiss: false, // false = requiere clic en "Continuar"
      onDismiss: () => {
        console.log('✅ Cortina cerrada, navegando al sistema...');
        this.welcomeCurtain = null;
        
        // Notificar al app principal que el login fue exitoso
        if (window.onLoginSuccess) {
          window.onLoginSuccess();
        }
      }
    });

    // Mostrar cortina
    this.welcomeCurtain.show();
  }

  /**
   * Actualiza los nombres de usuario en la UI del header
   */
  updateUserInfo() {
    const fields = [
      { id: 'userNameDisplay', val: this.currentUser.nombre },
      { id: 'userRoleDisplay', val: this.currentUser.rol || 'Administrador' },
      { id: 'dropUserName', val: this.currentUser.nombre },
      { id: 'dropUserRole', val: this.currentUser.rol || 'Administrador' }
    ];

    fields.forEach(field => {
      const el = document.getElementById(field.id);
      if (el) el.innerText = field.val;
    });

    sessionStorage.setItem('userSession', JSON.stringify(this.currentUser));
  }

  /**
   * Cierra sesión y vuelve al login
   */
  logout() {
    // Destruir cortina si está abierta
    if (this.welcomeCurtain) {
      this.welcomeCurtain.destroy();
      this.welcomeCurtain = null;
    }

    this.currentUser = null;
    sessionStorage.removeItem('userSession');
    
    if (this.viewDashboard) this.viewDashboard.classList.add('hidden');
    if (this.viewLogin) this.viewLogin.classList.remove('hidden');
    
    // Resetear formulario
    if (this.loginForm) {
      this.loginForm.reset();
      const errorMsg = document.getElementById('errorMsg');
      const btn = document.getElementById('btnLogin');
      if(errorMsg) errorMsg.classList.add('hidden');
      if(btn) {
        btn.disabled = false;
        btn.innerText = 'Ingresar';
      }
    }
    
    // Ocultar dropdown si está abierto
    const dropdown = document.getElementById('profile-dropdown');
    if(dropdown) dropdown.classList.add('hidden');
  }

  // =======================================================
  // UTILIDADES: LOADER
  // =======================================================

  showLoading(message, subMessage = "Procesando...") {
    if (this.loaderElement) this.loaderElement.remove();

    this.loaderElement = document.createElement('div');
    this.loaderElement.className = 'loading-overlay fade-in-up';
    this.loaderElement.innerHTML = `
      <div class="spinner"></div>
      <div class="loading-text">${message}</div>
      ${subMessage ? `<div class="loading-subtext">${subMessage}</div>` : ''}
    `;
    
    document.body.appendChild(this.loaderElement);
  }

  hideLoading() {
    if (this.loaderElement) {
      this.loaderElement.classList.add('hidden');
      setTimeout(() => {
        if (this.loaderElement) {
          this.loaderElement.remove();
          this.loaderElement = null;
        }
      }, 300);
    }
  }
}