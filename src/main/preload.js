const { contextBridge, ipcRenderer } = require("electron");

console.log("[PRELOAD] Script iniciado...");

if (!process.contextIsolated) {
  console.error("[PRELOAD] Error: contextIsolation debe estar activado.");
  throw new Error("Context Isolation fallo. Revisa main.js");
}

try {
  console.log("[PRELOAD] Exponiendo electronAPI...");

  contextBridge.exposeInMainWorld("electronAPI", {
    // ==========================================
    // 1. AUTENTICACIÓN
    // ==========================================
    loginUser: (creds) => {
      console.log("[PRELOAD] Enviando login para:", creds.username);
      return ipcRenderer.invoke("login-user", creds);
    },

    // ==========================================
    // 2. GESTIÓN DE DOCENTES
    // ==========================================
    guardarDocente: (datos) => {
      console.log("[PRELOAD] Guardando docente:", datos.nombres);
      return ipcRenderer.invoke("guardar-docente", datos);
    },

    listarDocentes: () => {
      console.log("[PRELOAD] Obteniendo lista de docentes...");
      return ipcRenderer.invoke("obtener-docentes");
    },

    eliminarDocente: (id) => {
      console.log("[PRELOAD] Eliminando docente ID:", id);
      return ipcRenderer.invoke("eliminar-docente", id);
    },

    // ==========================================
    // 3. EMISIÓN DE CONSTANCIAS
    // ==========================================
    obtenerDatosConstancia: () => {
      console.log("[PRELOAD] Solicitando datos maestros para constancias...");
      return ipcRenderer.invoke("obtener-datos-constancia");
    },

    guardarConstancia: (datos) => {
      console.log(
        "[PRELOAD] Generando constancia para docente ID:",
        datos.docente_id,
      );
      return ipcRenderer.invoke("guardar-constancia", datos);
    },
    obtenerDatosDocenteContexto: (params) =>
      ipcRenderer.invoke("obtener-datos-docente-contexto", params),
    generarConstanciaPDF: (payload) =>
      ipcRenderer.invoke("generar-constancia-pdf", payload),

    // ==========================================
    // 4. BIBLIOTECA DE CONSTANCIAS
    // ==========================================
    obtenerBibliotecaConstancias: () => {
      console.log("[PRELOAD] Solicitando biblioteca de constancias...");
      return ipcRenderer.invoke("obtener-biblioteca-constancias");
    },

    abrirArchivoPDF: (ruta) => {
      console.log("[PRELOAD] Abriendo archivo PDF:", ruta);
      return ipcRenderer.invoke("abrir-archivo-pdf", ruta);
    },

    // ==========================================
    // 5. HISTORIAL Y AUDITORÍA
    // ==========================================
    obtenerHistorial: () => {
      console.log("[PRELOAD] Solicitando historial de auditoria...");
      return ipcRenderer.invoke("obtener-historial");
    },

    // ==========================================
    // 6. CATÁLOGOS ADICIONALES (EE, PERIODOS, PROGRAMAS)
    // ==========================================
    listarEE: () => {
      console.log("[PRELOAD] Obteniendo lista de EE...");
      return ipcRenderer.invoke("obtener-ee");
    },
    guardarEE: (datos) => {
      console.log("[PRELOAD] Guardando EE:", datos.nombre);
      return ipcRenderer.invoke("guardar-ee", datos);
    },

    listarPeriodos: () => {
      console.log("[PRELOAD] Obteniendo lista de periodos...");
      return ipcRenderer.invoke("obtener-periodos");
    },
    guardarPeriodo: (datos) => {
      console.log("[PRELOAD] Guardando periodo:", datos.clave);
      return ipcRenderer.invoke("guardar-periodo", datos);
    },

    listarProgramas: () => {
      console.log("[PRELOAD] Obteniendo lista de programas...");
      return ipcRenderer.invoke("obtener-programas");
    },
    guardarPrograma: (datos) => {
      console.log("[PRELOAD] Guardando programa:", datos.nombre);
      return ipcRenderer.invoke("guardar-programa", datos);
    },

    // ==========================================
    // 7. TIPOS DE CONSTANCIA (NUEVO)
    // ==========================================
    listarTiposConstancia: () => {
      console.log("[PRELOAD] Obteniendo lista de tipos de constancia...");
      return ipcRenderer.invoke("listar-tipos-constancia");
    },
    guardarTipoConstancia: (datos) => {
      console.log("[PRELOAD] Guardando tipo de constancia:", datos.nombre);
      return ipcRenderer.invoke("guardar-tipo-constancia", datos);
    },
    eliminarTipoConstancia: (id) => {
      console.log("[PRELOAD] Eliminando tipo de constancia ID:", id);
      return ipcRenderer.invoke("eliminar-tipo-constancia", id);
    },

    // ==========================================
    // 8. GESTIÓN DE ALUMNOS (NUEVO)
    // ==========================================
    listarAlumnos: () => {
      console.log("[PRELOAD] Obteniendo lista de alumnos...");
      return ipcRenderer.invoke("obtener-alumnos");
    },

    guardarAlumno: (datos) => {
      console.log("[PRELOAD] Guardando alumno:", datos.nombres);
      return ipcRenderer.invoke("guardar-alumno", datos);
    },

    eliminarAlumno: (id) => {
      console.log("[PRELOAD] Eliminando alumno ID:", id);
      return ipcRenderer.invoke("eliminar-alumno", id);
    },

    // ==========================================
    // 9. PLANES DE ESTUDIO (NUEVO)
    // ==========================================
    listarPlanes: () => {
      console.log("[PRELOAD] Obteniendo lista de planes de estudio...");
      return ipcRenderer.invoke("obtener-planes");
    },
    guardarPlan: (datos) => {
      console.log("[PRELOAD] Guardando plan:", datos.clave);
      return ipcRenderer.invoke("guardar-plan", datos);
    },
    cambiarEstadoPlan: (id, estado) => {
      console.log(`[PRELOAD] Cambiando estado de plan ${id} a ${estado}`);
      return ipcRenderer.invoke("cambiar-estado-plan", id, estado);
    },
    eliminarPlan: (id) => {
      console.log("[PRELOAD] Eliminando plan ID:", id);
      return ipcRenderer.invoke("eliminar-plan", id);
    },

    // ==========================================
    // 10. SEMESTRES (NUEVO)
    // ==========================================
    listarSemestres: () => {
      console.log("[PRELOAD] Obteniendo lista de semestres...");
      return ipcRenderer.invoke("obtener-semestres");
    },
    guardarSemestre: (datos) => {
      console.log("[PRELOAD] Guardando semestre:", datos.clave);
      return ipcRenderer.invoke("guardar-semestre", datos);
    },

    // ==========================================
    // 11. GENERACIONES (NUEVO)
    // ==========================================
    listarGeneraciones: () => {
      console.log("[PRELOAD] Obteniendo lista de generaciones...");
      return ipcRenderer.invoke("obtener-generaciones");
    },
    guardarGeneracion: (datos) => {
      console.log("[PRELOAD] Guardando generación:", datos.clave);
      return ipcRenderer.invoke("guardar-generacion", datos);
    },
    obtenerDatosSelectsGeneracion: () => {
      console.log("[PRELOAD] Obteniendo datos para selects de generación...");
      return ipcRenderer.invoke("obtener-datos-selects-generacion");
    },

    listarPeriodosSelect: () => ipcRenderer.invoke("listarPeriodosSelect"),
    listarDocentesSelect: (params) =>
      ipcRenderer.invoke("listarDocentesSelect", params),
    listarAlumnosDisponibles: (params) =>
      ipcRenderer.invoke("listarAlumnosDisponibles", params),
    listarEEDisponibles: (params) =>
      ipcRenderer.invoke("listarEEDisponibles", params),

    // Tutoría
    asignarTutor: (data) => ipcRenderer.invoke("asignarTutor", data),
    removerTutor: (data) => ipcRenderer.invoke("removerTutor", data),
    obtenerTutorados: (params) =>
      ipcRenderer.invoke("obtenerTutorados", params),

    // Docente-EE
    asignarEEAdocente: (data) => ipcRenderer.invoke("asignarEEAdocente", data),
    removerDocenteEE: (data) => ipcRenderer.invoke("removerDocenteEE", data),
    obtenerEEDelDocente: (params) =>
      ipcRenderer.invoke("obtenerEEDelDocente", params),

    // Gestión de Entidad-Periodo (usando tablas existentes)
    obtenerPeriodosDeEntidad: (params) =>
      ipcRenderer.invoke("obtener-periodos-de-entidad", params),
    agregarEntidadAPeriodo: (params) =>
      ipcRenderer.invoke("agregar-entidad-a-periodo", params),
    removerEntidadDePeriodo: (params) =>
      ipcRenderer.invoke("remover-entidad-de-periodo", params),

    // CONFIGURACIÓN
    obtenerConfig: () => ipcRenderer.invoke("obtener-config"),
    guardarConfig: (data) => ipcRenderer.invoke("guardar-config", data),
    seleccionarDirectorio: () => ipcRenderer.invoke("seleccionar-directorio"),
  });

  console.log(
    "[PRELOAD] electronAPI expuesto correctamente con todos los modulos.",
  );
} catch (error) {
  console.error("[PRELOAD] Error fatal al exponer API:", error);
  throw error;
}
