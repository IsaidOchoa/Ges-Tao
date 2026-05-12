// src/utils/periodUtils.js
// 📍 Utilidades para gestion de periodos escolares
// ✅ Reutilizable en frontend y backend

// Mapeo de meses: numero → abreviatura (sin N, estandar internacional)
const MESES = {
  0: 'ENE', 1: 'FEB', 2: 'MAR', 3: 'ABR', 4: 'MAY', 5: 'JUN',
  6: 'JUL', 7: 'AGO', 8: 'SEP', 9: 'OCT', 10: 'NOV', 11: 'DIC'
};

// Mapeo inverso para validacion/parsing
const MESES_INVERSO = Object.fromEntries(
  Object.entries(MESES).map(([k, v]) => [v, parseInt(k)])
);

/**
 * Genera clave de periodo en formato: ENE24-JUN24
 * @param {string|Date} fechaInicio - Fecha de inicio (ISO o Date)
 * @param {string|Date} fechaFin - Fecha de fin (ISO o Date)
 * @returns {string} Clave generada (ej: "FEB24-JUL24")
 */
export function generarClavePeriodo(fechaInicio, fechaFin) {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  
  const mesInicio = MESES[inicio.getMonth()];
  const yearInicio = inicio.getFullYear().toString().slice(-2);
  const mesFin = MESES[fin.getMonth()];
  const yearFin = fin.getFullYear().toString().slice(-2);
  
  // Mismo year: formato corto (FEB-JUL24)
  if (yearInicio === yearFin) {
    return `${mesInicio}-${mesFin}${yearFin}`;
  }
  
  // Cruza years: formato completo (AGO23-ENE24)
  return `${mesInicio}${yearInicio}-${mesFin}${yearFin}`;
}

/**
 * Valida que un periodo no exceda la duracion maxima permitida
 * @param {string|Date} fechaInicio 
 * @param {string|Date} fechaFin 
 * @param {number} maxMeses - Duracion maxima en meses (default: 6)
 * @returns {boolean} true si es valido
 */
export function validarDuracionPeriodo(fechaInicio, fechaFin, maxMeses = 6) {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  
  // Validar logica basica
  if (fin < inicio) return false;
  
  // Calcular diferencia en meses
  const diffMeses = (fin.getFullYear() - inicio.getFullYear()) * 12 + 
                    (fin.getMonth() - inicio.getMonth());
  
  return diffMeses <= maxMeses;
}

/**
 * Obtiene las plantillas predefinidas de periodos academicos
 * @returns {Array} Lista de plantillas con configuracion
 */
export function obtenerPlantillasPeriodos() {
  return [
    {
      id: 'semestre-a',
      nombre: 'Semestre A (Feb - Jul)',
      descripcion: 'Periodo regular de febrero a julio',
      duracionMeses: 5,
      config: {
        mesInicio: 1,   // Febrero
        mesFin: 6,      // Julio
        diaInicio: 15,
        diaFin: 31
      }
    },
    {
      id: 'semestre-b',
      nombre: 'Semestre B (Ago - Dic)',
      descripcion: 'Periodo regular de agosto a diciembre',
      duracionMeses: 4,
      config: {
        mesInicio: 7,   // Agosto
        mesFin: 11,     // Diciembre
        diaInicio: 1,
        diaFin: 15
      }
    },
    {
      id: 'trimestre-1',
      nombre: 'Trimestre 1 (Ene - Mar)',
      descripcion: 'Periodo corto de enero a marzo',
      duracionMeses: 2,
      config: {
        mesInicio: 0,
        mesFin: 2,
        diaInicio: 15,
        diaFin: 31
      }
    },
    {
      id: 'trimestre-2',
      nombre: 'Trimestre 2 (Abr - Jun)',
      descripcion: 'Periodo corto de abril a junio',
      duracionMeses: 2,
      config: {
        mesInicio: 3,
        mesFin: 5,
        diaInicio: 1,
        diaFin: 30
      }
    }
  ];
}

/**
 * Genera fechas para un periodo basado en plantilla y year
 * @param {string} plantillaId - ID de plantilla (ej: 'semestre-a')
 * @param {number} year - Year base (ej: 2024)
 * @returns {Object} { fechaInicio: ISO, fechaFin: ISO, clave: string }
 */
export function generarFechasDesdePlantilla(plantillaId, year) {
  const plantillas = obtenerPlantillasPeriodos();
  const plantilla = plantillas.find(p => p.id === plantillaId);
  
  if (!plantilla) {
    throw new Error(`Plantilla no encontrada: ${plantillaId}`);
  }
  
  const { mesInicio, mesFin, diaInicio, diaFin } = plantilla.config;
  
  // Ajuste: si mesFin < mesInicio, el periodo cruza al siguiente year
  const yearFin = mesFin < mesInicio ? year + 1 : year;
  
  const fechaInicio = new Date(year, mesInicio, diaInicio);
  const fechaFin = new Date(yearFin, mesFin, diaFin);
  
  return {
    fechaInicio: fechaInicio.toISOString().split('T')[0],
    fechaFin: fechaFin.toISOString().split('T')[0],
    clave: generarClavePeriodo(fechaInicio, fechaFin),
    descripcion: `${MESES[mesInicio]} ${year} - ${MESES[mesFin]} ${yearFin}`
  };
}

/**
 * Parsea una clave de periodo para extraer informacion
 * @param {string} clave - Ej: "FEB24-JUL24" o "AGO23-ENE24"
 * @returns {Object|null} Informacion parseada o null si no es valido
 */
export function parsearClavePeriodo(clave) {
  // Patron: MES24-MES24 o MES-MES24
  const patronMismoYear = /^([A-Z]{3})-([A-Z]{3})(\d{2})$/;
  const patronCruzaYear = /^([A-Z]{3})(\d{2})-([A-Z]{3})(\d{2})$/;
  
  let match = clave.match(patronMismoYear);
  if (match) {
    const [, mesInicio, mesFin, year] = match;
    return {
      mesInicio: MESES_INVERSO[mesInicio],
      mesFin: MESES_INVERSO[mesFin],
      yearInicio: parseInt(`20${year}`),
      yearFin: parseInt(`20${year}`),
      esMismoYear: true
    };
  }
  
  match = clave.match(patronCruzaYear);
  if (match) {
    const [, mesInicio, yearInicio, mesFin, yearFin] = match;
    return {
      mesInicio: MESES_INVERSO[mesInicio],
      mesFin: MESES_INVERSO[mesFin],
      yearInicio: parseInt(`20${yearInicio}`),
      yearFin: parseInt(`20${yearFin}`),
      esMismoYear: false
    };
  }
  
  return null;
}