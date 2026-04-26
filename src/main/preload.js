const { contextBridge, ipcRenderer } = require('electron');

console.log('🛡️ [PRELOAD] Script iniciado...');

// Verificación de seguridad
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
    // 2. GESTIÓN DE DOCENTES (Antes Colaboradores)
    // ==========================================
    // Nota: Se renombra para coincidir con la tabla 'docentes' en la BD
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
    // 4. CATÁLOGOS ADICIONALES (Para futuro uso inmediato)
    // ==========================================
    listarPeriodos: () => {
      return ipcRenderer.invoke('obtener-periodos');
    },
    listarEE: () => {
      return ipcRenderer.invoke('obtener-ee');
    },
    listarProgramas: () => {
      return ipcRenderer.invoke('obtener-programas');
    }
  });
  
  console.log('✅ [PRELOAD] electronAPI expuesto correctamente con todos los módulos.');
  
} catch (error) {
  console.error('❌ [PRELOAD] Error fatal al exponer API:', error);
  throw error; 
}