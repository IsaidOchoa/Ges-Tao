// src/renderer/utils/periodUtils.js

/**
 * Genera clave automática para periodo escolar
 * @param {string} fechaInicio - YYYY-MM-DD
 * @param {string} fechaFin - YYYY-MM-DD
 * @returns {string} Clave tipo "FEB-JUL24"
 */
export function generarClavePeriodo(fechaInicio, fechaFin) {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  
  const mesInicio = inicio.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
  const mesFin = fin.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
  const anioFin = fin.getFullYear().toString().slice(-2);
  
  return `${mesInicio}-${mesFin}${anioFin}`;
}

/**
 * Valida que la duración del periodo no exceda el máximo permitido
 * @param {string} fechaInicio - YYYY-MM-DD
 * @param {string} fechaFin - YYYY-MM-DD
 * @param {number} maxMeses - Máximo de meses permitidos (default: 6)
 * @returns {boolean}
 */
export function validarDuracionPeriodo(fechaInicio, fechaFin, maxMeses = 6) {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  
  // 1. Diferencia base en meses calendario (maneja cruce de año automáticamente)
  let meses = (fin.getFullYear() - inicio.getFullYear()) * 12;
  meses += fin.getMonth() - inicio.getMonth();
  
  // 2. Ajuste por día: si el día final es menor al inicial, no completa el último mes
  if (fin.getDate() < inicio.getDate()) {
    meses--;
  }
  
  // 3. Conteo inclusivo (estándar académico):
  // Ago 1 → Ene 31 son 6 meses completos (Ago, Sep, Oct, Nov, Dic, Ene)
  // La fórmula matemática da 5, sumamos 1 para conteo inclusivo correcto.
  meses += 1;
  
  return meses <= maxMeses;
}

/**
 * Genera fechas y metadata desde una plantilla predefinida
 * @param {string} plantilla - 'semestre-a' | 'semestre-b'
 * @param {number} anioBase - Año base para cálculo
 * @returns {object} { fechaInicio, fechaFin, clave, descripcion }
 */
export function generarFechasDesdePlantilla(plantilla, anioBase) {
  if (plantilla === 'semestre-a') {
    // Feb 1 - Jul 31 del mismo año
    return {
      fechaInicio: `${anioBase}-02-01`,
      fechaFin: `${anioBase}-07-31`,
      clave: `FEB-JUL${anioBase.toString().slice(-2)}`,
      descripcion: `FEB ${anioBase} - JUL ${anioBase}`
    };
  } else if (plantilla === 'semestre-b') {
    // Ago 1 - Ene 31 del siguiente año
    const anioFin = anioBase + 1;
    return {
      fechaInicio: `${anioBase}-08-01`,
      fechaFin: `${anioFin}-01-31`,
      clave: `AGO-ENE${anioFin.toString().slice(-2)}`,
      descripcion: `AGO ${anioBase} - ENE ${anioFin}`
    };
  }
  
  throw new Error(`Plantilla no reconocida: ${plantilla}`);
}