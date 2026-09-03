// src/renderer/modules/TesisModule.js
import { DataTable } from "../components/DataTable/DataTable.js";
import modalTesisHtml from "../views/partials/modals/modal-tesis.html";
import { FormAutosave } from "../utils/formAutosave.js";
import { UnsavedChangesGuard } from "../utils/unsavedChanges.js";
import { globalConfirm } from "../utils/confirmationModal.js";
import { Toast } from "../components/common/Toast.js";

export class TesisModule {
  constructor() {
    this.data = [];
    this.docentes = [];
    this.alumnos = [];
    this.table = null;
    this.modalElement = null;
    this.formAutosave = null;
    this.unsavedGuard = null;
    this.initialized = false;
    this._modalInjected = false;
    this._cleanup = []; // ← registro central de listeners
    this.tbodyId = "tabla-tesis-body";
    this.instanceName = "tesisModuleInstance";
    this.ROLES = [
      "director",
      "codirector",
      "presidente",
      "secretario",
      "vocal",
    ];
  }

  _on(el, event, fn) {
    // ← agrega y trackea
    if (!el) return;
    el.addEventListener(event, fn);
    this._cleanup.push(() => el.removeEventListener(event, fn));
  }

  async init() {
    if (this.initialized) return;
    this._injectModal();
    await this._waitForDOM(this.tbodyId);
    await this._loadCatalogs();
    if (!this.data?.length) await this._loadData();

    const tbody = document.getElementById(this.tbodyId);
    if (!tbody) {
      Toast.error("Tabla de tesis no encontrada", 5000);
      return;
    }

    this.table = new DataTable({
      tbodyId: this.tbodyId,
      columns: this._getColumns(),
      expandable: false,
      actions: true,
    });

    this.data?.length
      ? this.table.setData(this.data)
      : this._renderEmptyState();

    // Delegación de menú contextual (trackeada)
    this._on(tbody, "click", (e) => {
      const item = e.target.closest(".context-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      document
        .querySelectorAll(".context-menu")
        .forEach((m) => m.classList.add("hidden"));
      const { action, id } = item.dataset;
      if (action === "edit") this.openEditModalFromMenu(id);
      else if (action === "toggle") this.toggleTesisStatus(id);
    });

    this._setupSearch();
    this._setupModalEvents();
    window[this.instanceName] = this;
    this.initialized = true;
  }

  _injectModal() {
    if (this._modalInjected || document.getElementById("modal-tesis")) {
      this.modalElement = document.getElementById("modal-tesis");
      this._modalInjected = true;
      console.log("💾 [TesisModule] Modal ya existía, reutilizando");
      return;
    }
    const t = document.createElement("div");
    t.innerHTML = modalTesisHtml;
    document.body.appendChild(t.firstElementChild);
    this.modalElement = document.getElementById("modal-tesis");
    this._modalInjected = true;
    console.log("✅ [TesisModule] Modal inyectado:", this.modalElement); // ← AGREGAR
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
      const [d, a] = await Promise.all([
        window.electronAPI.listarDocentesSelect({}),
        window.electronAPI.obtenerAlumnosSelect(),
      ]);
      this.docentes = d?.data || [];
      this.alumnos = a?.data || [];
    } catch (e) {
      console.warn("[TesisModule] catálogos:", e);
    }
  }

  async _loadData() {
    const res = await window.electronAPI.obtenerListaTesis();
    if (res?.success) this.data = res.rows || [];
    else Toast.warning("No se pudieron cargar las actas", 4000);
  }

  _getColumns() {
    return [
      {
        key: "folio",
        label: "Folio",
        format: (v) => `<strong>${v}</strong>`,
        width: "70px",
      },
      { key: "fecha", label: "Fecha" },
      { key: "hora", label: "Hora", width: "70px" },
      { key: "alumno_nombre", label: "Alumno" },
      { key: "alumno_matricula", label: "Matrícula" },
      { key: "titulo", label: "Título" },
      { key: "modalidad", label: "Modalidad" },
      { key: "resultado", label: "Resultado" },
      { key: "director", label: "Director" },
      { key: "codirector", label: "Codirector" },
      { key: "presidente", label: "Presidente" },
      { key: "secretario", label: "Secretario" },
      { key: "vocal", label: "Vocal" },
      { key: "estado", label: "Estado" },
    ];
  }

  _setupSearch() {
    const input = document.getElementById("buscador-tesis");
    this._on(input, "input", (e) => {
      const txt = e.target.value.toLowerCase().trim();
      if (!txt) return this.table?.setData(this.data);
      this.table?.setData(
        this.data.filter(
          (t) =>
            String(t.folio).includes(txt) ||
            (t.alumno_nombre || "").toLowerCase().includes(txt) ||
            (t.titulo || "").toLowerCase().includes(txt),
        ),
      );
    });
  }

  _setupModalEvents() {
    const btnNuevo = document.getElementById("btn-nueva-tesis");
    console.log("🔍 [TesisModule] btn-nueva-tesis encontrado:", btnNuevo); // ← AGREGAR
    console.log("🔍 [TesisModule] modalElement:", this.modalElement); // ← AGREGAR

    this._on(btnNuevo, "click", (e) => {
      console.log("👆 [TesisModule] Click en Nueva Acta"); // ← AGREGAR
      e.preventDefault();
      this._openModal();
    });

    const cerrar = async () => {
      if (this.unsavedGuard?.hasUnsavedChanges) {
        const ok = await globalConfirm.ask(
          "Tienes cambios sin guardar. ¿Salir sin guardar?",
        );
        if (!ok) return;
      }
      this._ejecutarCierre();
    };
    this._on(this.modalElement?.querySelector(".btn-close"), "click", cerrar);
    this._on(document.getElementById("btn-cancelar-tesis"), "click", cerrar);

    const btnSave = document.getElementById("btn-guardar-tesis");
    this._on(btnSave, "click", async (e) => {
      e.preventDefault();
      await this._saveTesis();
    });
  }

  _renderParticipantes(vals = {}) {
    const wrap = document.getElementById("tesis-participantes");
    if (!wrap) return;
    wrap.innerHTML = "";
    this.ROLES.forEach((rol) => {
      const v = vals[rol] || {};
      const div = document.createElement("div");
      div.className = "form-group";
      div.innerHTML = `
        <label style="text-transform:capitalize">${rol}</label>
        <select class="form-control part-select" data-rol="${rol}">
          <option value="">— Sin ${rol} —</option>
          ${this.docentes.map((d) => `<option value="${d.id}" ${v.docente_id == d.id ? "selected" : ""}>${d.apellido_paterno} ${d.nombres}</option>`).join("")}
          <option value="__externo__" ${v.docente_id == null && v.nombre ? "selected" : ""}>— Externo —</option>
        </select>
        <input type="text" class="form-control part-externo hidden" data-rol="${rol}" placeholder="Nombre del externo" value="${v.nombre || ""}">
      `;
      const sel = div.querySelector(".part-select");
      const ext = div.querySelector(".part-externo");
      const sync = () =>
        ext.classList.toggle("hidden", sel.value !== "__externo__");
      sel.addEventListener("change", sync);
      sync();
      wrap.appendChild(div);
    });
  }

  _openModal(t = null) {
    console.log("📖 [TesisModule] _openModal llamado"); // ← AGREGAR
    const modal = this.modalElement;
    const form = document.getElementById("form-tesis");
    console.log("📖 [TesisModule] modal:", modal, "form:", form); // ← AGREGAR

    if (!modal || !form) {
      console.warn("⚠️ [TesisModule] Modal o form no encontrados, abortando");
      return;
    }
    form.reset();
    this.unsavedGuard = new UnsavedChangesGuard("#form-tesis");
    this.formAutosave = new FormAutosave("form-tesis", "tesis-form");

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v ?? "";
    };
    set("tesis-id", t?.id || "");
    set("tesis-folio", t?.folio || "");
    set("tesis-fecha", t?.fecha);
    set("tesis-hora", t?.hora);
    set("tesis-estado", t?.estado || "aprobada");
    set("tesis-modalidad", t?.modalidad || "tesis");
    set("tesis-resultado", t?.resultado);
    set("tesis-titulo", t?.titulo);
    set("tesis-generacion", t?.generacion);
    set("tesis-fecha-asignacion", t?.fecha_asignacion);

    const selAl = document.getElementById("tesis-alumno");
    selAl.innerHTML =
      `<option value="">Seleccione alumno...</option>` +
      this.alumnos
        .map(
          (a) =>
            `<option value="${a.id}" ${t?.alumno_id == a.id ? "selected" : ""}>${a.matricula} — ${a.apellido_paterno} ${a.nombres}</option>`,
        )
        .join("");

    this._renderParticipantes(t?.participantes || {});
    modal.classList.remove("hidden");
    console.log("✅ [TesisModule] Modal abierto"); 
  }

  async openEditModalFromMenu(id) {
    const t = this.data.find((x) => String(x.id) === String(id));
    if (!t) return Toast.error("Acta no encontrada", 4000);
    const det = await window.electronAPI.obtenerDetalleTesis({ id });
    this._openModal({ ...t, participantes: det?.participantes || {} });
  }

  async _saveTesis() {
    const alumnoId = document.getElementById("tesis-alumno")?.value;
    if (!alumnoId) {
      Toast.warning("Seleccione un alumno", 4000);
      return;
    }
    const alumno = this.alumnos.find((a) => String(a.id) === String(alumnoId));

    const participantes = [];
    document
      .querySelectorAll("#tesis-participantes .part-select")
      .forEach((sel) => {
        const rol = sel.dataset.rol;
        const ext = document.querySelector(`.part-externo[data-rol="${rol}"]`);
        if (sel.value === "__externo__") {
          if (ext?.value?.trim())
            participantes.push({
              rol,
              docente_id: null,
              nombre: ext.value.trim(),
            });
        } else if (sel.value) {
          const d = this.docentes.find((x) => String(x.id) === sel.value);
          participantes.push({
            rol,
            docente_id: d.id,
            nombre: `${d.apellido_paterno} ${d.nombres}`,
          });
        }
      });

    const datos = {
      id: document.getElementById("tesis-id")?.value || null,
      alumno_id: +alumnoId,
      alumno_nombre: `${alumno.apellido_paterno} ${alumno.nombres}`,
      alumno_matricula: alumno.matricula,
      fecha: document.getElementById("tesis-fecha")?.value || null,
      hora: document.getElementById("tesis-hora")?.value || null,
      modalidad: document.getElementById("tesis-modalidad")?.value || "tesis",
      resultado: document.getElementById("tesis-resultado")?.value || null,
      titulo: document.getElementById("tesis-titulo")?.value || null,
      generacion: document.getElementById("tesis-generacion")?.value || null,
      fecha_asignacion:
        document.getElementById("tesis-fecha-asignacion")?.value || null,
      estado: document.getElementById("tesis-estado")?.value || "aprobada",
      participantes,
    };

    const res = await window.electronAPI.guardarTesis(datos);
    if (res?.success) {
      Toast.success("Acta guardada correctamente", 4000);
      this._ejecutarCierre();
      await this._loadData();
      this.table?.setData(this.data);
    } else Toast.error(res?.error || "No se pudo guardar", 6000);
  }

  async toggleTesisStatus(id) {
    const t = this.data.find((x) => String(x.id) === String(id));
    if (!t) return;
    const nuevo = t.estado === "cancelada" ? "aprobada" : "cancelada";
    const ok = await globalConfirm.ask(
      `¿${nuevo === "cancelada" ? "Cancelar" : "Reactivar"} acta folio ${t.folio}?`,
    );
    if (!ok) return;
    const res = await window.electronAPI.actualizarEstadoTesis({
      id: t.id,
      nuevoEstado: nuevo,
    });
    if (res?.success) {
      await this._loadData();
      this.table?.setData(this.data);
    }
  }

  _ejecutarCierre() {
    this.unsavedGuard?.destroy();
    this.unsavedGuard = null;
    this.formAutosave?.clear();
    this.formAutosave = null;
    document.getElementById("form-tesis")?.reset();
    this.modalElement?.classList.add("hidden");
  }

  _renderEmptyState() {
    const tbody = document.getElementById(this.tbodyId);
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="16" style="text-align:center;padding:50px;color:var(--text-muted)">No hay actas registradas</td></tr>`;
  }

  destroy() {
    this._cleanup.forEach((fn) => fn()); // ← retira TODOS los listeners
    this._cleanup = [];
    this.unsavedGuard?.destroy();
    this.formAutosave?.clear();
    delete window[this.instanceName]; // ← libera la instancia global
    this.table = null;
    this.modalElement = null;
    this._modalInjected = false;
  }
}
