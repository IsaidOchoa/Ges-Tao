import { Toast } from "../components/common/Toast.js";
import modalFirmantesHTML from "../views/partials/modals/modal-firmantes.html";

export class FirmanteModule {
  constructor() {
    this.modalElement = null;
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;

    this._injectModal();
    this._setupEventListeners();
    this._initialized = true;
  }

  _injectModal() {

    if (document.getElementById("modal-firmantes")) {
      this.modalElement = document.getElementById("modal-firmantes");
      return;
    }

    const template = document.createElement("div");
    template.innerHTML = modalFirmantesHTML;
    document.body.appendChild(template.firstElementChild);
    this.modalElement = document.getElementById("modal-firmantes");
  }

  _setupEventListeners() {
    document
      .getElementById("btn-close-firmantes")
      .addEventListener("click", () => this.close());
    document
      .getElementById("btn-cancelar-firmante")
      .addEventListener("click", () => this._resetForm());
    document
      .getElementById("btn-guardar-firmante")
      .addEventListener("click", () => this._guardar());

    this.modalElement.addEventListener("click", (e) => {
      if (e.target === this.modalElement) this.close();
    });
  }

  open() {
    this.modalElement.classList.remove("hidden");

    const input = document.getElementById("firmante-texto");
    if (input) {
      input.disabled = false;
      input.focus();
    }

    this._cargarLista();
  }

  close() {
    this.modalElement.classList.add("hidden");
    this._resetForm();
  }

  _resetForm() {
    document.getElementById("firmante-texto").value = "";
    document.getElementById("firmante-id").value = "";
  }

  async _cargarLista() {
    const listContainer = document.getElementById("firmante-list");
    listContainer.innerHTML = '<p class="loading">Cargando...</p>';

    try {
      const response = await window.electronAPI.listarFirmantes();
      if (!response.success) throw new Error(response.error);

      const firmantes = response.data;
      if (firmantes.length === 0) {
        listContainer.innerHTML =
          '<p class="empty-state">No hay firmantes registrados.</p>';
        return;
      }

      listContainer.innerHTML = firmantes
        .map(
          (f) => `
          <div class="firmante-item" data-id="${f.id}">
            <span class="firmante-texto">${this._escapeHtml(f.texto)}</span>
            <div class="firmante-actions">
              <button class="btn-icon btn-edit" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn-icon btn-delete" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `,
        )
        .join("");

      listContainer.querySelectorAll(".btn-edit").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const item = e.target.closest(".firmante-item");
          this._editar(item.dataset.id);
        });
      });

      listContainer.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const item = e.target.closest(".firmante-item");
          this._eliminar(item.dataset.id);
        });
      });
    } catch (error) {
      listContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
  }

  _editar(id) {
    const item = document.querySelector(`.firmante-item[data-id="${id}"]`);
    const texto = item.querySelector(".firmante-texto").textContent;
    document.getElementById("firmante-texto").value = texto;
    document.getElementById("firmante-id").value = id;
  }

  async _guardar() {
    const texto = document.getElementById("firmante-texto").value.trim();
    const id = document.getElementById("firmante-id").value || null;

    if (!texto) {
      Toast.warning("El texto del firmante es obligatorio");
      return;
    }

    try {
      const response = await window.electronAPI.guardarFirmante({ id, texto });
      if (!response.success) throw new Error(response.error);

      Toast.success(id ? "Firmante actualizado" : "Firmante agregado");
      this._resetForm();
      await this._cargarLista();

      if (window.emisionModuleInstance) {
        await window.emisionModuleInstance.recargarFirmantes();
      }
    } catch (error) {
      Toast.error(`Error: ${error.message}`);
    }
  }

  async _eliminar(id) {
    if (!confirm("¿Eliminar este firmante?")) return;

    try {
      const response = await window.electronAPI.eliminarFirmante(id);
      if (!response.success) throw new Error(response.error);

      Toast.success("Firmante eliminado");
      await this._cargarLista();

      // Recargar firmantes en el módulo de emisión
      if (window.emisionModuleInstance) {
        await window.emisionModuleInstance.recargarFirmantes();
      }
    } catch (error) {
      Toast.error(`Error: ${error.message}`);
    }
  }

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
