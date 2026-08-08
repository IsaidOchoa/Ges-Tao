// src/renderer/components/modals/AssignmentModal/config/TabConfig.js

export const TAB_CONFIGS = {
  docente: [
    {
      key: 'ee_asignadas',
      label: 'Experiencias Educativas',
      icon: 'fa-book-open',
      title: 'Experiencias Educativas Asignadas',
      columns: [
        { key: 'nombre', label: 'Nombre', width: '45%' },
        { key: 'clave_ee', label: 'NRC', width: '10%' },
        { key: 'creditos_ee', label: 'Créditos\n(T/P/O)', width: '15%' },
        { key: 'horas_ee', label: 'Horas Semanales\n(T/P)', width: '15%' },
        { key: 'num_alumnos', label: 'Alumnos\n(Inscritos)', width: '15%' }
      ],
      removeBtnText: 'Desasignar Experiencia Educativa',
      allowEditRelation: true 
    },
    {
      key: 'tutorados',
      label: 'Tutorados',
      icon: 'fa-user-graduate',
      title: 'Alumnos Tutorados',
      columns: [
        { key: 'nombre_completo', label: 'Nombre del Alumno', width: '40%' },
        { key: 'matricula', label: 'Matrícula', width: '30%' },
        { key: 'programa_academico', label: 'Programa Académico', width: '30%' }
      ],
      removeBtnText: 'Desasignar Tutorado'
    }
  ],

  alumno: [
    {
      key: 'tutor_asignado',
      label: 'Tutor',
      icon: 'fa-chalkboard-user',
      title: 'Tutor Académico Asignado',
      columns: [
        { key: 'nombre_completo', label: 'Nombre del Tutor', width: '50%' },
        { key: 'codigo', label: 'Código', width: '30%' },
        { key: 'correo', label: 'Correo', width: '20%' }
      ],
      removeBtnText: 'Desasignar Tutor',
      singleItem: true 
    }
  ],

  ee: [
    {
      key: 'docente_asignado',
      label: 'Docente',
      icon: 'fa-chalkboard-user',
      title: 'Docente Asignado a la EE',
      columns: [
        { key: 'nombre_completo', label: 'Docente', width: '40%' },
        { key: 'codigo', label: 'Código', width: '20%' },
        { key: 'correo', label: 'Correo', width: '30%' },
      ],
      removeBtnText: 'Desasignar Docente',
      singleItem: true,
      allowEditRelation: true
    }
  ]
};