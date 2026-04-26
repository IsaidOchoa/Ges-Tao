import '../styles/main.css';

// Imports de vistas
import homeHtml from '../views/home.html';
import docentesHtml from '../views/catalogos.html';
import emisionHtml from '../views/emision.html';
import historialHtml from '../views/historial.html';
import configuracionHtml from '../views/configuracion.html';
import reportesHtml from '../views/reportes.html';
import perfilHtml from '../views/perfil.html';

// Mapa de vistas
const views = {
  'home': homeHtml,
  'catalogos': docentesHtml, 
  'configuracion': configuracionHtml,
  'perfil': perfilHtml,
  'reportes': reportesHtml || '<div class="card"><h3>Reportes</h3><p>En construcción...</p></div>',
  'emision': emisionHtml || '<div class="card"><h3>Emitir</h3><p>En construcción...</p></div>',
  'historial': historialHtml || '<div class="card"><h3>Historial</h3><p>En construcción...</p></div>',
};

let currentUser = null;
let loaderElement = null;

// =======================================================
// 1. FUNCIONES GLOBALES DEL LOADER
// =======================================================

window.showLoading = (message, subMessage = "Procesando...") => {
  if (loaderElement) loaderElement.remove();

  loaderElement = document.createElement('div');
  loaderElement.className = 'loading-overlay fade-in-up';
  loaderElement.innerHTML = `
    <div class="spinner"></div>
    <div class="loading-text">${message}</div>
    ${subMessage ? `<div class="loading-subtext">${subMessage}</div>` : ''}
  `;
  
  document.body.appendChild(loaderElement);
};

window.hideLoading = () => {
  if (loaderElement) {
    loaderElement.classList.add('hidden');
    setTimeout(() => {
      if (loaderElement) {
        loaderElement.remove();
        loaderElement = null;
      }
    }, 300);
  }
};

// =======================================================
// 2. FUNCIÓN DE ESTADO DE CONEXIÓN
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

// =======================================================
// 3. FUNCIÓN DE MODO OSCURO
// =======================================================

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
  
  // --- INICIALIZAR CONEXIÓN ---
  updateConnectionStatus();
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  // --- INICIALIZAR MODO OSCURO ---
  const savedDarkMode = localStorage.getItem('gesTao_darkMode') === 'true';
  const darkModeToggle = document.getElementById('toggle-dark-mode');
  
  applyDarkMode(savedDarkMode);
  
  if (darkModeToggle) {
    darkModeToggle.checked = savedDarkMode;
    darkModeToggle.addEventListener('change', (e) => {
      applyDarkMode(e.target.checked);
    });
  }

  // --- LOGIN ---
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const btn = document.getElementById('btnLogin');
      const errorMsg = document.getElementById('errorMsg');

      showLoading("Verificando credenciales...", "Conectando con la base de datos segura");

      btn.disabled = true;
      btn.innerText = 'Verificando...';
      errorMsg.classList.add('hidden');

      try {
        await new Promise(r => setTimeout(r, 1500)); // Simulación temporal

        const result = await window.electronAPI.loginUser({ username, password });
        
        hideLoading();

        if (result.success) {
          currentUser = result.user;
          switchToDashboard();
        } else {
          errorMsg.innerText = result.error;
          errorMsg.classList.remove('hidden');
          btn.disabled = false;
          btn.innerText = 'Ingresar';
        }
      } catch (err) {
        hideLoading();
        console.error(err);
        errorMsg.innerText = "Error de conexión con el sistema.";
        errorMsg.classList.remove('hidden');
        btn.disabled = false;
        btn.innerText = 'Ingresar';
      }
    });
  }

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

  // Funciones globales
  window.toggleProfileMenu = () => {
    if(dropdown) dropdown.classList.add('hidden');
  };
  
  window.doLogout = () => {
    currentUser = null;
    switchToLogin();
  };
});

// =======================================================
// 5. FUNCIONES DE NAVEGACIÓN Y VISTAS
// =======================================================

function switchToDashboard() {
  const loginView = document.getElementById('view-login');
  const dashboardView = document.getElementById('view-dashboard');

  if (loginView) loginView.classList.add('hidden');
  
  if (dashboardView) {
    dashboardView.classList.remove('hidden');
    
    setTimeout(() => {
      if (currentUser) {
        const userNameDisplay = document.getElementById('userNameDisplay');
        const userRoleDisplay = document.getElementById('userRoleDisplay');
        const dropUserName = document.getElementById('dropUserName');
        const dropUserRole = document.getElementById('dropUserRole');

        if (userNameDisplay) userNameDisplay.innerText = currentUser.nombre;
        if (userRoleDisplay) userRoleDisplay.innerText = currentUser.rol || 'Administrador';
        if (dropUserName) dropUserName.innerText = currentUser.nombre;
        if (dropUserRole) dropUserRole.innerText = currentUser.rol || 'Administrador';
        
        sessionStorage.setItem('userSession', JSON.stringify(currentUser));
      }
      navigate('home');
    }, 150);
  }
}

function switchToLogin() {
  document.getElementById('view-dashboard').classList.add('hidden');
  document.getElementById('view-login').classList.remove('hidden');
  document.getElementById('loginForm').reset();
  document.getElementById('errorMsg').classList.add('hidden');
  document.getElementById('btnLogin').disabled = false;
  document.getElementById('btnLogin').innerText = 'Ingresar';
  sessionStorage.removeItem('userSession');
  if(document.getElementById('profile-dropdown')) {
    document.getElementById('profile-dropdown').classList.add('hidden');
  }
}

async function navigate(viewName) {
  const contentDiv = document.getElementById('content-area');
  const pageTitle = document.getElementById('pageTitle');
  
  contentDiv.style.opacity = '0.5';
  contentDiv.style.pointerEvents = 'none';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-item[onclick="navigate('${viewName}')"]`);
  if(activeLink) activeLink.classList.add('active');

  const dropdown = document.getElementById('profile-dropdown');
  if(dropdown) dropdown.classList.add('hidden');

  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const htmlContent = views[viewName];
    if (!htmlContent) throw new Error(`Vista '${viewName}' no encontrada`);
    
    contentDiv.innerHTML = htmlContent;
    
    const titles = {
      'home': 'Panel Principal',
      'catalogos': 'Gestión de Catálogos',
      'configuracion': 'Configuración del Sistema',
      'perfil': 'Mi Perfil',
      'reportes': 'Reportes Estadísticos',
      'emision': 'Emisión de Constancias',
      'historial': 'Historial y Búsqueda'
    };
    pageTitle.innerText = titles[viewName] || 'Ges-TAO';

    // Inicializar vista específica si es necesario
    if (viewName === 'catalogos') {
      setTimeout(initCatalogosView, 10);
    }
    
    if (viewName === 'configuracion') {
      const darkModeToggle = document.getElementById('toggle-dark-mode');
      const isDark = localStorage.getItem('gesTao_darkMode') === 'true';
      if (darkModeToggle) {
        darkModeToggle.checked = isDark;
        darkModeToggle.onchange = (e) => applyDarkMode(e.target.checked);
      }
    }

  } catch (error) {
    console.error(error);
    contentDiv.innerHTML = `<div class="card error"><h4>Error</h4><p>${error.message}</p></div>`;
  } finally {
    contentDiv.style.opacity = '1';
    contentDiv.style.pointerEvents = 'auto';
  }
}

// =======================================================
// 6. LÓGICA ESPECÍFICA PARA LA VISTA DE CATÁLOGOS (COMPLETA)
// =======================================================

// Variables globales para almacenar datos
let listaDocentesBD = [];
let listaEE = [];
let listaPeriodos = [];
let listaProgramas = [];

// Función Principal de Inicialización
async function initCatalogosView() {
  const tabsContainer = document.querySelector('.tabs-container');
  if (!tabsContainer) return; 

  console.log('✅ Inicializando Catálogos Completos...');

  // --- LÓGICA CORREGIDA DE PESTAÑAS ---
  
  // 1. Seleccionamos todos los botones y contenidos actuales
  let tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const tabContents = document.querySelectorAll('.tab-content');

  // 2. Iteramos sobre ellos para asignar eventos
  tabButtons.forEach(btn => {
    // Clonamos para eliminar listeners previos (evita duplicados si recargas la vista)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // Actualizamos la referencia en el array para que apunte al nuevo botón
    // Esto es clave para que el "limpiar" funcione después
    const index = tabButtons.indexOf(btn);
    tabButtons[index] = newBtn;

    newBtn.addEventListener('click', () => {
      // A. Recorremos el array ACTUALIZADO de botones para quitar 'active' a TODOS
      tabButtons.forEach(b => b.classList.remove('active'));
      
      // B. Quitamos 'active' a todos los contenidos
      tabContents.forEach(c => c.classList.remove('active'));

      // C. Activamos SOLO el botón clickeado (newBtn)
      newBtn.classList.add('active');

      // D. Mostramos el contenido correspondiente
      const targetId = newBtn.id.replace('btn-', ''); 
      const targetContent = document.getElementById(targetId);
      
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
  // ------------------------------------

  // Cargar todas las listas en paralelo
  await Promise.all([
    cargarDocentes(),
    cargarEE(),
    cargarPeriodos(),
    cargarProgramas()
  ]);
}

// --- A. DOCENTES ---
async function cargarDocentes() {
  const tbody = document.getElementById('tabla-docentes-body');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';
  try {
    const resp = await window.electronAPI.listarDocentes();
    if(resp.success) {
      listaDocentesBD = resp.data;
      renderizarTablaDocentes(listaDocentesBD);
      configurarBuscador('buscador-docentes', listaDocentesBD, renderizarTablaDocentes, ['codigo', 'nombres', 'apellido_paterno', 'correo_contacto']);
      configurarModalDocente();
    } else {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Error: ${resp.error}</td></tr>`;
    }
  } catch(e) { console.error(e); tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error de conexión</td></tr>'; }
}

function renderizarTablaDocentes(datos) {
  const tbody = document.getElementById('tabla-docentes-body');
  if(!tbody) return;
  tbody.innerHTML = '';
  if(!datos || !datos.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Sin registros</td></tr>'; return; }
  
  datos.forEach(d => {
    const nombre = `${d.apellido_paterno} ${d.apellido_materno||''} ${d.nombres}`.trim();
    const badge = d.estado === 'activo' ? 'badge-success' : 'badge-danger';
    tbody.innerHTML += `<tr>
      <td><strong>${d.codigo}</strong></td>
      <td>${nombre}</td>
      <td>${d.correo_contacto||'-'}</td>
      <td><span class="badge ${badge}">${d.estado}</span></td>
      <td style="text-align:right"><button class="btn btn-sm btn-outline text-danger"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`;
  });
}

function configurarModalDocente() {
  const btn = document.getElementById('btn-nuevo-docente');
  const modal = document.getElementById('modal-docente');
  const btnSave = document.getElementById('btn-guardar-docente');
  if(!btn || !modal) return;
  
  btn.onclick = () => { document.getElementById('form-docente').reset(); modal.classList.remove('hidden'); };
  document.getElementById('btn-cerrar-modal').onclick = () => modal.classList.add('hidden');
  document.getElementById('btn-cancelar-modal').onclick = () => modal.classList.add('hidden');
  
  if(btnSave) {
    // Clonar para evitar listeners duplicados
    const newBtn = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtn, btnSave);
    
    newBtn.onclick = async () => {
      const datos = {
        codigo: document.getElementById('doc-codigo').value,
        apellido_paterno: document.getElementById('doc-ap-paterno').value,
        apellido_materno: document.getElementById('doc-ap-materno').value,
        nombres: document.getElementById('doc-nombres').value,
        correo_contacto: document.getElementById('doc-correo').value,
        telefono_contacto: document.getElementById('doc-telefono').value,
        nivel_academico: document.getElementById('doc-nivel').value,
        estado: document.getElementById('doc-estado').value
      };
      if(!datos.codigo || !datos.apellido_paterno || !datos.nombres) return alert('Faltan campos obligatorios (Código, Ap. Paterno, Nombres)');
      
      const res = await window.electronAPI.guardarDocente(datos);
      if(res.success) { modal.classList.add('hidden'); cargarDocentes(); alert('Docente guardado correctamente'); }
      else alert('Error: '+res.error);
    };
  }
}

// --- B. FUNCIONES GENÉRICAS DE UTILIDAD ---

// Renderizador genérico para tablas simples
function renderizarTablaSimple(tbodyId, datos, columnsMap) {
  const tbody = document.getElementById(tbodyId);
  if(!tbody) return;
  tbody.innerHTML = '';
  if(!datos || !datos.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Sin registros</td></tr>'; return; }
  
  datos.forEach(row => {
    let html = '<tr>';
    columnsMap.forEach(col => {
      let val = row[col.key];
      if(col.badge) {
        const cls = ['activa','activo','vigente','abierto'].includes(val) ? 'badge-success' : 'badge-danger';
        html += `<td><span class="badge ${cls}">${val}</span></td>`;
      } else if(col.date) {
        html += `<td>${val ? new Date(val).toLocaleDateString('es-MX') : '-'}</td>`;
      } else {
        html += `<td>${val || '-'}</td>`;
      }
    });
    html += `<td style="text-align:right"><button class="btn btn-sm btn-outline text-danger"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    tbody.innerHTML += html;
  });
}

// Configurador genérico de buscadores
function configurarBuscador(inputId, dataList, renderFn, searchKeys) {
  const input = document.getElementById(inputId);
  if(!input) return;
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  
  newInput.addEventListener('input', (e) => {
    const txt = e.target.value.toLowerCase();
    const filtered = dataList.filter(item => 
      searchKeys.some(key => (item[key] || '').toString().toLowerCase().includes(txt))
    );
    renderFn(filtered);
  });
}

// Helpers globales para modales (usados desde HTML onclick)
window.abrirModal = (id) => {
  const m = document.getElementById(id);
  if(m) {
    m.classList.remove('hidden');
    const form = m.querySelector('form');
    if(form) form.reset();
  }
};
window.cerrarModal = (id) => {
  const m = document.getElementById(id);
  if(m) m.classList.add('hidden');
};

// --- C. EXPERIENCIAS EDUCATIVAS (EE) ---
async function cargarEE() {
  const resp = await window.electronAPI.listarEE();
  if(resp.success) {
    listaEE = resp.data;
    const cols = [
      {key:'clave_ee'}, {key:'nombre'}, {key:'tipo'}, {key:'creditos'}, {key:'estado', badge:true}
    ];
    renderizarTablaSimple('tabla-ee-body', listaEE, cols);
    configurarBuscador('buscador-ee', listaEE, (d)=>renderizarTablaSimple('tabla-ee-body', d, cols), ['clave_ee', 'nombre', 'tipo']);
  }
}

window.guardarEE = async () => {
  const datos = {
    clave_ee: document.getElementById('ee-clave').value,
    nombre: document.getElementById('ee-nombre').value,
    tipo: document.getElementById('ee-tipo').value,
    creditos: document.getElementById('ee-creditos').value,
    horas_teoria: document.getElementById('ee-h-teoria').value,
    horas_practica: document.getElementById('ee-h-practica').value,
    programa_academico: document.getElementById('ee-programa').value,
    estado: document.getElementById('ee-estado').value
  };
  if(!datos.clave_ee || !datos.nombre) return alert('Faltan datos obligatorios');
  const res = await window.electronAPI.guardarEE(datos);
  if(res.success) { window.cerrarModal('modal-ee'); cargarEE(); alert('EE Guardada correctamente'); }
  else alert('Error: '+res.error);
};

// --- D. PERIODOS ESCOLARES ---
async function cargarPeriodos() {
  const resp = await window.electronAPI.listarPeriodos();
  if(resp.success) {
    listaPeriodos = resp.data;
    const cols = [
      {key:'clave'}, {key:'descripcion'}, {key:'fecha_inicio', date:true}, {key:'fecha_fin', date:true}, {key:'estado', badge:true}
    ];
    renderizarTablaSimple('tabla-periodos-body', listaPeriodos, cols);
    configurarBuscador('buscador-periodos', listaPeriodos, (d)=>renderizarTablaSimple('tabla-periodos-body', d, cols), ['clave', 'descripcion']);
  }
}

window.guardarPeriodo = async () => {
  const datos = {
    clave: document.getElementById('per-clave').value,
    descripcion: document.getElementById('per-desc').value,
    fecha_inicio: document.getElementById('per-inicio').value,
    fecha_fin: document.getElementById('per-fin').value,
    estado: document.getElementById('per-estado').value
  };
  if(!datos.clave || !datos.fecha_inicio) return alert('Faltan datos obligatorios');
  const res = await window.electronAPI.guardarPeriodo(datos);
  if(res.success) { window.cerrarModal('modal-periodo'); cargarPeriodos(); alert('Periodo Guardado correctamente'); }
  else alert('Error: '+res.error);
};

// --- E. PROGRAMAS INSTITUCIONALES ---
async function cargarProgramas() {
  const resp = await window.electronAPI.listarProgramas();
  if(resp.success) {
    listaProgramas = resp.data;
    const cols = [
      {key:'nombre'}, {key:'responsable'}, {key:'fecha_registro', date:true}, {key:'estado', badge:true}
    ];
    renderizarTablaSimple('tabla-programas-body', listaProgramas, cols);
    configurarBuscador('buscador-programas', listaProgramas, (d)=>renderizarTablaSimple('tabla-programas-body', d, cols), ['nombre', 'responsable']);
  }
}

window.guardarPrograma = async () => {
  const datos = {
    nombre: document.getElementById('prog-nombre').value,
    descripcion: document.getElementById('prog-desc').value,
    responsable: document.getElementById('prog-resp').value,
    fecha_registro: document.getElementById('prog-fecha').value || new Date().toISOString().split('T')[0],
    estado: document.getElementById('prog-estado').value
  };
  if(!datos.nombre) return alert('Faltan datos obligatorios');
  const res = await window.electronAPI.guardarPrograma(datos);
  if(res.success) { window.cerrarModal('modal-programa'); cargarProgramas(); alert('Programa Guardado correctamente'); }
  else alert('Error: '+res.error);
};

// Exportar navigate globalmente
window.navigate = navigate;