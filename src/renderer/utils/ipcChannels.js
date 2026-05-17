// src/renderer/utils/ipcChannels.js
/**
 * Catálogo central de canales IPC para comunicación renderer ↔ main
 * Evita hardcodear strings en múltiples archivos y facilita refactorings.
 * 
 * @module ipcChannels
 */

export const CHANNELS = {
  // === AUTENTICACIÓN ===
  AUTH: {
    LOGIN: 'auth:login'
  },
  
  // === DOCENTES ===
  DOCENTE: {
    GET_ALL: 'obtener-docentes',
    SAVE: 'guardar-docente',
    DELETE: 'eliminar-docente'
  },
  
  // === ALUMNOS ===
  ALUMNO: {
    GET_ALL: 'obtener-alumnos',
    SAVE: 'guardar-alumno'
  },
  
  // === EXPERIENCIAS EDUCATIVAS ===
  EE: {
    GET_ALL: 'obtener-ee',
    SAVE: 'guardar-ee'
  },
  
  // === PERIODOS ===
  PERIODO: {
    GET_ALL: 'obtener-periodos',
    GET_DISPONIBLES: 'obtener-periodos-disponibles',
    SAVE: 'guardar-periodo'
  },
  
  // === PLANES DE ESTUDIO ===
  PLAN: {
    GET_ALL: 'obtener-planes',
    GET_DISPONIBLES: 'obtener-planes-disponibles',
    SAVE: 'guardar-plan',
    TOGGLE_ESTADO: 'cambiar-estado-plan',
    DELETE: 'eliminar-plan'
  },
  
  // === SEMESTRES ===
  SEMESTRE: {
    GET_ALL: 'obtener-semestres',
    GET_DISPONIBLES: 'obtener-semestres-disponibles',
    SAVE: 'guardar-semestre'
  },
  
  // === GENERACIONES ===
  GENERACION: {
    GET_ALL: 'obtener-generaciones',
    GET_DISPONIBLES: 'obtener-generaciones-disponibles',
    GET_SELECT_DATA: 'obtener-datos-selects-generacion',
    SAVE: 'guardar-generacion'
  },
  
  // === TIPOS DE CONSTANCIA ===
  TIPO_CONSTANCIA: {
    GET_ALL: 'obtener-tipos-constancia'
  },
  
  // === CONSTANCIAS ===
  CONSTANCIA: {
    GET_ALL: 'obtener-constancias',
    SAVE: 'guardar-constancia'
  },
  
  // === HISTORIAL ===
  HISTORIAL: {
    GET_ALL: 'obtener-historial'
  },
  
  // === REPORTES ===
  REPORTE: {
    GET_ESTADISTICAS: 'obtener-estadisticas'
  }
};

// Helper para debug: listar todos los canales registrados
export const listChannels = () => {
  console.log('📡 Canales IPC registrados:', Object.keys(CHANNELS));
  return CHANNELS;
};