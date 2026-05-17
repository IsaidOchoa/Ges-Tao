// src/renderer/services/SemestreService.js
/**
 * Servicio para operaciones de Semestres (catálogo de orden académico).
 * 
 * @module SemestreService
 */

import { CHANNELS } from '../utils/ipcChannels.js';

export default class SemestreService {
  static async getAll() {
    try {
      const res = await window.electronAPI.listarSemestres?.();
      return res.success !== undefined ? res : { success: true, data: res };
    } catch (e) {
      return { success: false, error: 'Error al cargar semestres.' };
    }
  }
  
  static async getDisponibles() {
    try {
      const res = await window.electronAPI.listarSemestres?.();
      const data = res.success !== undefined ? (res.data || res.rows) : res;
      const activos = (data || []).filter(s => s.estado === 'activo');
      return { success: true, data: activos };
    } catch (e) {
      return { success: false, error: 'Error al cargar semestres disponibles.' };
    }
  }
  
  static async save(payload) {
    try {
      const validation = SemestreService._validate(payload);
      if (!validation.valid) return { success: false, error: validation.errors.join(', ') };
      
      const data = {
        id: payload.id || null,
        clave: payload.clave?.trim().toUpperCase(),
        nombre: payload.nombre?.trim(),
        orden: parseInt(payload.orden, 10),
        estado: payload.estado || 'activo'
      };
      
      const res = await window.electronAPI.guardarSemestre?.(data);
      return res?.success !== undefined ? res : { success: true };
    } catch (e) {
      return { success: false, error: 'Error al guardar semestre.' };
    }
  }
  
  static formatForTable(s) {
    return { id: s.id, clave: s.clave, nombre: s.nombre, orden: s.orden, estado: s.estado };
  }
  static formatManyForTable(arr) { return arr.map(s => SemestreService.formatForTable(s)); }
  
  static _validate(p) {
    const errors = [];
    if (!p.clave?.trim()) errors.push('Clave obligatoria');
    if (!p.nombre?.trim()) errors.push('Nombre obligatorio');
    const ord = parseInt(p.orden, 10);
    if (!ord || ord < 1 || ord > 14) errors.push('Orden entre 1 y 14');
    return { valid: errors.length === 0, errors };
  }
}