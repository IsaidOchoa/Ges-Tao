import { relacionTutoria } from './relacion-tutoria.js';
import { relacionDocenteEE } from './relacion-docente-ee.js';
import { relacionPeriodos } from './relacion-periodos.js';

// Nuevas Relaciones
import { relacionAlumnoTutoria } from './relacion-alumno-tutoria.js';
import { relacionAlumnoEE } from './relacion-alumno-ee.js';
import { relacionEEDocente } from './relacion-ee-docente.js';
import { relacionEEAlumnos } from './relacion-ee-alumnos.js';

export const allRelationships = [
  // Relaciones de Docente
  relacionTutoria,
  relacionDocenteEE,
  relacionPeriodos,
  
  // Relaciones de Alumno
  relacionAlumnoTutoria,
  relacionAlumnoEE,
  
  // Relaciones de EE
  relacionEEDocente,
  relacionEEAlumnos
];