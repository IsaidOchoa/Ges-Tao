import './styles/main.css';

// =======================================================
// 1. IMPORTS DE VISTAS Y MÓDULOS
// =======================================================

// Vistas (HTML)
import homeHtml from './views/home.html';
import catalogosHtml from './views/catalogos.html';
import emisionHtml from './views/emision.html';
import historialHtml from './views/historial.html';
import configuracionHtml from './views/configuracion.html';
import reportesHtml from './views/reportes.html';
import perfilHtml from './views/perfil.html';
import bibliotecaHtml from './views/biblioteca.html';

// Módulos (Lógica POO)
import { AuthModule } from './modules/AuthModule.js';
import { CatalogoModule } from './modules/CatalogoModule.js';
import { EmisionModule } from './modules/EmisionModule.js';
import { HistorialModule } from './modules/HistorialModule.js';
import { BibliotecaModule } from './modules/BibliotecaModule.js';

// Mapa de vistas HTML
const views = {
  'home': homeHtml,
  'catalogos': catalogosHtml, 
  'configuracion': configuracionHtml,
  'perfil': perfilHtml,
  'reportes': reportesHtml || '<div class="card"><h3>Reportes</h3><p>En construcción...</p></div>',
  'emision': emisionHtml,
  'historial': historialHtml,
  'biblioteca': bibliotecaHtml,
};

// =======================================================
// 2. INSTANCIAS GLOBALES DE MÓDULOS
// =======================================================

const auth = new AuthModule();
const catalogos = new CatalogoModule();
const emision = new EmisionModule();
const historial = new HistorialModule();
const biblioteca = new BibliotecaModule();

// Variables de estado global mínimo
let currentUser = null;

// =======================================================
// 3. FUNCIONES UTILITARIAS GLOBALES (UI)
// =======================================================

function updateConnectionStatus() {
  const isOnline = navigator.onLine;
  const indicator = document.getElementById('connection-status');
  
  if (indicator) {
    if (isOnline) {
      indicator.classList.remove('offline');
      indicator.title = "Conectado al WiFi";
    } else {
      indicator.classList.add('offline');
      indicator.title = "Sin conexión a internet";
    }
  }
}

function applyDarkMode(isDark) {
  const body = document.body;
  if (isDark) {
    body.setAttribute('data-theme', 'dark');
  } else {
    body.removeAttribute('data-theme');
  }
  localStorage.setItem('gesTao_darkMode', isDark);
}

// =======================================================
// 4. LÓGICA PRINCIPAL AL CARGAR EL DOM
// =======================================================

document.addEventListener('DOMContentLoaded', () => {
  
  // --- INICIALIZAR SERVICIOS BASE ---
  updateConnectionStatus();
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  // --- MODO OSCURO ---
  const savedDarkMode = localStorage.getItem('gesTao_darkMode') === 'true';
  const darkModeToggle = document.getElementById('toggle-dark-mode');
  
  applyDarkMode(savedDarkMode);
  if (darkModeToggle) {
    darkModeToggle.checked = savedDarkMode;
    darkModeToggle.addEventListener('change', (e) => applyDarkMode(e.target.checked));
  }

  // --- INICIALIZAR MÓDULO DE AUTH ---
  auth.init();
  
  // Callback para cuando el login sea exitoso
  window.onLoginSuccess = () => {
    navigate('home');
  };

  // --- SIDEBAR TOGGLE ---
  const btnToggle = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('main-sidebar');
  if (btnToggle && sidebar) {
    btnToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }
  }

  // --- PERFIL DROPDOWN ---
  const avatarBtn = document.getElementById('user-avatar-btn');
  const dropdown = document.getElementById('profile-dropdown');

  if (avatarBtn && dropdown) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !avatarBtn.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  // Función global para cerrar menú perfil
  window.toggleProfileMenu = () => {
    if(dropdown) dropdown.classList.add('hidden');
  };

  // =======================================================
  // 🛠️ SOLUCIÓN: Helpers Globales para Modales
  // =======================================================
  // Estas funciones deben estar AQUÍ para que el HTML (onclick) las encuentre
  
  window.abrirModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('hidden');
      const form = modal.querySelector('form');
      if (form) form.reset();
    }
  };

  window.cerrarModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
  };

  // También exponemos doLogout por si el HTML lo usa directamente
  window.doLogout = () => {
    if (auth) auth.logout();
  };
  
  // =======================================================

});

// =======================================================
// 5. NAVEGACIÓN Y ORQUESTACIÓN DE VISTAS
// =======================================================

async function navigate(viewName) {
  const contentDiv = document.getElementById('content-area');
  const pageTitle = document.getElementById('pageTitle');
  
  // Feedback visual de carga
  contentDiv.style.opacity = '0.5';
  contentDiv.style.pointerEvents = 'none';

  // Actualizar menú activo
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-item[onclick="navigate('${viewName}')"]`);
  if(activeLink) activeLink.classList.add('active');

  // Cerrar dropdowns
  const dropdown = document.getElementById('profile-dropdown');
  if(dropdown) dropdown.classList.add('hidden');

  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const htmlContent = views[viewName];
    if (!htmlContent) throw new Error(`Vista '${viewName}' no encontrada`);
    
    // Inyectar HTML
    contentDiv.innerHTML = htmlContent;
    
    // Actualizar título
    const titles = {
      'home': 'Panel Principal',
      'catalogos': 'Gestión de Catálogos',
      'configuracion': 'Configuración del Sistema',
      'perfil': 'Mi Perfil',
      'reportes': 'Reportes Estadísticos',
      'emision': 'Emisión de Constancias',
      'historial': 'Historial y Búsqueda',
      'biblioteca': 'Biblioteca de Constancias'
    };
    pageTitle.innerText = titles[viewName] || 'Ges-TAO';

    // --- ORQUESTACIÓN: Llamar al módulo correspondiente ---
    switch (viewName) {
      case 'catalogos':
        catalogos.init();
        break;
      case 'emision':
        emision.init();
        break;
      case 'historial':
        historial.init();
        break;
      case 'biblioteca':
        biblioteca.init();
        break;
      case 'configuracion':
        setTimeout(() => {
          const toggle = document.getElementById('toggle-dark-mode');
          if (toggle) {
            toggle.checked = localStorage.getItem('gesTao_darkMode') === 'true';
            toggle.onchange = (e) => applyDarkMode(e.target.checked);
          }
        }, 10);
        break;
      default:
        break;
    }

  } catch (error) {
    console.error(error);
    contentDiv.innerHTML = `<div class="card error"><h4>Error</h4><p>${error.message}</p></div>`;
  } finally {
    contentDiv.style.opacity = '1';
    contentDiv.style.pointerEvents = 'auto';
  }
}

// Exportar para uso global en HTML
window.navigate = navigate;