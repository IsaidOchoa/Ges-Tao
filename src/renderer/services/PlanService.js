// src/renderer/services/PlanService.js
/**
 * Servicio para operaciones de Planes de Estudio.
 * Usa window.electronAPI con métodos nombrados (patrón Ges-TAO).
 * 
 * @module PlanService
 */

export default class PlanService {
  
  static async getAll() {
    try {
      if (!window.electronAPI?.listarPlanes) {
        console.warn('[PlanService] listarPlanes no disponible');
        return { success: false, error: 'API no inicializada' };
      }
      const res = await window.electronAPI.listarPlanes();
      // Normalizar respuesta: algunos handlers retornan {success, data}, otros directo el array
      return res.success !== undefined ? res : { success: true, data: res };
    } catch (error) {
      console.error('[PlanService] Error en getAll:', error);
      return { success: false, error: 'Error de conexión al cargar planes.' };
    }
  }
  
  static async getDisponibles() {
    try {
      // Si no tienes un handler específico para "disponibles", reusamos listarPlanes y filtramos después
      const res = await window.electronAPI.listarPlanes?.();
      if (!res) return { success: false, error: 'API no disponible' };
      
      const data = res.success !== undefined ? (res.data || res.rows) : res;
      const activos = (data || []).filter(p => p.estado === 'activo');
      
      return { success: true, data: activos };
    } catch (error) {
      console.error('[PlanService] Error en getDisponibles:', error);
      return { success: false, error: 'Error al cargar planes disponibles.' };
    }
  }
  
  static async save(payload) {
    try {
      const validation = PlanService._validate(payload);
      if (!validation.valid) {
        return { success: false, error: validation.errors.join(', ') };
      }
      
      const dataToSend = PlanService._parseForBackend(payload);
      const res = await window.electronAPI.guardarPlan?.(dataToSend);
      
      return res?.success !== undefined ? res : { success: true, message: 'Plan guardado' };
    } catch (error) {
      console.error('[PlanService] Error en save:', error);
      return { success: false, error: 'Error de conexión al guardar.' };
    }
  }
  
  static async toggleEstado(id, nuevoEstado) {
    try {
      const res = await window.electronAPI.cambiarEstadoPlan?.(id, nuevoEstado);
      return res?.success !== undefined ? res : { success: true };
    } catch (error) {
      console.error('[PlanService] Error en toggleEstado:', error);
      return { success: false, error: 'Error al actualizar estado.' };
    }
  }
  
  static async delete(id) {
    try {
      const res = await window.electronAPI.eliminarPlan?.(id);
      return res?.success !== undefined ? res : { success: true };
    } catch (error) {
      console.error('[PlanService] Error en delete:', error);
      return { success: false, error: 'Error al eliminar plan.' };
    }
  }
  
  // =======================================================
  // UTILIDADES DE TRANSFORMACIÓN (sin dependencias externas)
  // =======================================================
  
  static formatForTable(plan) {
    return {
      id: plan.id,
      clave: plan.clave,
      nombre: plan.nombre,
      nivel: PlanService._formatNivel(plan.nivel),
      estado: plan.estado,
      fecha_creacion: plan.fecha_creacion
    };
  }
  
  static formatManyForTable(planes) {
    return planes.map(plan => PlanService.formatForTable(plan));
  }
  
  static _parseForBackend(payload) {
    return {
      id: payload.id || null,
      clave: payload.clave?.trim().toUpperCase() || '',
      nombre: payload.nombre?.trim() || '',
      nivel: payload.nivel || '',
      estado: payload.estado || 'activo'
    };
  }
  
  static _validate(payload) {
    const errors = [];
    if (!payload.clave?.trim()) errors.push('La clave del plan es obligatoria');
    if (payload.clave?.trim().length < 3) errors.push('La clave debe tener al menos 3 caracteres');
    if (!payload.nombre?.trim()) errors.push('El nombre del plan es obligatorio');
    if (!payload.nivel) errors.push('Debe seleccionar un nivel académico');
    return { valid: errors.length === 0, errors };
  }
  
  static _formatNivel(nivel) {
    const map = {
      licenciatura: '🎓 Licenciatura',
      maestria: '🎓 Maestría',
      doctorado: '🎓 Doctorado',
      especialidad: '🎓 Especialidad'
    };
    return map[nivel] || nivel || '-';
  }
}