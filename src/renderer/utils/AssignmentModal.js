// src/renderer/utils/AssignmentModal.js
import { uiLoader } from "./uiLoader";
import modalAsignacionesHtml from "../config/relationships/templates/modal-asignaciones.html";
import { Toast } from "../components/common/Toast.js";
import { globalConfirm } from "./confirmationModal.js";

export class AssignmentModal {
  constructor() {
    this.modal = null;

    this.state = {
      context: null,
      activePeriod: null,
      activeTab: "gestionar",
      isLoading: false
    };

    this.elements = {
      overlay: null,
      sidebarPeriodSelect: null,
      sidebarContextInfo: null,
      workspaceContent: null,
      workspaceTabs: null,
      workspaceLoader: null,
      // Vistas persistentes
      viewGestionar: null,
      viewConsultar: null
    };

    this._initialized = false;
    this._registeredRelations = new Map();
    // Caché bidireccional
    this._viewCache = { gestionar: null, consultar: null };
  }

  // =========================================================
  // INICIALIZACIÓN
  // =========================================================

  _ensureInitialized() {
    if (this._initialized) return;

    document.body.insertAdjacentHTML("beforeend", modalAsignacionesHtml);

    this.elements.overlay = document.getElementById("modal-asignaciones");
    this.elements.sidebarPeriodSelect = document.getElementById("ctx-period-selector");
    this.elements.sidebarContextInfo = document.getElementById("ctx-context-info");
    this.elements.workspaceContent = document.getElementById("workspace-content");
    this.elements.workspaceTabs = document.getElementById("workspace-tabs");
    // Vistas persistentes
    this.elements.viewGestionar = document.getElementById("view-gestionar");
    this.elements.viewConsultar = document.getElementById("view-consultar");

    this._bindGlobalEvents();
    this._initialized = true;
  }

  open(context) {
    this._ensureInitialized();
    this.state.context = { ...context };
    this.state.activePeriod = null;
    this.state.activeTab = "gestionar";
    this.elements.overlay.classList.remove("hidden");

    // Mostrar vista gestionar por defecto
    if (this.elements.viewGestionar) this.elements.viewGestionar.classList.remove("hidden");
    if (this.elements.viewConsultar) this.elements.viewConsultar.classList.add("hidden");

    this._showWorkspaceLoader("Cargando datos...");
    this._loadInitialData();
  }

  async _loadInitialData() {
    try {
      await this._loadPeriodsIntoSidebar();
      this._renderSidebarContext();
      this._renderSidebarRelations();
      await this._renderGestionarView();
    } catch (error) {
      console.error("❌ Error cargando modal:", error);
      this.elements.workspaceContent.innerHTML = `<p class="error-msg">Error al cargar datos.</p>`;
    } finally {
      this._hideWorkspaceLoader();
    }
  }

  // =========================================================
  // PERIODOS - SIDEBAR
  // =========================================================

  async _loadPeriodsIntoSidebar() {
    const select = this.elements.sidebarPeriodSelect;
    if (!select) return;

    try {
      const res = await window.electronAPI.listarPeriodos();
      if (!res?.success) throw new Error(res?.error || "Error cargando periodos");
      const periodos = res.data || [];

      select.innerHTML = '<option value="">Filtrar por periodos</option>';
      periodos.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.descripcion}`;
        select.appendChild(opt);
      });

      select.onchange = async (e) => {
        this.state.activePeriod = e.target.value || null;
        await this._handlePeriodChange();
      };
    } catch (error) {
      console.error("❌ [Modal] Error cargando periodos:", error);
      select.innerHTML = `<option value="">⚠️ ${error.message}</option>`;
    }
  }

  // =========================================================
  // SIDEBAR: CONTEXTO DE ENTIDAD
  // =========================================================

  _renderSidebarContext() {
    const { entityName, entityType, entityId } = this.state.context;
    const container = this.elements.sidebarContextInfo;

    const entityConfig = {
      docente: { label: "Código", value: this.state.context.codigo, icon: '<i class="fa-solid fa-chalkboard-user"></i>', meta: "DOCENTE" },
      alumno: { label: "Matrícula", value: this.state.context.matricula, icon: '<i class="fa-solid fa-user-graduate"></i>', meta: "ALUMNO" },
      ee: { label: "NRC", value: this.state.context.clave_ee, icon: '<i class="fa-solid fa-book-open"></i>', meta: "EXPERIENCIA EDUCATIVA" }
    };

    const config = entityConfig[entityType] || { label: "ID", value: entityId, icon: '<i class="fa-solid fa-user"></i>', meta: entityType.toUpperCase() };

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

  // =========================================================
  // SIDEBAR: ESTADO RELACIONAL
  // =========================================================

  async _renderSidebarRelations() {
    const { entityType, entityId } = this.state.context;
    const periodId = this.state.activePeriod;
    const container = document.getElementById("sidebar-relations-panel");
    if (!container) return;

    const relationDefs = {
      docente: [
        { key: "ee_asignada", label: "Experiencia Educativa", fetch: async () => {
          if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
          const res = await window.electronAPI.obtenerEEDelDocente?.({ docenteId: entityId, periodoId: periodId });
          const ee = res?.data?.[0];
          return ee ? { value: ee.nombre || ee.clave_ee, empty: false } : { value: "Sin asignar", empty: true };
        }},
        { key: "tutorados", label: "Tutorados", fetch: async () => {
          if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
          const res = await window.electronAPI.obtenerTutorados?.({ docenteId: entityId, periodoId: periodId });
          const count = res?.data?.length || 0;
          return { value: count > 0 ? `${count} alumno${count !== 1 ? "s" : ""}` : "Sin asignar", empty: count === 0 };
        }}
      ],
      ee: [
        { key: "docente_asignado", label: "Docente Asignado", fetch: async () => {
          if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
          const res = await window.electronAPI.obtenerDocenteDeEE?.({ eeId: entityId, periodoId: periodId });
          const doc = res?.data?.[0];
          return doc ? { value: `${doc.tratamiento} ${doc.apellido_paterno}`, empty: false } : { value: "Sin asignar", empty: true };
        }},
        { key: "alumnos_inscritos", label: "Alumnos Inscritos", fetch: async () => {
          if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
          const res = await window.electronAPI.obtenerAlumnosDeEE?.({ eeId: entityId, periodoId: periodId });
          const count = res?.data?.length || 0;
          return { value: count > 0 ? `${count} alumno${count !== 1 ? "s" : ""}` : "Sin inscritos", empty: count === 0 };
        }}
      ],
      alumno: [
        { key: "tutor_asignado", label: "Tutor Académico", fetch: async () => {
          if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
          const res = await window.electronAPI.obtenerTutorDeAlumno?.({ alumnoId: entityId, periodoId: periodId });
          const tutor = res?.data?.[0];
          return tutor ? { value: `${tutor.tratamiento} ${tutor.apellido_paterno}`, empty: false } : { value: "Sin asignar", empty: true };
        }},
        { key: "ee_inscritas", label: "EE Inscritas", fetch: async () => {
          if (!periodId) return { value: "Sin periodo seleccionado", empty: true };
          const res = await window.electronAPI.obtenerEEDeAlumno?.({ alumnoId: entityId, periodoId: periodId });
          const count = res?.data?.length || 0;
          return { value: count > 0 ? `${count} materia${count !== 1 ? "s" : ""}` : "Sin inscritas", empty: count === 0 };
        }}
      ]
    };

    const relations = relationDefs[entityType] || [];
    container.innerHTML = `<div class="sidebar-relations-panel"><div class="relations-panel-title">Relaciones Actuales</div><div id="relations-list">${relations.map(rel => `<div class="relation-block" data-relation="${rel.key}"><div class="relation-label">${rel.label}</div><div class="relation-value loading">Cargando...</div></div>`).join("")}</div></div>`;

    relations.forEach(async (rel) => {
      try {
        const data = await rel.fetch();
        const valueEl = container.querySelector(`[data-relation="${rel.key}"] .relation-value`);
        if (valueEl) { valueEl.textContent = data.value; valueEl.classList.toggle("empty", data.empty); }
      } catch (error) {
        console.warn(`Error cargando ${rel.key}:`, error);
        const valueEl = container.querySelector(`[data-relation="${rel.key}"] .relation-value`);
        if (valueEl) { valueEl.textContent = "Error"; valueEl.classList.add("empty"); }
      }
    });
  }

  // =========================================================
  // WORKSPACE: VISTAS PERSISTENTES
  // =========================================================

  async _renderGestionarView() {
    const container = this.elements.viewGestionar;
    if (!container) return;

    // Cache check
    const cacheKey = this._getCacheKey();
    if (this._viewCache.gestionar?.key === cacheKey && this._viewCache.gestionar?.rendered) {
      return;
    }

    await this._renderPeriodAdhesionCard();
    await this._renderOperationalRelations();

    // Guardar en caché
    this._viewCache.gestionar = { key: cacheKey, rendered: true };
  }

  async _renderConsultRelations() {
    const container = this.elements.viewConsultar;
    if (!container) return;

    const { entityType, entityId, entityName } = this.state.context;
    const cacheKey = this._getCacheKey();

    // Cache check
    if (this._viewCache.consultar?.key === cacheKey && this._viewCache.consultar?.rendered) {
      return;
    }

    const consultRelations = this._getRegisteredRelations(entityType).filter(rel => rel.workspaceConfig?.modes?.includes("consultar"));

    if (consultRelations.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No hay relaciones configuradas para consultar</p></div>`;
      return;
    }

    let html = `<div class="workspace-grid">`;
    for (const relation of consultRelations) {
      if (typeof relation.renderWorkspace === "function") {
        const cardHtml = relation.renderWorkspace({ entityType, entityId, entityName }, null, "consultar");
        if (cardHtml) html += cardHtml;
      }
    }
    html += `</div>`;
    container.innerHTML = html;

    // Cargar datos dinámicos asíncronamente (ej: historial de EE)
    for (const relation of consultRelations) {
      if (relation.tabId === "ee_asignadas" && typeof relation.loadHistorialData === "function") {
        const historialList = container.querySelector("#historial-ee-list");
        if (historialList) {
          try {
            const historial = await relation.loadHistorialData(entityType, entityId);
            historialList.innerHTML = historial.length === 0
              ? '<span class="empty-text">Sin registros históricos</span>'
              : `<div style="display:flex;flex-direction:column;gap:0.75rem;">${historial.map(item => `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid var(--accent-color);"><div><div style="font-weight:600;color:var(--text-light);">${item.ee}</div><div style="font-size:0.8rem;color:var(--text-muted);">${item.clave}</div></div><div style="text-align:right;"><span style="display:block;font-weight:600;color:var(--accent-color);">${item.periodo}</span><span style="font-size:0.8rem;color:var(--text-muted);">${item.carga} hrs</span></div></div>`).join("")}</div>`;
          } catch (error) {
            console.warn("Error cargando historial EE:", error);
            historialList.innerHTML = '<span class="error-text">Error al cargar</span>';
          }
        }
      }
    }

    // Guardar en caché
    this._viewCache.consultar = { key: cacheKey, rendered: true };
  }

  // =========================================================
  // WORKSPACE: ADHESIÓN A PERIODOS (GESTIONAR)
  // =========================================================

  async _renderPeriodAdhesionCard() {
    const { entityType, entityId } = this.state.context;
    const listContainer = document.getElementById("adhesion-list");
    const select = document.getElementById("adhesion-period-select");
    const btnAdd = document.getElementById("btn-add-adhesion");

    if (!listContainer || !select) return;

    try {
      const resPeriodos = await window.electronAPI.listarPeriodos();
      if (!resPeriodos?.success) throw new Error("Error cargando periodos");
      const allPeriods = resPeriodos.data || [];
      const assignedPeriods = await this._fetchAssignedPeriods(entityType, entityId);

      const MAX_VISIBLE = 5;
      const visiblePeriods = assignedPeriods.slice(0, MAX_VISIBLE);
      const remainingCount = assignedPeriods.length - MAX_VISIBLE;

      let html = "";
      visiblePeriods.forEach((p) => {
        html += `<span class="adhesion-item" data-period-id="${p.id}" data-period-clave="${p.clave}" title="${p.descripcion}">${p.descripcion}<button class="remove-btn" data-period="${p.id}" title="Quitar">&times;</button></span>`;
      });
      if (remainingCount > 0) {
        html += `<span class="adhesion-item adhesion-counter" title="Ver más en Consultar" data-action="view-all">+${remainingCount}</span>`;
      }
      if (assignedPeriods.length === 0) {
        html = '<span class="adhesion-item empty">Sin periodos asignados</span>';
      }

      listContainer.innerHTML = html;

      // Bind eventos de quitar
      listContainer.querySelectorAll(".remove-btn").forEach((btn) => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const periodId = btn.dataset.period;
          const periodChip = btn.closest(".adhesion-item");
          const periodClave = periodChip?.dataset.periodClave || "este periodo";
          const { entityName, entityType } = this.state.context;
          const entityLabel = entityType === 'docente' ? 'al docente' : entityType === 'alumno' ? 'al alumno' : 'a la EE';
          const message = `¿Desvincular ${entityLabel} "${entityName}" del periodo "${periodClave}"?`;

          if (await globalConfirm?.ask(message, 0)) {
            await this._removeEntityFromPeriod(entityType, entityId, periodId);
            await this._renderPeriodAdhesionCard();
            if (this.state.activePeriod == periodId) {
              this.state.activePeriod = null;
              document.getElementById("ctx-period-selector").value = "";
              this._handlePeriodChange();
            }
            Toast.success(`${entityName} desvinculado de ${periodClave}`);
            this._invalidateCache();
          }
        };
      });

      // Bind evento del chip contador
      const counterChip = listContainer.querySelector('[data-action="view-all"]');
      if (counterChip) {
        counterChip.onclick = () => this._switchTab("consultar");
      }

      // Llenar selector con disponibles
      const availablePeriods = allPeriods.filter((p) => !assignedPeriods.some((ap) => ap.id == p.id));
      if (availablePeriods.length === 0) {
        select.innerHTML = '<option value="" disabled>Se han asignado todos los periodos</option>';
      } else {
        select.innerHTML = '<option value="">Seleccionar periodo...</option>';
        availablePeriods.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${p.descripcion}`;
          select.appendChild(opt);
        });
      }

      // Configurar botón asignar
      if (btnAdd) {
        btnAdd.disabled = availablePeriods.length === 0;
        btnAdd.title = availablePeriods.length === 0 ? "No hay periodos disponibles" : "Asignar periodo seleccionado";
        btnAdd.onclick = async () => {
          const periodId = select.value;
          if (!periodId) { Toast.warning("Seleccione un periodo"); return; }
          const selected = allPeriods.find((p) => p.id == periodId);
          await this._addEntityToPeriod(entityType, entityId, periodId);
          await this._renderPeriodAdhesionCard();
          Toast.success(`Vinculado a ${selected?.descripcion}`);
          this._invalidateCache();
        };
      }
    } catch (error) {
      console.error("Error adhesión:", error);
      listContainer.innerHTML = `<span class="adhesion-item empty">Error</span>`;
    }
  }

  // =========================================================
  // WORKSPACE: RELACIONES OPERATIVAS (GESTIONAR)
  // =========================================================

  async _renderOperationalRelations() {
    const { entityType, entityId, entityName } = this.state.context;
    const periodId = this.state.activePeriod;
    const grid = document.getElementById("operational-relations-grid");
    const overlay = document.getElementById("relations-overlay");
    if (!grid) return;

    // Toggle overlay según periodo activo
    if (!periodId) { overlay?.classList.remove("hidden"); } else { overlay?.classList.add("hidden"); }

    const compatibleRelations = this._getRegisteredRelations(entityType).filter((rel) => rel.workspaceConfig?.modes?.includes("gestionar"));
    grid.innerHTML = compatibleRelations.length === 0
      ? '<div class="empty-state">No hay relaciones configuradas</div>'
      : compatibleRelations.map((rel) => {
          if (typeof rel.renderOperationalCard === "function") {
            return rel.renderOperationalCard(
              { entityType, entityId, entityName },
              periodId,
              {
                onAssign: (data) => this._handleRelationAction(rel.tabId, "assign", data),
                availableEntities: () => this._getAvailableEntitiesForRelation(rel.tabId, periodId)
              }
            );
          }
          return `<section class="workspace-card relation-card" data-relation="${rel.tabId}"><header class="card-header"><h4>${rel.label || rel.tabId}</h4></header><div class="card-body"><p class="summary-text">${rel.description || "Operación disponible"}</p></div></section>`;
        }).join("");

    this._bindOperationalRelationEvents(grid, periodId);
  }

  // =========================================================
  // PERSISTENCIA: ENTITY_PERIOD (BD REAL)
  // =========================================================

  async _fetchAssignedPeriods(entityType, entityId) {
    try {
      const res = await window.electronAPI.obtenerPeriodosDeEntidad({ entityType, entityId });
      return res?.success ? res.data : [];
    } catch (error) {
      console.error("Error cargando periodos asignados:", error);
      return [];
    }
  }

  async _addEntityToPeriod(entityType, entityId, periodId) {
    const res = await window.electronAPI.agregarEntidadAPeriodo({ entityType, entityId, periodId });
    if (!res?.success) throw new Error(res?.error || "No se pudo vincular al periodo");
    return res;
  }

  async _removeEntityFromPeriod(entityType, entityId, periodId) {
    const res = await window.electronAPI.removerEntidadDePeriodo({ entityType, entityId, periodId });
    if (!res?.success) throw new Error(res?.error || "No se pudo desvincular del periodo");
    return res;
  }

  // =========================================================
  // HANDLERS: RELACIONES OPERATIVAS
  // =========================================================

  _bindOperationalRelationEvents(container) {
    container.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const relation = btn.closest("[data-relation]")?.dataset.relation;
      if (action === "configure") await this._openRelationConfigFlow(relation, this.state.activePeriod);
    });
  }

  async _openRelationConfigFlow(relationId, periodId) {
    Toast.info(`Configuración de ${relationId} (en desarrollo)`);
  }

  async _handleRelationAction(relationId, action, data) {
    console.log(`[Action] ${action} en ${relationId}`, data);
  }

  _getAvailableEntitiesForRelation(relationId, periodId) {
    return [];
  }

  // =========================================================
  // TABS: NAVEGACIÓN CON VISTAS PERSISTENTES
  // =========================================================

  async _switchTab(tabId) {
    if (this.state.isLoading) return;

    // 1. Actualizar estado
    this.state.activeTab = tabId;

    // 2. Actualizar UI de botones
    this.elements.workspaceTabs.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    // 3. Toggle de vistas persistentes
    if (this.elements.viewGestionar && this.elements.viewConsultar) {
      this.elements.viewGestionar.classList.toggle("hidden", tabId !== "gestionar");
      this.elements.viewConsultar.classList.toggle("hidden", tabId !== "consultar");
    }

    // 4. Renderizar según tab activo (con caché)
    this._showWorkspaceLoader(tabId === "consultar" ? "Cargando historial..." : "Actualizando...");

    try {
      if (tabId === "gestionar") {
        await this._renderGestionarView();
      } else if (tabId === "consultar") {
        await this._renderConsultRelations();
      }
    } catch (error) {
      console.error(`Error renderizando tab ${tabId}:`, error);
      if (tabId === "gestionar" && this.elements.viewGestionar) {
        this.elements.viewGestionar.innerHTML = `<p class="error-msg">Error al cargar la vista.</p>`;
      }
    } finally {
      this._hideWorkspaceLoader();
    }
  }

  // =========================================================
  // CAMBIO DE PERIODO
  // =========================================================

  async _handlePeriodChange() {
    this._invalidateCache();
    await this._renderSidebarRelations();

    if (this.state.activeTab === "gestionar") {
      await this._renderGestionarView();
    } else {
      await this._renderConsultRelations();
    }
  }

  // =========================================================
  // CACHE
  // =========================================================

  _getCacheKey() {
    const { entityType, entityId } = this.state.context;
    const periodId = this.state.activePeriod || "global";
    return `${entityType}_${entityId}_${periodId}`;
  }

  _invalidateCache() {
    this._viewCache.gestionar = null;
    this._viewCache.consultar = null;
  }

  // =========================================================
  // LOADER
  // =========================================================

  _showWorkspaceLoader(message = "Cargando...") {
    if (this.elements.workspaceLoader) this.elements.workspaceLoader.remove();
    this.elements.workspaceLoader = uiLoader.showInContainer(this.elements.workspaceContent, message);
    this.state.isLoading = true;
  }

  _hideWorkspaceLoader() {
    if (this.elements.workspaceLoader) {
      uiLoader.hideInContainer(this.elements.workspaceContent, this.elements.workspaceLoader);
      this.elements.workspaceLoader = null;
    }
    this.state.isLoading = false;
  }

  // =========================================================
  // EVENTOS GLOBALES
  // =========================================================

  _bindGlobalEvents() {
    const close = () => this.elements.overlay.classList.add("hidden");

    document.getElementById("btn-close-modal").onclick = close;
    document.getElementById("btn-cancelar-asig").onclick = close;

    this.elements.overlay.addEventListener("click", (e) => {
      if (e.target === this.elements.overlay) close();
    });

    // Tabs
    this.elements.workspaceTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (!btn) return;
      this._switchTab(btn.dataset.tab);
    });

    // Delegación de eventos para acciones dinámicas
    this.elements.workspaceContent.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const relation = btn.closest("[data-relation]")?.dataset.relation;
      if (action === "configure") {
        await this._openRelationConfigFlow(relation, this.state.activePeriod);
      }
    });
  }

  // =========================================================
  // REGISTRO DE RELACIONES
  // =========================================================

  registerTab(entityType, config) {
    if (!this._registeredRelations.has(entityType)) {
      this._registeredRelations.set(entityType, []);
    }
    this._registeredRelations.get(entityType).push(config);
  }

  _getRegisteredRelations(entityType) {
    return this._registeredRelations?.get(entityType) || [];
  }
}