const { contextBridge, ipcRenderer } = require('electron');

console.log('🛡️ [PRELOAD] Script iniciado...');

if (!process.contextIsolated) {
  console.error('❌ [PRELOAD] Error: contextIsolation debe estar activado.');
  throw new Error('Context Isolation falló. Revisa main.js');
}

try {
  console.log('🔨 [PRELOAD] Exponiendo electronAPI...');
  
  contextBridge.exposeInMainWorld('electronAPI', {
    
    // ==========================================
    // 1. AUTENTICACIÓN
    // ==========================================
    loginUser: (creds) => {
      console.log('📡 [PRELOAD] Enviando login para:', creds.username);
      return ipcRenderer.invoke('login-user', creds);
    },
    
    // ==========================================
    // 2. GESTIÓN DE DOCENTES
    // ==========================================
    guardarDocente: (datos) => {
      console.log('📡 [PRELOAD] Guardando docente:', datos.nombres);
      return ipcRenderer.invoke('guardar-docente', datos);
    },
    
    listarDocentes: () => {
      console.log('📡 [PRELOAD] Obteniendo lista de docentes...');
      return ipcRenderer.invoke('obtener-docentes');
    },

    eliminarDocente: (id) => {
      console.log('📡 [PRELOAD] Eliminando docente ID:', id);
      return ipcRenderer.invoke('eliminar-docente', id);
    },
    
    // ==========================================
    // 3. EMISIÓN DE CONSTANCIAS
    // ==========================================
    obtenerDatosConstancia: () => {
      console.log('📡 [PRELOAD] Solicitando datos maestros para constancias...');
      return ipcRenderer.invoke('obtener-datos-constancia');
    },

    guardarConstancia: (datos) => {
      console.log('📡 [PRELOAD] Generando constancia para docente ID:', datos.docente_id);
      return ipcRenderer.invoke('guardar-constancia', datos);
    },

    // ==========================================
    // 4. BIBLIOTECA DE CONSTANCIAS (NUEVO)
    // ==========================================
    obtenerBibliotecaConstancias: () => {
      console.log('📡 [PRELOAD] Solicitando biblioteca de constancias...');
      return ipcRenderer.invoke('obtener-biblioteca-constancias');
    },

    abrirArchivoPDF: (ruta) => {
      console.log('📡 [PRELOAD] Abriendo archivo PDF:', ruta);
      return ipcRenderer.invoke('abrir-archivo-pdf', ruta);
    },

    // ==========================================
    // 5. HISTORIAL Y AUDITORÍA
    // ==========================================
    obtenerHistorial: () => {
      console.log('📡 [PRELOAD] Solicitando historial de auditoría...');
      return ipcRenderer.invoke('obtener-historial');
    },

    // ==========================================
    // 6. CATÁLOGOS ADICIONALES (EE, PERIODOS, PROGRAMAS)
    // ==========================================
    listarEE: () => ipcRenderer.invoke('obtener-ee'),
    guardarEE: (datos) => ipcRenderer.invoke('guardar-ee', datos),
    
    listarPeriodos: () => ipcRenderer.invoke('obtener-periodos'),
    guardarPeriodo: (datos) => ipcRenderer.invoke('guardar-periodo', datos),
    
    listarProgramas: () => ipcRenderer.invoke('obtener-programas'),
    guardarPrograma: (datos) => ipcRenderer.invoke('guardar-programa', datos),
  });
  
  console.log('✅ [PRELOAD] electronAPI expuesto correctamente con todos los módulos.');
  
} catch (error) {
  console.error('❌ [PRELOAD] Error fatal al exponer API:', error);
  throw error; 
}