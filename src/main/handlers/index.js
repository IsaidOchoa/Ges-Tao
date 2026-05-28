// src/main/handlers/index.js
const authHandlers = require('./authHandlers');
const docenteHandlers = require('./docenteHandlers');
const eeHandlers = require('./eeHandlers');
const periodoHandlers = require('./periodoHandlers');
const programaHandlers = require('./programaHandlers');
const tipoConstanciaHandlers = require('./tipoConstanciaHandlers');
const constanciaHandlers = require('./constanciaHandlers');
const historialHandlers = require('./historialHandlers');
const alumnoHandlers = require('./alumnoHandlers');
const planHandlers = require('./planHandlers');
const semestreHandlers = require('./semestreHandlers');
const generacionHandlers = require('./generacionHandlers');
const relacionHandlers = require('./relaciones');
const entityPeriodHandlers = require('./entityPeriodHadlers');
const configHandlers = require('./configHandlers');

module.exports = () => {
  authHandlers();
  docenteHandlers();
  eeHandlers();
  periodoHandlers();
  programaHandlers();
  tipoConstanciaHandlers();
  constanciaHandlers();
  historialHandlers();
  alumnoHandlers();
  planHandlers();
  semestreHandlers();
  generacionHandlers();
  relacionHandlers();
  entityPeriodHandlers();
  configHandlers();
  
  console.log('[HANDLERS] Todos los handlers IPC registrados correctamente.');
};