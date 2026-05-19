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

// Utilidades
import { globalConfirm } from './utils/confirmationModal.js';
import { AssignmentModal } from './utils/AssignmentModal.js'; // ✅ NUEVO

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
const assignmentModal = new AssignmentModal(); // ✅ NUEVO: Instancia única del modal de asignaciones

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
// REGISTRO DE PESTAÑAS PARA ASIGNACIONES
// =======================================================
/**
 * Registra las pestañas disponibles para cada entidad en el modal de asignaciones.
 * Se ejecuta una sola vez al iniciar la app.
 */
function registerAssignmentTabs() {
  // 🎓 DOCENTES
  assignmentModal.registerTab('docente', {
    tabId: 'tutorados',
    label: '👨‍🎓 Tutorados',
    loadData: async (docenteId) => {
      const res = await window.electronAPI?.obtenerTutorados?.(docenteId);
      return res?.success ? res.data : [];
    },
    render: (data) => {
      if (!data?.length) return '<div class="empty-state">Sin tutorados asignados</div>';
      return `
        <table class="data-table">
          <thead><tr><th>Matrícula</th><th>Nombre</th><th>Programa</th><th>Estado</th></tr></thead>
          <tbody>
            ${data.map(a => `
              <tr class="data-row">
                <td><strong>${a.matricula}</strong></td>
                <td>${a.nombre_completo}</td>
                <td>${a.programa || '—'}</td>
                <td><span class="badge ${a.estado === 'activo' ? 'badge-success' : 'badge-secondary'}">${a.estado}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  });

  assignmentModal.registerTab('docente', {
    tabId: 'ee_asignadas',
    label: '📚 EE Asignadas',
    loadData: async (docenteId) => {
      const res = await window.electronAPI?.obtenerEEAsignadasDocente?.(docenteId);
      return res?.success ? res.data : [];
    },
    render: (data) => {
      if (!data?.length) return '<div class="empty-state">Sin experiencias educativas asignadas</div>';
      return `
        <table class="data-table">
          <thead><tr><th>Clave</th><th>Nombre</th><th>Periodo</th><th>Horas</th></tr></thead>
          <tbody>
            ${data.map(ee => `
              <tr class="data-row">
                <td><strong style="font-family:monospace">${ee.clave}</strong></td>
                <td>${ee.nombre}</td>
                <td>${ee.periodo || '—'}</td>
                <td>${ee.horas_totales || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  });

  assignmentModal.registerTab('docente', {
    tabId: 'periodos_activos',
    label: '📅 Periodos',
    loadData: async (docenteId) => {
      const res = await window.electronAPI?.obtenerPeriodosDocente?.(docenteId);
      return res?.success ? res.data : [];
    },
    render: (data) => {
      if (!data?.length) return '<div class="empty-state">Sin periodos activos</div>';
      return `
        <table class="data-table">
          <thead><tr><th>Clave</th><th>Descripción</th><th>Inicio</th><th>Fin</th></tr></thead>
          <tbody>
            ${data.map(p => `
              <tr class="data-row">
                <td><strong>${p.clave}</strong></td>
                <td>${p.descripcion}</td>
                <td>${new Date(p.fecha_inicio).toLocaleDateString('es-MX')}</td>
                <td>${new Date(p.fecha_fin).toLocaleDateString('es-MX')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  });

  // 👨‍🎓 ALUMNOS
  assignmentModal.registerTab('alumno', {
    tabId: 'ee_cursadas',
    label: '📚 EE Cursadas',
    loadData: async (alumnoId) => {
      const res = await window.electronAPI?.obtenerEECursadasAlumno?.(alumnoId);
      return res?.success ? res.data : [];
    },
    render: (data) => {
      if (!data?.length) return '<div class="empty-state">Sin experiencias educativas cursadas</div>';
      return `
        <table class="data-table">
          <thead><tr><th>Clave</th><th>Nombre</th><th>Calificación</th><th>Estado</th></tr></thead>
          <tbody>
            ${data.map(ee => `
              <tr class="data-row">
                <td><strong style="font-family:monospace">${ee.clave}</strong></td>
                <td>${ee.nombre}</td>
                <td>${ee.calificacion ?? '—'}</td>
                <td><span class="badge ${ee.estado === 'aprobada' ? 'badge-success' : 'badge-warning'}">${ee.estado}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  });

  assignmentModal.registerTab('alumno', {
    tabId: 'tutor',
    label: '👨‍🏫 Tutor Asignado',
    loadData: async (alumnoId) => {
      const res = await window.electronAPI?.obtenerTutorAlumno?.(alumnoId);
      return res?.success ? [res.data] : [];
    },
    render: (data) => {
      if (!data?.length) return '<div class="empty-state">Sin tutor asignado</div>';
      const t = data[0];
      return `
        <div class="card" style="padding:15px">
          <p><strong>${t.tratamiento || ''} ${t.nombre_completo}</strong></p>
          <p style="color:var(--text-muted)">${t.cargo || 'Tutor académico'}</p>
          <p style="font-size:0.9rem">📧 ${t.correo || '—'}</p>
        </div>
      `;
    }
  });

  // 📚 EXPERIENCIAS EDUCATIVAS
  assignmentModal.registerTab('ee', {
    tabId: 'docentes_asignados',
    label: '👨‍🏫 Docentes',
    loadData: async (eeId) => {
      const res = await window.electronAPI?.obtenerDocentesEE?.(eeId);
      return res?.success ? res.data : [];
    },
    render: (data) => {
      if (!data?.length) return '<div class="empty-state">Sin docentes asignados</div>';
      return `
        <table class="data-table">
          <thead><tr><th>Código</th><th>Nombre</th><th>Rol</th><th>Periodo</th></tr></thead>
          <tbody>
            ${data.map(d => `
              <tr class="data-row">
                <td><strong>${d.codigo}</strong></td>
                <td>${d.nombre_completo}</td>
                <td>${d.rol_asignacion || 'Docente'}</td>
                <td>${d.periodo || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  });

  assignmentModal.registerTab('ee', {
    tabId: 'contenidos',
    label: '📋 Contenidos',
    loadData: async (eeId) => {
      const res = await window.electronAPI?.obtenerContenidosEE?.(eeId);
      return res?.success ? res.data : [];
    },
    render: (data) => {
      if (!data?.length) return '<div class="empty-state">Sin contenidos temáticos registrados</div>';
      return `
        <ol style="padding-left:20px; line-height:1.8">
          ${data.map((c, i) => `<li><strong>${c.titulo}</strong><br><small style="color:var(--text-muted)">${c.descripcion || ''}</small></li>`).join('')}
        </ol>
      `;
    }
  });

  console.log('✅ [app.js] Pestañas de asignaciones registradas');
}

// =======================================================
// INICIALIZACIÓN DOM
// =======================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar utilidades globales
  globalConfirm.init();
  registerAssignmentTabs(); // ✅ Registrar pestañas del modal de asignaciones
  
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

  // 2. Inicializar auth y callback de login
  auth.init();
  window.onLoginSuccess = () => navigate('home');

  // 3. Sidebar toggle
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

  // 4. Perfil dropdown
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

  // 5. Helpers globales para modales
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
  
  // ✅ Exponer assignmentModal globalmente para que los módulos lo usen
  window.assignmentModal = assignmentModal;
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
  window.__GES_TAO_MODULES__ = { 
    auth, 
    catalogos, 
    emision, 
    historial, 
    biblioteca,
    assignmentModal // ✅ Exponer para debug en dev
  };
  console.log('Ges-TAO: Módulos expuestos en window.__GES_TAO_MODULES__');
}

export { navigate, auth, catalogos, emision, historial, biblioteca, assignmentModal };

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