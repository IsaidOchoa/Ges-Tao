// src/main/handlers/relacion/index.js

module.exports = () => {
  // Registrar cada módulo de relación
  require('./docenteEEHandlers.js')();
  require('./periodos.js')();
  require('./docenteTutoradosHandlers.js')();
  
  console.log('✅ [relacion] Todos los módulos de relación registrados');
};