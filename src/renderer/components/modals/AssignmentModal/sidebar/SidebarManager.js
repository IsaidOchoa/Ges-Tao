// src/renderer/components/modals/AssignmentModal/sidebar/SidebarManager.js

export class SidebarManager {
  constructor({ api, stateManager, periodAdminManager }) {
    this.api = api;
    this.stateManager = stateManager;
    this.periodAdminManager = periodAdminManager;
    this._abortController = null;
    this._container = null;

    // Suscribirse a eventos de invalidación
    this.stateManager.subscribe("cacheInvalidated", (module) => {
      if (module === "sidebar" || module === "all" || module === "counters") {
        this._onInvalidated(module);
      }
    });
  }

  async _onInvalidated(module) {
    if (!this._container) return;

    // Solo re-renderizar si el sidebar está visible
    await this.renderRelationsPanel(this._container);
  }

  async loadPeriods(selectElement) {
    if (!selectElement) return;

    try {
      const res = await this.api.listarPeriodos();
      if (!res?.success)
        throw new Error(res?.error || "Error cargando periodos");

      const periodos = res.data || [];
      selectElement.innerHTML =
        '<option value="">Todos los periodos (Histórico)</option>';

      periodos.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.descripcion;
        selectElement.appendChild(opt);
      });

      this._addAdminButton(selectElement);

      return periodos;
    } catch (error) {
      console.error("Error cargando periodos:", error);
      selectElement.innerHTML =
        '<option value="">Error al cargar periodos</option>';
      return [];
    }
  }

  _addAdminButton(selectElement) {
    // Verificar si ya existe el botón
    const existingBtn =
      selectElement.parentElement?.querySelector(".period-admin-btn");
    if (existingBtn) return;

    const parent = selectElement.parentElement;
    if (!parent) return;

    // Crear contenedor flex
    const row = document.createElement("div");
    row.className = "period-selector-row";

    // Insertar el row antes del select y mover el select dentro
    parent.insertBefore(row, selectElement);
    row.appendChild(selectElement);

    // Crear botón de administración
    const adminBtn = document.createElement("button");
    adminBtn.className = "period-admin-btn";
    adminBtn.innerHTML = '<i class="fa-solid fa-gear"></i>';
    adminBtn.title = "Administrar periodos";
    adminBtn.type = "button";

    row.appendChild(adminBtn);

    // Event listener
    adminBtn.addEventListener("click", async () => {
      if (this.periodAdminManager) {
        await this.periodAdminManager.open(async (assignedPeriods) => {
          await this.loadPeriods(selectElement);
          if (this._container) {
            await this.renderRelationsPanel(this._container);
          }
        });
      }
    });
  }

  renderContext(container, context) {
    if (!container || !context) return;

    const { entityName, entityType, entityId, codigo, matricula, clave_ee } =
      context;

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

  async renderRelationsPanel(container) {
    if (!container) return;

    this._container = container; // Guardar referencia

    const { entityType, entityId } = this.stateManager.context || {};
    const periodId = this.stateManager.activePeriod;

    const relationDefs = {
      docente: [
        {
          key: "ee_asignada",
          label: "Experiencia Educativa",
          fetch: async () => {
            if (!periodId)
              return { value: "Sin periodo seleccionado", empty: true };
            const res = await this.api.obtenerEEDelDocente?.({
              docenteId: entityId,
              periodoId: periodId,
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
            if (!periodId)
              return { value: "Sin periodo seleccionado", empty: true };
            const res = await this.api.obtenerTutorados?.({
              docenteId: entityId,
              periodoId: periodId,
            });
            const count = res?.data?.length || 0;
            return {
              value:
                count > 0
                  ? `${count} alumno${count !== 1 ? "s" : ""}`
                  : "Sin asignar",
              empty: count === 0,
            };
          },
        },
      ],
      ee: [
        {
          key: "docente_asignado",
          label: "Docente Asignado",
          fetch: async () => {
            if (!periodId)
              return { value: "Sin periodo seleccionado", empty: true };
            const res = await this.api.obtenerDocenteDeEE?.({
              eeId: entityId,
              periodoId: periodId,
            });
            const doc = res?.data?.[0];
            return doc
              ? {
                  value: `${doc.tratamiento} ${doc.apellido_paterno}`,
                  empty: false,
                }
              : { value: "Sin asignar", empty: true };
          },
        },
        {
          key: "alumnos_inscritos",
          label: "Alumnos Inscritos",
          fetch: async () => {
            if (!periodId)
              return { value: "Sin periodo seleccionado", empty: true };
            const res = await this.api.obtenerAlumnosDeEE?.({
              eeId: entityId,
              periodoId: periodId,
            });
            const count = res?.data?.length || 0;
            return {
              value:
                count > 0
                  ? `${count} alumno${count !== 1 ? "s" : ""}`
                  : "Sin inscritos",
              empty: count === 0,
            };
          },
        },
      ],
      alumno: [
        {
          key: "tutor_asignado",
          label: "Tutor Académico",
          fetch: async () => {
            if (!periodId)
              return { value: "Sin periodo seleccionado", empty: true };
            const res = await this.api.obtenerTutorDeAlumno?.({
              alumnoId: entityId,
              periodoId: periodId,
            });
            const tutor = res?.data?.[0];
            return tutor
              ? {
                  value: `${tutor.tratamiento} ${tutor.apellido_paterno}`,
                  empty: false,
                }
              : { value: "Sin asignar", empty: true };
          },
        },
        {
          key: "ee_inscritas",
          label: "EE Inscritas",
          fetch: async () => {
            if (!periodId)
              return { value: "Sin periodo seleccionado", empty: true };
            const res = await this.api.obtenerEEDeAlumno?.({
              alumnoId: entityId,
              periodoId: periodId,
            });
            const count = res?.data?.length || 0;
            return {
              value:
                count > 0
                  ? `${count} materia${count !== 1 ? "s" : ""}`
                  : "Sin inscritas",
              empty: count === 0,
            };
          },
        },
      ],
    };

    const relations = relationDefs[entityType] || [];

    container.innerHTML = `
      <div class="sidebar-relations-panel">
        <div class="relations-panel-title">Relaciones Actuales</div>
        <div id="relations-list">
          ${relations
            .map(
              (rel) => `
            <div class="relation-block" data-relation="${rel.key}">
              <div class="relation-label">${rel.label}</div>
              <div class="relation-value loading">Cargando...</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;

    relations.forEach(async (rel) => {
      try {
        const data = await rel.fetch();
        const valueEl = container.querySelector(
          `[data-relation="${rel.key}"] .relation-value`,
        );
        if (valueEl) {
          valueEl.textContent = data.value;
          valueEl.classList.toggle("empty", data.empty);
        }
      } catch (error) {
        console.warn(`Error cargando ${rel.key}:`, error);
        const valueEl = container.querySelector(
          `[data-relation="${rel.key}"] .relation-value`,
        );
        if (valueEl) {
          valueEl.textContent = "Error";
          valueEl.classList.add("empty");
        }
      }
    });
  }

  cleanup() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._container = null;
  }
}
