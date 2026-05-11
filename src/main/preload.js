const { contextBridge, ipcRenderer } = require('electron');

console.log('[PRELOAD] Script iniciado...');

if (!process.contextIsolated) {
  console.error('[PRELOAD] Error: contextIsolation debe estar activado.');
  throw new Error('Context Isolation fallo. Revisa main.js');
}

try {
  console.log('[PRELOAD] Exponiendo electronAPI...');
  
  contextBridge.exposeInMainWorld('electronAPI', {
    
    // ==========================================
    // 1. AUTENTICACIÓN
    // ==========================================
    loginUser: (creds) => {
      console.log('[PRELOAD] Enviando login para:', creds.username);
      return ipcRenderer.invoke('login-user', creds);
    },
    
    // ==========================================
    // 2. GESTIÓN DE DOCENTES
    // ==========================================
    guardarDocente: (datos) => {
      console.log('[PRELOAD] Guardando docente:', datos.nombres);
      return ipcRenderer.invoke('guardar-docente', datos);
    },
    
    listarDocentes: () => {
      console.log('[PRELOAD] Obteniendo lista de docentes...');
      return ipcRenderer.invoke('obtener-docentes');
    },

    eliminarDocente: (id) => {
      console.log('[PRELOAD] Eliminando docente ID:', id);
      return ipcRenderer.invoke('eliminar-docente', id);
    },
    
    // ==========================================
    // 3. EMISIÓN DE CONSTANCIAS
    // ==========================================
    obtenerDatosConstancia: () => {
      console.log('[PRELOAD] Solicitando datos maestros para constancias...');
      return ipcRenderer.invoke('obtener-datos-constancia');
    },

    guardarConstancia: (datos) => {
      console.log('[PRELOAD] Generando constancia para docente ID:', datos.docente_id);
      return ipcRenderer.invoke('guardar-constancia', datos);
    },

    // ==========================================
    // 4. BIBLIOTECA DE CONSTANCIAS
    // ==========================================
    obtenerBibliotecaConstancias: () => {
      console.log('[PRELOAD] Solicitando biblioteca de constancias...');
      return ipcRenderer.invoke('obtener-biblioteca-constancias');
    },

    abrirArchivoPDF: (ruta) => {
      console.log('[PRELOAD] Abriendo archivo PDF:', ruta);
      return ipcRenderer.invoke('abrir-archivo-pdf', ruta);
    },

    // ==========================================
    // 5. HISTORIAL Y AUDITORÍA
    // ==========================================
    obtenerHistorial: () => {
      console.log('[PRELOAD] Solicitando historial de auditoria...');
      return ipcRenderer.invoke('obtener-historial');
    },

    // ==========================================
    // 6. CATÁLOGOS ADICIONALES (EE, PERIODOS, PROGRAMAS)
    // ==========================================
    listarEE: () => {
      console.log('[PRELOAD] Obteniendo lista de EE...');
      return ipcRenderer.invoke('obtener-ee');
    },
    guardarEE: (datos) => {
      console.log('[PRELOAD] Guardando EE:', datos.nombre);
      return ipcRenderer.invoke('guardar-ee', datos);
    },
    
    listarPeriodos: () => {
      console.log('[PRELOAD] Obteniendo lista de periodos...');
      return ipcRenderer.invoke('obtener-periodos');
    },
    guardarPeriodo: (datos) => {
      console.log('[PRELOAD] Guardando periodo:', datos.clave);
      return ipcRenderer.invoke('guardar-periodo', datos);
    },
    
    listarProgramas: () => {
      console.log('[PRELOAD] Obteniendo lista de programas...');
      return ipcRenderer.invoke('obtener-programas');
    },
    guardarPrograma: (datos) => {
      console.log('[PRELOAD] Guardando programa:', datos.nombre);
      return ipcRenderer.invoke('guardar-programa', datos);
    },

    // ==========================================
    // 7. TIPOS DE CONSTANCIA (NUEVO)
    // ==========================================
    listarTiposConstancia: () => {
      console.log('[PRELOAD] Obteniendo lista de tipos de constancia...');
      return ipcRenderer.invoke('listar-tipos-constancia');
    },
    guardarTipoConstancia: (datos) => {
      console.log('[PRELOAD] Guardando tipo de constancia:', datos.nombre);
      return ipcRenderer.invoke('guardar-tipo-constancia', datos);
    },
    eliminarTipoConstancia: (id) => {
      console.log('[PRELOAD] Eliminando tipo de constancia ID:', id);
      return ipcRenderer.invoke('eliminar-tipo-constancia', id);
    },

    // ==========================================
    // 8. GESTIÓN DE ALUMNOS (NUEVO)
    // ==========================================
    listarAlumnos: () => {
      console.log('[PRELOAD] Obteniendo lista de alumnos...');
      return ipcRenderer.invoke('obtener-alumnos');
    },

    guardarAlumno: (datos) => {
      console.log('[PRELOAD] Guardando alumno:', datos.nombres);
      return ipcRenderer.invoke('guardar-alumno', datos);
    },

    eliminarAlumno: (id) => {
      console.log('[PRELOAD] Eliminando alumno ID:', id);
      return ipcRenderer.invoke('eliminar-alumno', id);
    },
  });
  
  console.log('[PRELOAD] electronAPI expuesto correctamente con todos los modulos.');
  
} catch (error) {
  console.error('[PRELOAD] Error fatal al exponer API:', error);
  throw error; 
}