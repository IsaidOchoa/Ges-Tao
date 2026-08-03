// src/main/handlers/relaciones/index.js

module.exports = () => {
  // Registrar cada módulo de relación
  require('./docenteEEHandlers.js')();
  require('./periodos.js')();
  require('./docenteTutoradosHandlers.js')();
  require('./alumnoTutorHandlers.js')();
  
  console.log('[relaciones] Todos los módulos de relaciónes registrados');
};