// src/renderer/services/GeneracionService.js


import { CHANNELS } from '../utils/ipcChannels.js';

export default class GeneracionService {
  static async getAll() {
    try {
      const res = await window.electronAPI.listarGeneraciones?.();
      return res.success !== undefined ? res : { success: true, data: res };
    } catch (e) {
      return { success: false, error: 'Error al cargar generaciones.' };
    }
  }
  
  static async getDisponibles() {
    try {
      const res = await window.electronAPI.listarGeneraciones?.();
      const data = res.success !== undefined ? (res.data || res.rows) : res;
      const activas = (data || []).filter(g => g.estado === 'activa');
      return { success: true, data: activas };
    } catch (e) {
      return { success: false, error: 'Error al cargar generaciones disponibles.' };
    }
  }
  
  static async getSelectData() {
    try {
      // Este método requiere un handler específico en preload/main
      const res = await window.electronAPI.obtenerDatosSelectsGeneracion?.();
      return res?.success !== undefined ? res : { success: true, data: res };
    } catch (e) {
      return { success: false, error: 'Error al cargar datos para selects.' };
    }
  }
  
  static async save(payload) {
    try {
      const validation = GeneracionService._validate(payload);
      if (!validation.valid) return { success: false, error: validation.errors.join(', ') };
      
      const data = {
        id: payload.id || null,
        clave: payload.clave?.trim().toUpperCase(),
        nombre: payload.nombre?.trim(),
        plan_id: payload.plan_id ? parseInt(payload.plan_id, 10) : null,
        periodo_ingreso_id: payload.periodo_ingreso_id ? parseInt(payload.periodo_ingreso_id, 10) : null,
        estado: payload.estado || 'activa'
      };
      
      const res = await window.electronAPI.guardarGeneracion?.(data);
      return res?.success !== undefined ? res : { success: true };
    } catch (e) {
      return { success: false, error: 'Error al guardar generación.' };
    }
  }
  
  static formatForTable(g) {
    return {
      id: g.id, clave: g.clave, nombre: g.nombre,
      plan_clave: g.plan_clave || '-', plan_nombre: g.plan_nombre || '',
      periodo_clave: g.periodo_clave || '-', periodo_desc: g.periodo_desc || '',
      estado: g.estado, fecha_creacion: g.fecha_creacion
    };
  }
  static formatManyForTable(arr) { return arr.map(g => GeneracionService.formatForTable(g)); }
  
  static _validate(p) {
    const errors = [];
    if (!p.clave?.trim()) errors.push('Clave obligatoria');
    if (!p.nombre?.trim()) errors.push('Nombre obligatorio');
    if (!p.plan_id) errors.push('Plan obligatorio');
    if (!p.periodo_ingreso_id) errors.push('Periodo obligatorio');
    return { valid: errors.length === 0, errors };
  }
}