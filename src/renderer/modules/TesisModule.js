// src/renderer/modules/TesisModule.js
import { DataTable } from "../components/DataTable/DataTable.js";
import modalTesisHtml from "../views/partials/modals/modal-tesis.html";
import { FormAutosave } from "../utils/formAutosave.js";
import { UnsavedChangesGuard } from "../utils/unsavedChanges.js";
import { globalConfirm } from "../utils/confirmationModal.js";
import { Toast } from "../components/common/Toast.js";
import { Tooltip } from "../utils/toolTip.js";

export class TesisModule {
  constructor() {
    this.data = [];
    this.docentes = [];
    this.alumnos = [];
    this.generaciones = [];
    this.table = null;
    this.modalElement = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this.initialized = false;
    this._modalInjected = false;
    this._cleanup = [];
    this._editMode = false;
    this._tooltips = [];
    this.tbodyId = "tabla-tesis-body";
    this.instanceName = "tesisModuleInstance";
    this.ROLES = ["director", "codirector", "presidente", "secretario", "vocal"];

    this.TIPS = {
      "estado": "Una acta cancelada conserva su folio, pero no datos ni participantes.",
      "fecha-examen": "Día en que se realizó (o realizará) la defensa. No es la fecha de captura.",
      "hora-examen": "Hora de inicio de la defensa.",
      "resultado": "Veredicto emitido por el jurado. Escríbelo o elige una sugerencia.",
      "generacion": "Cohorte a la que pertenece el alumno.",
      "fecha-asignacion": "Día en que se asignó al director del trabajo. Puede ser muy anterior al examen."
    };
  }

  _on(el, event, fn) {
    if (!el) return;
    el.addEventListener(event, fn);
    this._cleanup.push(() => el.removeEventListener(event, fn));
  }

  async init() {
    if (this.initialized) {
      this._cleanup.forEach((fn) => fn());
      this._cleanup = [];
    }
    this._injectModal();
    this._setupTooltips();
    await this._waitForDOM(this.tbodyId);
    await this._loadCatalogs();
    if (!this.data || this.data.length === 0) await this._loadData();
    this._renderTable();
    this._setupTableEvents();
    this._setupSearch();
    this._setupModalEvents();
    window[this.instanceName] = this;
    this.initialized = true;
  }

  _injectModal() {
    if (this._modalInjected || document.getElementById("modal-tesis")) {
      this.modalElement = document.getElementById("modal-tesis");
      this._modalInjected = true;
      return;
    }
    const t = document.createElement("div");
    t.innerHTML = modalTesisHtml;
    document.body.appendChild(t.firstElementChild);
    this.modalElement = document.getElementById("modal-tesis");
    this._modalInjected = true;
  }

  _setupTooltips() {
    if (!this.modalElement) return;
    this.modalElement.querySelectorAll("[data-tip]").forEach((el) => {
      if (el.dataset.tipBound) return;
      const content = this.TIPS[el.dataset.tip];
      if (!content) return;
      this._tooltips.push(new Tooltip({ target: el, content: content, position: "top" }));
      el.dataset.tipBound = "1";
    });
  }

  async _waitForDOM(id, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (document.getElementById(id)) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }

  async _loadCatalogs() {
    try {
      const resultados = await Promise.all([
        window.electronAPI.listarDocentesSelect({}),
        window.electronAPI.obtenerAlumnosSelect(),
        window.electronAPI.listarGeneraciones()
      ]);
      this.docentes = (resultados[0] && resultados[0].data) || [];
      this.alumnos = (resultados[1] && resultados[1].data) || [];
      this.generaciones = (resultados[2] && resultados[2].data) || [];
    } catch (e) {
      console.warn("[TesisModule] Error cargando catálogos:", e);
    }
  }

  async _loadData() {
    try {
      const res = await window.electronAPI.obtenerListaTesis();
      if (res && res.success) this.data = res.rows || [];
      else Toast.warning("No se pudieron cargar las actas", 4000);
    } catch (e) {
      console.error("[TesisModule] Error cargando actas:", e);
    }
  }

  _renderTable() {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) return;
    const table = tbody.closest("table");

    if (!this.data || this.data.length === 0) {
      if (table) table.classList.remove("table-tesis");
      this.table = null;
      this._renderEmptyState();
      return;
    }

    if (table) table.classList.add("table-tesis");
    if (!this.table) {
      this.table = new DataTable({
        tbodyId: this.tbodyId,
        columns: this._getColumns(),
        expandable: false,
        actions: true
      });
    }
    this.table.setData(this.data);
  }

    _getColumns() {
    const fmtFecha = (v) => (v ? v.split("-").reverse().join("/") : "-");
    return [
      { key: "folio", label: "Folio", format: (v) => "<strong>" + (v || "-") + "</strong>", width: "70px" },
      { key: "fecha", label: "Fecha examen", format: fmtFecha },
      { key: "hora", label: "Hora", width: "70px" },
      { key: "alumno_nombre", label: "Alumno" },
      { key: "alumno_matricula", label: "Matrícula" },
      { key: "generacion", label: "Generación" },
      { key: "titulo", label: "Título" },
      { key: "modalidad", label: "Modalidad" },
      { key: "resultado", label: "Resultado" },
      { key: "fecha_asignacion", label: "Fecha asignación", format: fmtFecha },
      { key: "director", label: "Director" },
      { key: "codirector", label: "Codirector" },
      { key: "presidente", label: "Presidente" },
      { key: "secretario", label: "Secretario" },
      { key: "vocal", label: "Vocal" },
      { key: "estado", label: "Estado" }
    ];
  }

  _findTesis(rowId) {
    return this.data.find((x) => String(x.id) === String(rowId) || String(x.folio) === String(rowId));
  }

  _setupTableEvents() {
    const tbody = document.getElementById(this.tbodyId);
    this._on(tbody, "click", (e) => {
      const item = e.target.closest(".context-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll(".context-menu").forEach((m) => m.classList.add("hidden"));
      const action = item.dataset.action;
      const id = item.dataset.id;
      if (action === "edit") this._openEditFromMenu(id);
      if (action === "toggle") this._toggleEstado(id);
    });
  }

  async _openEditFromMenu(id) {
    const t = this._findTesis(id);
    if (!t) {
      Toast.error("Acta no encontrada", 4000);
      return;
    }
    const det = await window.electronAPI.obtenerDetalleTesis({ id: t.id });
    if (!det || !det.success) {
      Toast.error("No se pudo cargar el detalle de participantes", 6000);
      return;
    }
    const completo = Object.assign({}, t, { participantes: det.data.participantes || {} });
    this._openModal(completo);
  }

  async _toggleEstado(id) {
    const t = this._findTesis(id);
    if (!t) return;
    const nuevo = t.estado === "cancelada" ? "aprobada" : "cancelada";
    const pregunta = nuevo === "cancelada"
      ? "¿Cancelar el acta folio " + t.folio + "?"
      : "¿Reactivar el acta folio " + t.folio + "?";
    const ok = await globalConfirm.ask(pregunta);
    if (!ok) return;
    const res = await window.electronAPI.actualizarEstadoTesis({ id: t.id, nuevoEstado: nuevo });
    if (res && res.success) {
      Toast.success(nuevo === "cancelada" ? "Acta cancelada" : "Acta reactivada", 4000);
      await this._loadData();
      this._renderTable();
    } else {
      Toast.error((res && res.error) || "No se pudo cambiar el estado", 6000);
    }
  }

  _setupSearch() {
    const input = document.getElementById("buscador-tesis");
    this._on(input, "input", (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) {
        if (this.table) this.table.setData(this.data);
        return;
      }
      const filtered = this.data.filter((t) => {
        const folio = String(t.folio || "");
        const alumno = (t.alumno_nombre || "").toLowerCase();
        const titulo = (t.titulo || "").toLowerCase();
        return folio.includes(txt) || alumno.includes(txt) || titulo.includes(txt);
      });
      if (this.table) this.table.setData(filtered);
    });
  }

  _setupModalEvents() {
    const btnNuevo = document.getElementById("btn-nueva-tesis");
    this._on(btnNuevo, "click", (e) => {
      e.preventDefault();
      this._openModal();
    });

    const intentarCerrar = async () => {
      if (this.unsavedGuard && this.unsavedGuard.hasUnsavedChanges) {
        const ok = await globalConfirm.ask("Tienes cambios sin guardar. ¿Salir sin guardar?");
        if (!ok) return;
      }
      this._ejecutarCierre();
    };

    const btnClose = this.modalElement ? this.modalElement.querySelector(".btn-close") : null;
    this._on(btnClose, "click", intentarCerrar);
    this._on(document.getElementById("btn-cancelar-tesis"), "click", intentarCerrar);
    this._on(this.modalElement, "click", (e) => {
      if (e.target === this.modalElement) intentarCerrar();
    });

    const btnSave = document.getElementById("btn-guardar-tesis");
    this._on(btnSave, "click", async (e) => {
      e.preventDefault();
      await this._saveTesis();
    });
  }

  _ejecutarCierre() {
    if (this.unsavedGuard) this.unsavedGuard.destroy();
    this.unsavedGuard = null;
    if (this.formAutosave) this.formAutosave.clear();
    this.formAutosave = null;
    const form = document.getElementById("form-tesis");
    if (form) form.reset();
    if (this.modalElement) this.modalElement.classList.add("hidden");
  }

  _renderParticipantes(vals) {
    const wrap = document.getElementById("tesis-participantes");
    if (!wrap) return;
    wrap.innerHTML = "";
    this.ROLES.forEach((rol) => {
      const v = vals[rol] || {};
      const div = document.createElement("div");
      div.className = "form-group";
      const label = rol.charAt(0).toUpperCase() + rol.slice(1);

      let options = '<option value="">Sin ' + rol + '</option>';
      this.docentes.forEach((d) => {
        const sel = v.docente_id != null && String(v.docente_id) === String(d.id) ? " selected" : "";
        options += '<option value="' + d.id + '"' + sel + '>' + (d.apellido_paterno || "") + " " + (d.nombres || "") + '</option>';
      });
      const extSel = v.docente_id == null && v.nombre ? " selected" : "";
      options += '<option value="externo"' + extSel + '>Externo</option>';

      div.innerHTML =
        '<label>' + label + '</label>' +
        '<select class="form-control part-select" data-rol="' + rol + '">' + options + '</select>' +
        '<input type="text" class="form-control part-externo hidden" data-rol="' + rol + '" placeholder="Nombre del externo" value="' + (v.nombre || "") + '">';

      const selEl = div.querySelector(".part-select");
      const extEl = div.querySelector(".part-externo");
      const sync = () => {
        extEl.classList.toggle("hidden", selEl.value !== "externo");
      };
      selEl.addEventListener("change", sync);
      sync();
      wrap.appendChild(div);
    });
  }

  _openModal(t) {
    const modal = this.modalElement;
    const form = document.getElementById("form-tesis");
    if (!modal || !form) return;

    this._editMode = Boolean(t);
    form.reset();
    this.unsavedGuard = new UnsavedChangesGuard("#form-tesis");
    this.formAutosave = new FormAutosave("form-tesis", "tesis-form");

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v == null ? "" : v;
    };

    set("tesis-id", t ? t.id : "");
    set("tesis-folio", t ? t.folio : "");
    set("tesis-fecha", t ? t.fecha : "");
    set("tesis-hora", t ? t.hora : "");
    set("tesis-estado", t ? (t.estado || "aprobada") : "aprobada");
    set("tesis-modalidad", t ? (t.modalidad || "tesis") : "tesis");
    set("tesis-resultado", t ? t.resultado : "");
    set("tesis-titulo", t ? t.titulo : "");
    set("tesis-fecha-asignacion", t ? t.fecha_asignacion : "");

    const selAl = document.getElementById("tesis-alumno");
    if (selAl) {
      let html = '<option value="">Seleccione alumno...</option>';
      if (this.alumnos.length === 0) {
        html += '<option value="" disabled>No hay alumnos registrados</option>';
      }
      this.alumnos.forEach((a) => {
        const s = t && String(t.alumno_id) === String(a.id) ? " selected" : "";
        html += '<option value="' + a.id + '"' + s + '>' + a.matricula + ' - ' + (a.apellido_paterno || "") + " " + (a.nombres || "") + '</option>';
      });
      selAl.innerHTML = html;
    }

    const selGen = document.getElementById("tesis-generacion");
    if (selGen) {
      let html = '<option value="">Seleccionar generación...</option>';
      if (this.generaciones.length === 0) {
        html += '<option value="" disabled>No hay generaciones registradas</option>';
      }
      this.generaciones.forEach((g) => {
        const s = t && t.generacion === g.nombre ? " selected" : "";
        html += '<option value="' + g.nombre + '"' + s + '>' + g.nombre + '</option>';
      });
      selGen.innerHTML = html;
    }

    this._renderParticipantes(t && t.participantes ? t.participantes : {});
    if (t && this.formAutosave) this.formAutosave.clear();

    modal.classList.remove("hidden");
    setTimeout(() => {
      const el = document.getElementById("tesis-titulo");
      if (el) el.focus();
    }, 100);
  }

  async _saveTesis() {
    const get = (id) => {
      const el = document.getElementById(id);
      return el && el.value ? el.value.trim() : "";
    };

    const alumnoId = get("tesis-alumno");
    if (!alumnoId) {
      Toast.warning("Seleccione un alumno", 4000);
      return;
    }
    const generacion = get("tesis-generacion");
    if (!generacion) {
      Toast.warning("Seleccione una generación", 4000);
      return;
    }

    const estado = get("tesis-estado") || "aprobada";
    if (estado === "aprobada" && !get("tesis-fecha")) {
      Toast.warning("Indica la fecha del examen para un acta aprobada", 4000);
      return;
    }

    const alumno = this.alumnos.find((a) => String(a.id) === String(alumnoId));

    const participantes = [];
    document.querySelectorAll("#tesis-participantes .part-select").forEach((selEl) => {
      const rol = selEl.dataset.rol;
      const extEl = document.querySelector('.part-externo[data-rol="' + rol + '"]');
      if (selEl.value === "externo") {
        const nombre = extEl && extEl.value ? extEl.value.trim() : "";
        if (nombre) participantes.push({ rol: rol, docente_id: null, nombre: nombre });
      } else if (selEl.value) {
        const d = this.docentes.find((x) => String(x.id) === String(selEl.value));
        if (d) participantes.push({ rol: rol, docente_id: d.id, nombre: (d.apellido_paterno || "") + " " + (d.nombres || "") });
      }
    });

    const datos = {
      id: this._editMode && get("tesis-id") ? parseInt(get("tesis-id"), 10) : null,
      alumno_id: parseInt(alumnoId, 10),
      alumno_nombre: (alumno.apellido_paterno || "") + " " + (alumno.nombres || ""),
      alumno_matricula: alumno.matricula,
      fecha: get("tesis-fecha") || null,
      hora: get("tesis-hora") || null,
      modalidad: get("tesis-modalidad") || "tesis",
      resultado: get("tesis-resultado") || null,
      titulo: get("tesis-titulo") || null,
      generacion: generacion,
      fecha_asignacion: get("tesis-fecha-asignacion") || null,
      estado: estado,
      participantes: participantes
    };

    const btnSave = document.getElementById("btn-guardar-tesis");
    const original = btnSave ? btnSave.innerHTML : "";
    if (btnSave) {
      btnSave.disabled = true;
      btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    }

    try {
      const res = await window.electronAPI.guardarTesis(datos);
      if (res && res.success) {
        Toast.success(datos.id ? "Acta actualizada correctamente" : "Acta registrada correctamente", 4000);
        this._ejecutarCierre();
        await this._loadData();
        this._renderTable();
      } else {
        Toast.error((res && res.error) || "No se pudo guardar el acta", 6000);
      }
    } catch (error) {
      console.error("Error guardando acta:", error);
      Toast.error("Error de conexión con la base de datos", 6000);
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.innerHTML = original;
      }
    }
  }

  _renderEmptyState() {
    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) return;
    tbody.innerHTML =
      '<tr><td colspan="15" style="text-align:center; padding:50px; color:var(--text-muted);">' +
      '<i class="fa-solid fa-file-signature" style="font-size:2.5rem; margin:0 auto 15px auto; display:block; opacity:0.6;"></i>' +
      '<p style="margin:0;">No hay actas registradas</p>' +
      '</td></tr>';
  }

  destroy() {
    this._cleanup.forEach((fn) => fn());
    this._cleanup = [];
    (this._tooltips || []).forEach((t) => t.destroy());
    this._tooltips = [];
    if (this.unsavedGuard) this.unsavedGuard.destroy();
    this.unsavedGuard = null;
    if (this.formAutosave) this.formAutosave.clear();
    this.formAutosave = null;
    delete window[this.instanceName];
    this.table = null;
    this.modalElement = null;
    this._modalInjected = false;
    this.initialized = false;
  }
}