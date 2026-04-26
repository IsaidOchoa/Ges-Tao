// Verificar sesión al cargar
document.addEventListener('DOMContentLoaded', () => {
  const session = sessionStorage.getItem('userSession');
  
  if (!session) {
    window.location.href = 'index.html'; // Redirigir si no hay login
    return;
  }

  const user = JSON.parse(session);
  document.getElementById('userNameDisplay').innerText = user.nombre;
  document.getElementById('userRoleDisplay').innerText = user.rol;

  // Configurar Logout
  document.getElementById('btnLogout').addEventListener('click', () => {
    sessionStorage.removeItem('userSession');
    window.location.href = 'index.html';
  });
});

// Función simple de navegación (Oculta/Muestra Divs)
function cargarVista(vistaName) {
  // Ocultar todas las vistas
  document.querySelectorAll('.vista').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  // Mostrar la seleccionada
  const target = document.getElementById(`vista-${vistaName}`);
  if (target) {
    target.classList.remove('hidden');
    document.getElementById('pageTitle').innerText = vistaName.charAt(0).toUpperCase() + vistaName.slice(1);
  }

  // Activar menú
  // (Lógica simple para encontrar el link clickeado y activarlo, omitted for brevity)
}