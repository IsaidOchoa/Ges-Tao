// src/renderer/utils/assignment-modal/SidebarManager.js

export class SidebarManager {
  constructor({ api, stateManager }) {
    this.api = api;
    this.stateManager = stateManager;
  }

  async loadPeriodsIntoSidebar(selectElement) {
    if (!selectElement) return;

    try {
      const res = await this.api.listarPeriodos();
      if (!res?.success) throw new Error(res?.error || "Error cargando periodos");
      
      const periodos = res.data || [];
      selectElement.innerHTML = '<option value="">Filtrar por periodos</option>';
      
      periodos.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.descripcion}`;
        selectElement.appendChild(opt);
      });

      return periodos;
    } catch (error) {
      console.error("❌ [SidebarManager] Error cargando periodos:", error);
      selectElement.innerHTML = `<option value="">⚠️ ${error.message}</option>`;
      return [];
    }
  }

  /**
   * Renderiza el badge de contexto de entidad (Docente/Alumno/EE)
   */
  renderContext(container, context) {
    if (!container || !context) return;

    const { entityName, entityType, entityId, codigo, matricula, clave_ee } = context;

    const entityConfig = {
      docente: {
        label: "Código",
        value: codigo,
        icon: '<i class="fa-solid fa-chalkboard-user"></i>',
        meta: "DOCENTE",
      },
      alumno: {
        label: "Matrícula",
        value: matricula,
        icon: '<i class="fa-solid fa-user-graduate"></i>',
        meta: "ALUMNO",
      },
      ee: {
        label: "NRC",
        value: clave_ee,
        icon: '<i class="fa-solid fa-book-open"></i>',
        meta: "EXPERIENCIA EDUCATIVA",
      },
    };

    const config = entityConfig[entityType] || {
      label: "ID",
      value: entityId,
      icon: '<i class="fa-solid fa-user"></i>',
      meta: entityType.toUpperCase(),
    };

    container.innerHTML = `
      <div class="entity-badge ${entityType}">
        <span class="icon">${config.icon}</span>
        <div>
          <strong>${entityName}</strong>
          <small>${config.label}: ${config.value || entityId}</small>
        </div>
      </div>
      <div class="entity-meta">
        <span class="meta-item">${config.meta}</span>
      </div>
    `;
  }

  /**
   * Renderiza el panel de relaciones actuales en el sidebar
   */
  async renderRelationsPanel(container, entityType, entityId, periodId) {
    if (!container) return;

    // Definición de relaciones por tipo de entidad
    const relationDefs = {
      docente: [
        {
          key: "ee_asignada",
          label: "Experiencia Educativa",
          fetch: async () => {
            if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
            
            // ✅ CORRECCIÓN: Usar "periodoId" como clave de objeto (string)
            const res = await this.api.obtenerEEDelDocente?.({ 
              docenteId: entityId, 
              periodoId: periodId  // ← periodoId es la clave que espera la API
            });
            
            const ee = res?.data?.[0];
            return ee 
              ? { value: ee.nombre || ee.clave_ee, empty: false } 
              : { value: "Sin asignar", empty: true };
          },
        },
        {
          key: "tutorados",
          label: "Tutorados",
          fetch: async () => {
            if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
            
            // ✅ CORRECCIÓN: Usar "periodoId" como clave de objeto
            const res = await this.api.obtenerTutorados?.({ 
              docenteId: entityId, 
              periodoId: periodId 
            });
            
            const count = res?.data?.length || 0;
            return { 
              value: count > 0 ? `${count} alumno${count !== 1 ? "s" : ""}` : "Sin asignar", 
              empty: count === 0 
            };
          },
        },
      ],
      ee: [
        {
          key: "docente_asignado",
          label: "Docente Asignado",
          fetch: async () => {
            if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
            
            const res = await this.api.obtenerDocenteDeEE?.({ 
              eeId: entityId, 
              periodoId: periodId 
            });
            
            const doc = res?.data?.[0];
            return doc 
              ? { value: `${doc.tratamiento} ${doc.apellido_paterno}`, empty: false } 
              : { value: "Sin asignar", empty: true };
          },
        },
        {
          key: "alumnos_inscritos",
          label: "Alumnos Inscritos",
          fetch: async () => {
            if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
            
            const res = await this.api.obtenerAlumnosDeEE?.({ 
              eeId: entityId, 
              periodoId: periodId 
            });
            
            const count = res?.data?.length || 0;
            return { 
              value: count > 0 ? `${count} alumno${count !== 1 ? "s" : ""}` : "Sin inscritos", 
              empty: count === 0 
            };
          },
        },
      ],
      alumno: [
        {
          key: "tutor_asignado",
          label: "Tutor Académico",
          fetch: async () => {
            if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
            
            const res = await this.api.obtenerTutorDeAlumno?.({ 
              alumnoId: entityId, 
              periodoId: periodId 
            });
            
            const tutor = res?.data?.[0];
            return tutor 
              ? { value: `${tutor.tratamiento} ${tutor.apellido_paterno}`, empty: false } 
              : { value: "Sin asignar", empty: true };
          },
        },
        {
          key: "ee_inscritas",
          label: "EE Inscritas",
          fetch: async () => {
            if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
            
            const res = await this.api.obtenerEEDeAlumno?.({ 
              alumnoId: entityId, 
              periodoId: periodId 
            });
            
            const count = res?.data?.length || 0;
            return { 
              value: count > 0 ? `${count} materia${count !== 1 ? "s" : ""}` : "Sin inscritas", 
              empty: count === 0 
            };
          },
        },
      ],
    };

    const relations = relationDefs[entityType] || [];
    
    // Renderizar estructura base del panel
    container.innerHTML = `
      <div class="sidebar-relations-panel">
        <div class="relations-panel-title">Relaciones Actuales</div>
        <div id="relations-list">
          ${relations.map((rel) => `
            <div class="relation-block" data-relation="${rel.key}">
              <div class="relation-label">${rel.label}</div>
              <div class="relation-value loading">Cargando...</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    // Cargar datos de cada relación de forma asíncrona
    relations.forEach(async (rel) => {
      try {
        const data = await rel.fetch();
        const valueEl = container.querySelector(`[data-relation="${rel.key}"] .relation-value`);
        if (valueEl) {
          valueEl.textContent = data.value;
          valueEl.classList.toggle("empty", data.empty);
        }
      } catch (error) {
        console.warn(`Error cargando ${rel.key}:`, error);
        const valueEl = container.querySelector(`[data-relation="${rel.key}"] .relation-value`);
        if (valueEl) {
          valueEl.textContent = "Error";
          valueEl.classList.add("empty");
        }
      }
    });
  }
}