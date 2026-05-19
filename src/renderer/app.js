// =======================================================
// IMPORTS
// =======================================================
import './styles/main.css';

// Vistas HTML
import homeHtml from './views/pages/home.html';
import catalogosHtml from './views/pages/catalogos.html';
import emisionHtml from './views/pages/emision.html';
import historialHtml from './views/pages/historial.html';
import configuracionHtml from './views/pages/configuracion.html';
import reportesHtml from './views/pages/reportes.html';
import perfilHtml from './views/pages/perfil.html';
import bibliotecaHtml from './views/pages/biblioteca.html';

// Módulos
import { AuthModule } from './modules/AuthModule.js';
import { CatalogoModule } from './modules/CatalogoModule.js';
import { EmisionModule } from './modules/EmisionModule.js';
import { HistorialModule } from './modules/HistorialModule.js';
import { BibliotecaModule } from './modules/BibliotecaModule.js';
import { globalConfirm } from './utils/confirmationModal.js';

// Mapa de vistas
const views = {
  'home': homeHtml,
  'catalogos': catalogosHtml,
  'configuracion': configuracionHtml,
  'perfil': perfilHtml,
  'reportes': reportesHtml || '<div class="card"><h3>Reportes</h3><p>En construcción...</p></div>',
  'emision': emisionHtml,
  'historial': historialHtml,
  'biblioteca': bibliotecaHtml
};

// =======================================================
// INSTANCIAS GLOBALES
// =======================================================
const auth = new AuthModule();
const catalogos = new CatalogoModule();
const emision = new EmisionModule();
const historial = new HistorialModule();
const biblioteca = new BibliotecaModule();
let currentUser = null;

// =======================================================
// UTILIDADES UI
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
// INICIALIZACIÓN DOM
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
  globalConfirm.init();
  updateConnectionStatus();
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  const savedDarkMode = localStorage.getItem('gesTao_darkMode') === 'true';
  const darkModeToggle = document.getElementById('toggle-dark-mode');
  applyDarkMode(savedDarkMode);
  if (darkModeToggle) {
    darkModeToggle.checked = savedDarkMode;
    darkModeToggle.addEventListener('change', (e) => applyDarkMode(e.target.checked));
  }

  auth.init();
  window.onLoginSuccess = () => navigate('home');

  // Sidebar toggle
  const btnToggle = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('main-sidebar');
  if (btnToggle && sidebar) {
    btnToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
      closeCatalogosPopover();
      const dropdown = document.getElementById('catalogos-dropdown-inline');
      if (dropdown && !dropdown.classList.contains('hidden')) {
        toggleCatalogosDropdown({ stopPropagation: () => {} });
      }
    });
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
      sidebar.classList.add('collapsed');
    }
  }

  // Perfil dropdown
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
  window.toggleProfileMenu = () => { if (dropdown) dropdown.classList.add('hidden'); };

  // Helpers globales para modales
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
  window.doLogout = () => { if (auth) auth.logout(); };
});

// =======================================================
// NAVEGACIÓN PRINCIPAL
// =======================================================
async function navigate(viewName, targetTab = null) {
  const contentDiv = document.getElementById('content-area');
  const pageTitle = document.getElementById('pageTitle');

  contentDiv.style.opacity = '0.5';
  contentDiv.style.pointerEvents = 'none';

  document.querySelectorAll('.nav-item, .nav-subitem').forEach(el => el.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-item[onclick*="'${viewName}'"], .nav-subitem[data-view="${viewName}"]`);
  if (activeLink) activeLink.classList.add('active');

  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) dropdown.classList.add('hidden');

  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const htmlContent = views[viewName];
    if (!htmlContent) throw new Error(`Vista '${viewName}' no encontrada`);

    contentDiv.innerHTML = htmlContent;

    const titles = {
      'home': 'Panel Principal',
      'catalogos': 'Gestión de Datos',
      'configuracion': 'Configuración del Sistema',
      'perfil': 'Mi Perfil',
      'reportes': 'Reportes Estadísticos',
      'emision': 'Emisión de Constancias',
      'historial': 'Historial y Búsqueda',
      'biblioteca': 'Biblioteca de Constancias'
    };

    if (viewName === 'home') {
      setTimeout(() => cargarPeriodoActual(), 100);
    }
    pageTitle.innerText = titles[viewName] || 'Ges-TAO';

    // Orquestación de módulos
    switch (viewName) {
      case 'catalogos':
        await catalogos.init(targetTab);
        break;
      case 'emision':
        await emision.init();
        break;
      case 'historial':
        await historial.init();
        break;
      case 'biblioteca':
        await biblioteca.init();
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
    console.error(`[navigate] Error cargando vista '${viewName}':`, error);
    contentDiv.innerHTML = `
      <div class="card error">
        <h4><i class="fa-solid fa-triangle-exclamation"></i> Error de Carga</h4>
        <p>${error.message || 'No se pudo cargar la vista solicitada.'}</p>
        <button class="btn btn-primary" onclick="navigate('home')">
          <i class="fa-solid fa-house"></i> Volver al Inicio
        </button>
      </div>
    `;
  } finally {
    contentDiv.style.opacity = '1';
    contentDiv.style.pointerEvents = 'auto';
  }
}

async function cargarPeriodoActual() {
  try {
    const res = await window.electronAPI?.listarPeriodos?.();
    if (res?.success) {
      const periodos = res.rows || res.data || [];
      const periodoActivo = periodos.find(p =>
        p.estado?.toLowerCase() === 'activo' ||
        p.estado?.toLowerCase() === 'vigente' ||
        p.estatus?.toLowerCase() === 'activo'
      );
      const periodoMostrar = periodoActivo || periodos[periodos.length - 1];
      if (periodoMostrar) {
        const elemento = document.getElementById('periodo-actual-valor');
        if (elemento) {
          elemento.textContent = periodoMostrar.clave || periodoMostrar.descripcion || 'No definido';
        }
      }
    }
  } catch (error) {
    console.error('Error cargando periodo actual:', error);
  }
}

// =======================================================
// EXPORTS GLOBALES
// =======================================================
window.navigate = navigate;
window.gesTaoUtils = { applyDarkMode, updateConnectionStatus };

if (process.env.NODE_ENV === 'development') {
  window.__GES_TAO_MODULES__ = { auth, catalogos, emision, historial, biblioteca };
  console.log('Ges-TAO: Módulos expuestos en window.__GES_TAO_MODULES__');
}

export { navigate, auth, catalogos, emision, historial, biblioteca };

// =======================================================
// DROPDOWN DE CATÁLOGOS
// =======================================================
window.toggleCatalogosDropdown = function(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('catalogos-dropdown-inline');
  const parent = document.getElementById('gestion-datos-trigger');
  if (dropdown && parent) {
    dropdown.classList.toggle('hidden');
    parent.classList.toggle('expanded');
    const indicator = parent.querySelector('.dropdown-indicator i');
    if (indicator) {
      indicator.style.transform = dropdown.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';
    }
  }
};

window.closeCatalogosDropdown = function() {
  const dropdown = document.getElementById('catalogos-dropdown-inline');
  const parent = document.getElementById('gestion-datos-trigger');
  if (dropdown) dropdown.classList.add('hidden');
  if (parent) parent.classList.remove('expanded');
  const indicator = parent?.querySelector('.dropdown-indicator i');
  if (indicator) indicator.style.transform = 'rotate(0deg)';
};

// =======================================================
// POPOVER COLAPSADO
// =======================================================
window.handleGestionDatosClick = function(event) {
  event.stopPropagation();
  const sidebar = document.getElementById('main-sidebar');
  const isCollapsed = sidebar?.classList.contains('collapsed');
  if (isCollapsed) {
    toggleCatalogosPopover(event);
  } else {
    toggleCatalogosDropdown(event);
  }
};

window.toggleCatalogosPopover = function(event) {
  if (event) event.stopPropagation();
  const popover = document.getElementById('catalogos-popover');
  const trigger = document.getElementById('gestion-datos-trigger');
  if (!popover || !trigger) return;
  const isOpen = !popover.classList.contains('hidden');
  if (isOpen) {
    closeCatalogosPopover();
  } else {
    const triggerRect = trigger.getBoundingClientRect();
    const sidebarRect = document.getElementById('main-sidebar')?.getBoundingClientRect();
    if (sidebarRect) {
      const topPosition = triggerRect.top - sidebarRect.top + (triggerRect.height / 2);
      popover.style.top = `${topPosition}px`;
    }
    popover.classList.remove('hidden');
    trigger.classList.add('active');
  }
};

window.closeCatalogosPopover = function() {
  const popover = document.getElementById('catalogos-popover');
  const trigger = document.getElementById('gestion-datos-trigger');
  if (popover) popover.classList.add('hidden');
  if (trigger) trigger.classList.remove('active');
};

// =======================================================
// LISTENERS GLOBALES
// =======================================================
document.addEventListener('click', function(event) {
  const sidebar = document.getElementById('main-sidebar');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.contains('collapsed');
  const trigger = document.getElementById('gestion-datos-trigger');
  if (isCollapsed) {
    const popover = document.getElementById('catalogos-popover');
    if (popover && !popover.classList.contains('hidden') &&
        !popover.contains(event.target) && !trigger?.contains(event.target)) {
      closeCatalogosPopover();
    }
  } else {
    const dropdown = document.getElementById('catalogos-dropdown-inline');
    if (dropdown && !dropdown.classList.contains('hidden') &&
        !dropdown.contains(event.target) && !trigger?.contains(event.target)) {
      closeCatalogosDropdown();
    }
  }
});

window.addEventListener('resize', () => {
  closeCatalogosPopover();
  closeCatalogosDropdown();
});

const btnToggle = document.getElementById('btn-toggle-sidebar');
if (btnToggle) {
  btnToggle.addEventListener('click', () => {
    setTimeout(() => {
      closeCatalogosPopover();
      closeCatalogosDropdown();
    }, 50);
  });
}