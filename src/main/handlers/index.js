const authHandlers = require('./authHandlers');
const docenteHandlers = require('./docenteHandlers');
const eeHandlers = require('./eeHandlers');
const periodoHandlers = require('./periodoHandlers');
const programaHandlers = require('./programaHandlers');
const tipoConstanciaHandlers = require('./tipoConstanciaHandlers');
const constanciaHandlers = require('./constanciaHandlers');
const historialHandlers = require('./historialHandlers');

module.exports = () => {
  authHandlers();
  docenteHandlers();
  eeHandlers();
  periodoHandlers();
  programaHandlers();
  tipoConstanciaHandlers();
  constanciaHandlers();
  historialHandlers();
  
  console.log('[HANDLERS] Todos los handlers IPC registrados correctamente.');
};