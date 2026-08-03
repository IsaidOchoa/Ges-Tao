// src/renderer/components/modals/AssignmentModal/config/TabConfig.js

export const TAB_CONFIGS = {
  docente: [
    {
      key: 'ee_asignadas',
      label: 'Experiencias Educativas',
      icon: 'fa-book-open',
      title: 'Experiencias Educativas Asignadas',
      columns: [
        { key: 'nombre', label: 'Nombre de la EE', width: '45%' },
        { key: 'clave_ee', label: 'NRC', width: '20%' },
        { key: 'carga_horaria', label: 'Carga / Alumnos', width: '25%' }, // Contexto Docente: Se entiende como la carga que tiene el docente en esta EE
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
        { key: 'programa_academico', label: 'Programa', width: '30%' }
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
        { key: 'carga_horaria', label: 'Alumnos Inscritos', width: '25%' },
        { key: 'acciones', label: 'Acciones', width: '15%' }
      ],
      removeBtnText: 'Desasignar Docente',
      singleItem: true,
      allowEditRelation: true
    }
  ]
};