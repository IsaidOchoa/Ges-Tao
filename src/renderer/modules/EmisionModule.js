import { Toast } from "../components/common/Toast.js";

export class EmisionModule {
  constructor() {
    this.datosMaestros = {
      tipos: [],
      programas: [],
      periodos: [],
      docentes: [],
      directivos: [],
    };
    this.contexto = {
      tipo: null,
      programa: null,
      periodo: null,
      docente: null,
    };
    this.datosAutoCargados = { ee: [], fecha: new Date(), firmas: {} };
  }

  async init() {
    await this.cargarDatosIniciales();
    this.configurarFormulario();
    this.establecerFechaDefault();
    this.actualizarPreview();
  }

  async cargarDatosIniciales() {
    try {
      const resp = await window.electronAPI.obtenerDatosConstancia();
      if (!resp?.success)
        throw new Error(resp?.error || "Error al cargar catálogos");

      this.datosMaestros = {
        tipos: resp.data.tipos || [],
        programas: resp.data.programas || [],
        periodos: resp.data.periodos || [],
        docentes: resp.data.docentes || [],
        directivos: resp.data.directivos || [],
      };
      this.llenarSelectores();
    } catch (err) {
      Toast.error("Error de carga", err.message);
    }
  }

  llenarSelectores() {
    const fill = (id, items, defaultTxt, valKey = "id", txtFn = null) => {
      const sel = document.getElementById(id);
      if (!sel) return;

      // Limpiar opciones previas y poner el default
      sel.innerHTML = `<option value="">${defaultTxt}</option>`;

      if (!Array.isArray(items) || items.length === 0) return;

      // Si no se pasa una función específica, intenta usar 'nombre' por defecto
      const defaultTextFn = (i) => i.nombre || i.clave || i.codigo || "";

      items.forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item[valKey];

        // 🔹 Aquí está la corrección: Usar la función personalizada o la genérica
        opt.textContent = txtFn ? txtFn(item) : defaultTextFn(item);

        sel.appendChild(opt);
      });
    };

    // 1. Tipos (Usa txtFn específico)
    fill(
      "sel-tipo",
      this.datosMaestros.tipos,
      "Seleccione un tipo...",
      "id",
      (i) => i.nombre,
    );

    // 2. Programa (Usa txtFn específico)
    fill(
      "sel-programa",
      this.datosMaestros.programas,
      "Seleccione un programa...",
      "id",
      (i) => i.nombre,
    );

    // 3. Periodo 🔹 CORRECCIÓN AQUÍ:
    // Antes fallaba porque buscaba 'nombre' que no existe en periodos.
    // Ahora usamos 'clave' y 'descripcion'.
    fill(
      "sel-periodo",
      this.datosMaestros.periodos,
      "Seleccione un periodo...",
      "id",
      (p) => `${p.clave} - ${p.descripcion}`,
    );

    // 4. Docente (Usa txtFn específico)
    fill(
      "sel-docente",
      this.datosMaestros.docentes,
      "Seleccione un docente...",
      "id",
      (d) => `${d.apellido_paterno}, ${d.nombres} (${d.codigo})`,
    );

    fillSelect(
      "sel-ee",
      this.datosMaestros.ee,
      "Ninguna",
      "id",
      (i) => `${i.nrc || i.clave_ee} - ${i.nombre}`,
    );
  }

  configurarFormulario() {
    // 1. Contexto -> Habilita docente
    ["sel-tipo", "sel-programa", "sel-periodo"].forEach((id) => {
      document
        .getElementById(id)
        ?.addEventListener("change", () => this.actualizarContexto());
    });

    // 2. Docente -> Dispara auto-carga
    document.getElementById("sel-docente")?.addEventListener("change", (e) => {
      if (e.target.value) this.cargarDatosDocente(e.target.value);
      else this.limpiarAutoCarga();
    });

    // 3. Fecha -> Actualiza preview en tiempo real
    document
      .getElementById("input-fecha-emision")
      ?.addEventListener("change", (e) => {
        this.datosAutoCargados.fecha = e.target.value
          ? new Date(e.target.value)
          : new Date();
        this.actualizarPreview();
      });

    // 4. Submit & Limpiar
    document
      .getElementById("form-constancia")
      ?.addEventListener("submit", (e) => this.generarConstancia(e));
    document
      .getElementById("btn-limpiar")
      ?.addEventListener("click", () => this.limpiarTodo());
  }

  actualizarContexto() {
    this.contexto.tipo = document.getElementById("sel-tipo").value;
    this.contexto.programa = document.getElementById("sel-programa").value;
    this.contexto.periodo = document.getElementById("sel-periodo").value;

    // Habilitar docente solo si hay periodo seleccionado
    const selDoc = document.getElementById("sel-docente");
    if (this.contexto.periodo) {
      selDoc.disabled = false;
      selDoc.options[0].textContent = "Seleccione un docente...";
    } else {
      selDoc.disabled = true;
      selDoc.value = "";
      selDoc.options[0].textContent = "Primero seleccione periodo...";
      this.limpiarAutoCarga();
    }
    this.actualizarPreview();
  }

  async cargarDatosDocente(docenteId) {
    this.contexto.docente = docenteId;
    const tbody = document.getElementById("preview-tabla-body");
    tbody.innerHTML =
      '<tr><td colspan="7" class="loading-state">Cargando datos...</td></tr>';

    try {
      // Verificación de seguridad
      if (!window.electronAPI?.obtenerDatosDocenteContexto) {
        throw new Error("API no disponible. Verifica preload.js y reinicia.");
      }

      const resp = await window.electronAPI.obtenerDatosDocenteContexto({
        docente_id: parseInt(docenteId), // 🔹 Forzar número
        periodo_id: parseInt(this.contexto.periodo), // 🔹 Forzar número
      });

      if (!resp?.success) throw new Error(resp?.error || "Sin datos");

      // 🔹 MAPEO CORRECTO: Aseguramos que 'id' sea numérico
      this.datosAutoCargados = {
        ee: (resp.data.asignaciones || []).map((a) => ({
          id: a.ee_id,
          nombre: a.ee_nombre,
          nrc: a.nrc || "N/A",
          hsm: a.carga_horaria || 0,
          horas: (a.carga_horaria || 0) * 16, // Cálculo simple en JS, no en SQL
          creditos: 8, // Valor por defecto si no viene en la tabla simple
          periodo: a.periodo_desc || "",
          alumnos: 0,
        })),
        firmas: resp.data.firmas || {},
      };

      // Actualizar UI
      const selEE = document.getElementById("sel-ee");
      if (selEE && this.datosAutoCargados.ee.length > 0) {
        selEE.value = this.datosAutoCargados.ee[0].id;
        selEE.disabled = false;
      }

      this.renderTabla();
      this.actualizarPreview();
      console.log(
        "✅ Docente cargado. ee_id:",
        this.datosAutoCargados.ee[0]?.id,
      );
    } catch (err) {
      // 🔹 TOAST SEGURO: Solo 2 parámetros, mensaje claro, duración larga
      console.error(" Error en cargarDatosDocente:", err);
      Toast.error("Error al cargar datos del docente: " + err.message, 8000);
      this.limpiarAutoCarga();
    }
  }

  renderTabla() {
    const tbody = document.getElementById("preview-tabla-body");
    tbody.innerHTML = "";

    if (!this.datosAutoCargados.ee || this.datosAutoCargados.ee.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="empty-state">Sin asignaciones registradas para este periodo</td></tr>';
      return;
    }

    this.datosAutoCargados.ee.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.nrc}</td>
        <td>${row.nombre}</td>
        <td>${row.hsm}</td>
        <td>${row.horas}</td>
        <td>${row.creditos}</td>
        <td>${row.periodo}</td>
        <td>${row.alumnos}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  establecerFechaDefault() {
    const input = document.getElementById("input-fecha-emision");
    if (input) {
      const hoy = new Date().toISOString().split("T")[0];
      input.value = hoy;
      this.datosAutoCargados.fecha = new Date();
    }
  }

  actualizarPreview() {
    // Fecha formal
    const fecha = this.datosAutoCargados.fecha || new Date();
    const opts = { day: "numeric", month: "long", year: "numeric" };
    const partes = new Intl.DateTimeFormat("es-MX", opts).formatToParts(fecha);

    document.getElementById("preview-dia").textContent = partes.find(
      (p) => p.type === "day",
    ).value;
    document.getElementById("preview-mes").textContent = partes.find(
      (p) => p.type === "month",
    ).value;
    document.getElementById("preview-anio").textContent = partes.find(
      (p) => p.type === "year",
    ).value;

    // Firmas
    if (this.datosAutoCargados.firmas.coord) {
      document.getElementById("preview-firma1-nombre").textContent =
        this.datosAutoCargados.firmas.coord.nombre;
    }
    if (this.datosAutoCargados.firmas.director) {
      document.getElementById("preview-firma2-nombre").textContent =
        this.datosAutoCargados.firmas.director.nombre;
    }
  }

  limpiarAutoCarga() {
    this.contexto.docente = null;
    this.datosAutoCargados = {
      ee: [],
      fecha: this.datosAutoCargados.fecha,
      firmas: {},
    };
    document.getElementById("preview-tratamiento").textContent = "El/La";
    document.getElementById("preview-nombre-docente").textContent =
      "[NOMBRE DEL DOCENTE]";
    document.getElementById("preview-codigo-docente").textContent = "[CÓDIGO]";
    document.getElementById("preview-tabla-body").innerHTML =
      '<tr><td colspan="7" class="empty-state">Seleccione un docente para cargar asignaciones</td></tr>';
    this.actualizarPreview();
  }

  limpiarTodo() {
    document.getElementById("form-constancia").reset();
    this.contexto = {
      tipo: null,
      programa: null,
      periodo: null,
      docente: null,
    };
    this.limpiarAutoCarga();
    document.getElementById("sel-docente").disabled = true;
    this.establecerFechaDefault();
  }

  async generarConstancia(e) {
  e.preventDefault();
  
  // 🔹 VALIDACIÓN DIRECTA AL DOM (Evita problemas de estado asíncrono)
  const docenteVal = document.getElementById('sel-docente')?.value;
  if (!docenteVal) {
    Toast.warning('Seleccione un docente para continuar.', 6000);
    return;
  }

  const btn = document.getElementById('btn-generar');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando PDF...';

  // Construcción del Payload
  const payload = {
    tipo_constancia_id: parseInt(this.contexto.tipo),
    programa_id: parseInt(this.contexto.programa),
    docente_id: parseInt(docenteVal),
    periodo_id: this.contexto.periodo ? parseInt(this.contexto.periodo) : null,
    
    //  PRIORIDAD: ID auto-cargado (garantiza que viene de la BD)
    ee_id: this.datosAutoCargados.ee?.[0]?.id || null,
    
    fecha_emision: document.getElementById('input-fecha-emision')?.value || new Date().toISOString().split('T')[0],
    cuerpoHtml: this.generarHtmlCuerpo(),
    cierreHtml: this.generarHtmlCierre(),
    eeList: this.datosAutoCargados.ee || [],
    firmaCoord: this.datosAutoCargados.firmas?.coord?.nombre || '',
    firmaDirector: this.datosAutoCargados.firmas?.director?.nombre || ''
  };

  console.log(' Payload final -> EE_ID:', payload.ee_id);

  // Validación lógica antes de enviar
  if (this.tipoSeleccionado?.requiere_ee && !payload.ee_id) {
    Toast.error('Este tipo requiere una Experiencia Educativa. Verifique que el docente tenga asignaciones.', 8000);
    btn.disabled = false; btn.innerHTML = originalText; return;
  }

  try {
    const resp = await window.electronAPI.generarConstanciaPDF(payload);

    if (resp.success) {
      document.getElementById('preview-folio').textContent = resp.folio;
      Toast.success(`Constancia emitida. Folio: ${resp.folio}`, 8000);
      setTimeout(() => this.limpiarTodo(), 3000);
    } else {
      Toast.error(`Error del servidor: ${resp.error}`, 10000);
    }
  } catch (err) {
    console.error('❌ Error crítico:', err);
    Toast.error(`Error de conexión: ${err.message}`, 10000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

  // Helpers para construir HTML seguro (inyección controlada)
  generarHtmlCuerpo() {
    const doc = this.datosMaestros.docentes.find(
      (d) => d.id == this.contexto.docente,
    );
    if (!doc) return "";
    return `Que <strong>${doc.tratamiento || "El/La"} ${doc.nombres} ${doc.apellido_paterno} ${doc.apellido_materno || ""}</strong>, con número de personal <strong>${doc.codigo}</strong>, pertenece al cuerpo docente del Programa Educativo de Posgrado Maestría en Sistemas Interactivos Centrados en el Usuario (16156), programa adscrito a la Facultad de Estadística e Informática (11304) y ha impartido las siguientes experiencias educativas:`;
  }

  generarHtmlCierre() {
    const fecha = new Date(
      document.getElementById("input-fecha-emision").value || Date.now(),
    );
    const opts = { day: "numeric", month: "long", year: "numeric" };
    const partes = new Intl.DateTimeFormat("es-MX", opts).formatToParts(fecha);
    const dia = partes.find((p) => p.type === "day")?.value || "__";
    const mes = partes.find((p) => p.type === "month")?.value || "________";
    const anio = partes.find((p) => p.type === "year")?.value || "____";
    return `Para los fines que al interesado convenga se extiende la presente en la ciudad de Xalapa, Enríquez, Veracruz a los <strong>${dia}</strong> días del mes de <strong>${mes}</strong> del año <strong>${anio}</strong>.`;
  }
}
