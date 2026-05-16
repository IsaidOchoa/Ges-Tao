// src/renderer/services/PlanService.js
// Servicio para operaciones de planes de estudio
// Extiende BaseService para patrón consistente

import BaseService from './BaseService.js';

export default class PlanService extends BaseService {
  static RESOURCE = 'planes';
  
  /**
   * Obtiene todos los planes (para tablas de consulta)
   */
  static async getAll() {
    return this._fetch(`${this.RESOURCE}:getAll`);
  }
  
  /**
   * Obtiene planes disponibles para selects (solo activos)
   */
  static async getDisponibles() {
    return this._fetch(`${this.RESOURCE}:getDisponibles`);
  }
  
  /**
   * Crea un nuevo plan
   */
  static async create(payload) {
    return this._fetch(`${this.RESOURCE}:create`, payload);
  }
  
  /**
   * Actualiza un plan existente
   */
  static async update(payload) {
    return this._fetch(`${this.RESOURCE}:update`, payload);
  }
  
  /**
   * Cambia el estado de un plan
   */
  static async toggleEstado(id, estado) {
    return this._fetch(`${this.RESOURCE}:toggleEstado`, { id, estado });
  }
  
  /**
   * Formatea un plan para visualización en tabla
   */
  static formatForTable(plan) {
    return {
      id: plan.id,
      clave: plan.clave,
      nombre: plan.nombre,
      nivel: this._formatNivel(plan.nivel),
      estado: plan.estado,
      fecha_creacion: plan.fecha_creacion
    };
  }
  
  /**
   * Mapeo visual de niveles académicos
   */
  static _formatNivel(nivel) {
    const map = {
      licenciatura: '🎓 Licenciatura',
      maestria: '🎓 Maestría', 
      doctorado: '🎓 Doctorado',
      especialidad: '🎓 Especialidad'
    };
    return map[nivel] || nivel;
  }
}