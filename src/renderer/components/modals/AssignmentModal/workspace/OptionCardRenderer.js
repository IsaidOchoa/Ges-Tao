// src/renderer/components/modals/AssignmentModal/workspace/OptionCardRenderer.js

export class OptionCardRenderer {
  createCard(config) {
    const {
      title,
      icon,
      selectId,
      listId,
      counterId,
      removeBtnText
    } = config;

    const card = document.createElement('div');
    card.className = 'option-card';

    card.innerHTML = `
      <div class="controls-inline">
        <div class="select-wrapper">
          <label class="form-label">Asignar nuevo ${title.toLowerCase()}</label>
          <select id="${selectId}" class="form-select">
            <option value="">Cargando...</option>
          </select>
        </div>
        <div class="btn-wrapper">
          <button class="btn btn-primary" data-action="assign">
            <i class="fa-solid fa-plus"></i> Asignar
          </button>
        </div>
      </div>

      <div class="assigned-list-header">
        <h5><i class="fa-solid fa-${icon}"></i> ${title} asignados</h5>
        <span class="badge badge-counter" id="${counterId}">0</span>
      </div>

      <div id="${listId}" class="assigned-list">
        <span class="loading-text">Cargando...</span>
      </div>
    `;

    return {
      card,
      select: card.querySelector(`#${selectId}`),
      assignButton: card.querySelector('[data-action="assign"]'),
      counter: card.querySelector(`#${counterId}`),
      listContainer: card.querySelector(`#${listId}`),
      body: card,
      footer: null
    };
  }

  renderEmptyState(container, message = 'Seleccione un periodo para gestionar relaciones') {
    if (!container) return;
    container.innerHTML = `<p class="empty-text">${message}</p>`;
  }

  renderErrorState(container, message = 'Error al cargar') {
    if (!container) return;
    container.innerHTML = `<p class="error-text">${message}</p>`;
  }
}