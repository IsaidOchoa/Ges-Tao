// src/renderer/app.js
import './styles/main.css'; // Estilos globales

// Vistas HTML
import homeHtml from './views/pages/home.html';
import catalogosHtml from './views/pages/catalogos.html';
import emisionHtml from './views/pages/emision.html';
import historialHtml from './views/pages/historial.html';
import configuracionHtml from './views/pages/configuracion.html';
import perfilHtml from './views/pages/perfil.html';
import bibliotecaHtml from './views/pages/biblioteca.html';

// Módulos
import { AuthModule } from './modules/AuthModule.js';
import { CatalogoModule } from './modules/CatalogoModule.js';
import { EmisionModule } from './modules/EmisionModule.js';
import { HistorialModule } from './modules/HistorialModule.js';
import { BibliotecaModule } from './modules/BibliotecaModule.js';
import { ConfiguracionModule } from './modules/ConfiguracionModule.js';

// Utilidades
import { globalConfirm } from './utils/confirmationModal.js';
import { AssignmentModal } from './utils/AssignmentModal.js';
import { allRelationships } from './config/relationships/index.js';
import { Toast } from './components/common/Toast.js';

// Debug de imports (eliminar en producción)
if (process.env.NODE_ENV === 'development') { console.log('🔍 [app.js] allRelationships:', allRelationships?.length, 'relaciones'); }

// Mapa de vistas
const views = { 'home': homeHtml, 'catalogos': catalogosHtml, 'configuracion': configuracionHtml, 'perfil': perfilHtml, 'emision': emisionHtml, 'historial': historialHtml, 'biblioteca': bibliotecaHtml };

// Instancias globales
const auth = new AuthModule(), catalogos = new CatalogoModule(), emision = new EmisionModule(), historial = new HistorialModule(), biblioteca = new BibliotecaModule(), assignmentModal = new AssignmentModal();
let currentUser = null;

// Utilidades UI
function updateConnectionStatus() { const isOnline = navigator.onLine, indicator = document.getElementById('connection-status'); if (indicator) { indicator.classList.toggle('offline', !isOnline); indicator.title = isOnline ? "Conectado al WiFi" : "Sin conexión a internet"; } }
function applyDarkMode(isDark) { document.body.setAttribute('data-theme', isDark ? 'dark' : ''); localStorage.setItem('gesTao_darkMode', isDark); }

// Inicialización DOM
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof Toast !== 'undefined' && typeof Toast._init === 'function') {
    try {
      Toast._init();
      console.log('✅ Toast container inicializado en DOMContentLoaded');
    } catch (e) {
      console.warn('⚠️ No se pudo inicializar Toast temprano:', e);
    }
  }
  globalConfirm.init(); // Inicializar confirmaciones globales
  
  // Registrar pestañas modulares del mega modal (única fuente de verdad)
  allRelationships.forEach(rel => { if (rel?.tabId && rel?.compatibleWith?.length) { rel.compatibleWith.forEach(entityType => assignmentModal.registerTab(entityType, rel)); } });
  if (process.env.NODE_ENV === 'development') { console.log(`✅ [app.js] ${allRelationships?.length || 0} relaciones registradas`); }
  
  updateConnectionStatus(); window.addEventListener('online', updateConnectionStatus); window.addEventListener('offline', updateConnectionStatus); // Estado de conexión
  
  const savedDarkMode = localStorage.getItem('gesTao_darkMode') === 'true', darkModeToggle = document.getElementById('toggle-dark-mode'); // Tema oscuro
  applyDarkMode(savedDarkMode); if (darkModeToggle) { darkModeToggle.checked = savedDarkMode; darkModeToggle.addEventListener('change', (e) => applyDarkMode(e.target.checked)); }
  
  auth.init(); window.onLoginSuccess = () => navigate('home'); // Auth
  
  // Sidebar toggle
  const btnToggle = document.getElementById('btn-toggle-sidebar'), sidebar = document.getElementById('main-sidebar');
  if (btnToggle && sidebar) { btnToggle.addEventListener('click', () => { sidebar.classList.toggle('collapsed'); localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed')); closeCatalogosPopover(); const dropdown = document.getElementById('catalogos-dropdown-inline'); if (dropdown && !dropdown.classList.contains('hidden')) { toggleCatalogosDropdown({ stopPropagation: () => {} }); } }); if (localStorage.getItem('sidebarCollapsed') === 'true') { sidebar.classList.add('collapsed'); } }
  
  // Perfil dropdown
  const avatarBtn = document.getElementById('user-avatar-btn'), dropdown = document.getElementById('profile-dropdown');
  if (avatarBtn && dropdown) { avatarBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); }); document.addEventListener('click', (e) => { if (!dropdown.contains(e.target) && !avatarBtn.contains(e.target)) { dropdown.classList.add('hidden'); } }); }
  window.toggleProfileMenu = () => { if (dropdown) dropdown.classList.add('hidden'); };
  
  // Helpers globales para modales
  window.abrirModal = (id) => { const modal = document.getElementById(id); if (modal) { modal.classList.remove('hidden'); const form = modal.querySelector('form'); if (form) form.reset(); } };
  window.cerrarModal = (id) => { const modal = document.getElementById(id); if (modal) modal.classList.add('hidden'); };
  window.doLogout = () => { if (auth) auth.logout(); };
  
  window.assignmentModal = assignmentModal; // Exponer modal globalmente
});

// Navegación principal
async function navigate(viewName, targetTab = null) {
  const contentDiv = document.getElementById('content-area'), pageTitle = document.getElementById('pageTitle');
  contentDiv.style.opacity = '0.5'; contentDiv.style.pointerEvents = 'none'; // Feedback visual de carga
  document.querySelectorAll('.nav-item, .nav-subitem').forEach(el => el.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-item[onclick*="'${viewName}'"], .nav-subitem[data-view="${viewName}"]`);
  if (activeLink) activeLink.classList.add('active');
  const dropdown = document.getElementById('profile-dropdown'); if (dropdown) dropdown.classList.add('hidden');
  await new Promise(resolve => setTimeout(resolve, 50)); // Pequeño delay para transición suave
  
  try {
    const htmlContent = views[viewName]; if (!htmlContent) throw new Error(`Vista '${viewName}' no encontrada`);
    contentDiv.innerHTML = htmlContent;
    const titles = { 'home': 'Panel Principal', 'catalogos': 'Gestión de Datos', 'configuracion': 'Configuración del Sistema', 'perfil': 'Mi Perfil', 'emision': 'Emisión de Constancias', 'historial': 'Historial y Búsqueda', 'biblioteca': 'Biblioteca de Constancias' };
    if (viewName === 'home') { setTimeout(() => cargarPeriodoActual(), 100); }
    pageTitle.innerText = titles[viewName] || 'Ges-TAO';
    // Orquestación de módulos por vista
    switch (viewName) { case 'catalogos': await catalogos.init(targetTab); break; case 'emision': await emision.init(); break; case 'historial': await historial.init(); break; case 'biblioteca': await biblioteca.init(); break;
       case 'configuracion': const configInstance = new ConfiguracionModule();
  configInstance.init();
  break;
       }
  } catch (error) { console.error(`[navigate] Error cargando vista '${viewName}':`, error); contentDiv.innerHTML = `<div class="card error"><h4><i class="fa-solid fa-triangle-exclamation"></i> Error de Carga</h4><p>${error.message || 'No se pudo cargar la vista solicitada.'}</p><button class="btn btn-primary" onclick="navigate('home')"><i class="fa-solid fa-house"></i> Volver al Inicio</button></div>`; }
  finally { contentDiv.style.opacity = '1'; contentDiv.style.pointerEvents = 'auto'; }
}

// Cargar periodo actual para home
async function cargarPeriodoActual() { try { const res = await window.electronAPI?.listarPeriodos?.(); if (res?.success) { const periodos = res.rows || res.data || [], periodoActivo = periodos.find(p => p.estado?.toLowerCase() === 'activo' || p.estado?.toLowerCase() === 'vigente' || p.estatus?.toLowerCase() === 'activo'), periodoMostrar = periodoActivo || periodos[periodos.length - 1]; if (periodoMostrar) { const elemento = document.getElementById('periodo-actual-valor'); if (elemento) { elemento.textContent = periodoMostrar.clave || periodoMostrar.descripcion || 'No definido'; } } } } catch (error) { console.error('Error cargando periodo actual:', error); } }

// Exports globales
window.navigate = navigate; window.gesTaoUtils = { applyDarkMode, updateConnectionStatus };
if (process.env.NODE_ENV === 'development') { window.__GES_TAO_MODULES__ = { auth, catalogos, emision, historial, biblioteca, assignmentModal }; console.log('Ges-TAO: Módulos expuestos en window.__GES_TAO_MODULES__'); }
export { navigate, auth, catalogos, emision, historial, biblioteca, assignmentModal };

// Dropdown de catálogos
window.toggleCatalogosDropdown = function(event) { if (event) event.stopPropagation(); const dropdown = document.getElementById('catalogos-dropdown-inline'), parent = document.getElementById('gestion-datos-trigger'); if (dropdown && parent) { dropdown.classList.toggle('hidden'); parent.classList.toggle('expanded'); const indicator = parent.querySelector('.dropdown-indicator i'); if (indicator) { indicator.style.transform = dropdown.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)'; } } };
window.closeCatalogosDropdown = function() { const dropdown = document.getElementById('catalogos-dropdown-inline'), parent = document.getElementById('gestion-datos-trigger'); if (dropdown) dropdown.classList.add('hidden'); if (parent) parent.classList.remove('expanded'); const indicator = parent?.querySelector('.dropdown-indicator i'); if (indicator) indicator.style.transform = 'rotate(0deg)'; };

// Popover colapsado
window.handleGestionDatosClick = function(event) { event.stopPropagation(); const sidebar = document.getElementById('main-sidebar'), isCollapsed = sidebar?.classList.contains('collapsed'); if (isCollapsed) { toggleCatalogosPopover(event); } else { toggleCatalogosDropdown(event); } };
window.toggleCatalogosPopover = function(event) { if (event) event.stopPropagation(); const popover = document.getElementById('catalogos-popover'), trigger = document.getElementById('gestion-datos-trigger'); if (!popover || !trigger) return; const isOpen = !popover.classList.contains('hidden'); if (isOpen) { closeCatalogosPopover(); } else { const triggerRect = trigger.getBoundingClientRect(), sidebarRect = document.getElementById('main-sidebar')?.getBoundingClientRect(); if (sidebarRect) { const topPosition = triggerRect.top - sidebarRect.top + (triggerRect.height / 2); popover.style.top = `${topPosition}px`; } popover.classList.remove('hidden'); trigger.classList.add('active'); } };
window.closeCatalogosPopover = function() { const popover = document.getElementById('catalogos-popover'), trigger = document.getElementById('gestion-datos-trigger'); if (popover) popover.classList.add('hidden'); if (trigger) trigger.classList.remove('active'); };

// Función global para manejar menú contextual de filas
window.toggleRowContextMenu = function(event, rowId) {
  event.preventDefault();
  event.stopPropagation();
  
  // Cerrar todos los menús abiertos
  document.querySelectorAll('.context-menu').forEach(menu => {
    menu.classList.add('hidden');
  });
  
  // Mostrar menú de esta fila
  const menu = document.getElementById(`menu-${rowId}`);
  if (menu) {
    // Posicionar menú (clic derecho: en el mouse | 3 puntos: debajo del botón)
    if (event.type === 'contextmenu') {
      menu.style.left = `${event.pageX}px`;
      menu.style.top = `${event.pageY}px`;
    } else {
      const rect = event.target.closest('td').getBoundingClientRect();
      menu.style.left = `${rect.right - 180}px`; // 180px = ancho del menú
      menu.style.top = `${rect.bottom + window.scrollY}px`;
    }
    
    menu.classList.remove('hidden');
    
    // Cerrar al hacer clic fuera
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.classList.add('hidden');
        document.removeEventListener('click', closeMenu);
      }, { once: true });
    }, 100);
  }
};

// Listeners globales
document.addEventListener('click', function(event) { const sidebar = document.getElementById('main-sidebar'); if (!sidebar) return; const isCollapsed = sidebar.classList.contains('collapsed'), trigger = document.getElementById('gestion-datos-trigger'); if (isCollapsed) { const popover = document.getElementById('catalogos-popover'); if (popover && !popover.classList.contains('hidden') && !popover.contains(event.target) && !trigger?.contains(event.target)) { closeCatalogosPopover(); } } else { const dropdown = document.getElementById('catalogos-dropdown-inline'); if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(event.target) && !trigger?.contains(event.target)) { closeCatalogosDropdown(); } } });
window.addEventListener('resize', () => { closeCatalogosPopover(); closeCatalogosDropdown(); });
const btnToggleFinal = document.getElementById('btn-toggle-sidebar'); if (btnToggleFinal) { btnToggleFinal.addEventListener('click', () => { setTimeout(() => { closeCatalogosPopover(); closeCatalogosDropdown(); }, 50); }); }