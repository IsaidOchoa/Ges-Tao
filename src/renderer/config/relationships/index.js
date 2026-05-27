//config/relationships/index.js

import { relacionDocenteEE } from './relacion-docente-ee.js';
import { relacionPeriodos } from './relacion-periodos.js';
import { relacionAlumnoTutoria } from './relacion-alumno-tutoria.js';
import { relacionDocenteTutorados } from './relacion-docente-tutorados.js';
import { relacionAlumnoEE } from './relacion-alumno-ee.js';
import { relacionEEDocente } from './relacion-ee-docente.js';
import { relacionEEAlumnos } from './relacion-ee-alumnos.js';

export const allRelationships = [
  // Relaciones de Docente
  relacionDocenteTutorados,
  relacionDocenteEE,
  relacionPeriodos,
  
  // Relaciones de Alumno
  relacionAlumnoTutoria,
  relacionAlumnoEE,
  
  // Relaciones de EE
  relacionEEDocente,
  relacionEEAlumnos
];