// src/main/handlers/relacion/index.js

module.exports = () => {
  // Registrar cada módulo de relación
  require('./tutoria.js')();
  require('./docente-ee.js')();
  require('./periodos.js')();
  // require('./inscripcion.js')(); // Cuando lo crees
  
  console.log('✅ [relacion] Todos los módulos de relación registrados');
};