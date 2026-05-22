// src/renderer/config/relationships/index.js
import { relacionTutoria } from './relacion-tutoria.js';
import { relacionDocenteEE } from './relacion-docente-ee.js';
import { relacionInscripcion } from './relacion-inscripcion.js';

export const allRelationships = [
  relacionTutoria,
  relacionDocenteEE,
  relacionInscripcion
  // Agrega más relaciones aquí cuando las crees
];