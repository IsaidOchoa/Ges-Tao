// src/renderer/utils/tableExpandManager.js

export function initTableExpandManager() {
  console.log('🚀 [TableExpandManager] Inicializando gestor global de expansión...');

  document.addEventListener('click', (e) => {
    // ==========================================
    // CASO 1: El usuario hizo clic explícitamente en la flecha
    // ==========================================
    const arrow = e.target.closest('.row-arrow');
    if (arrow) {
      e.preventDefault();
      e.stopPropagation(); // ⚠️ CLAVE: Detiene la propagación para que NO active el onclick legacy

      const row = arrow.closest('.data-row');
      const rowId = row?.dataset.id;
      const detailsRow = rowId ? document.getElementById(`details-${rowId}`) : null;

      if (!row || !detailsRow) return;

      const isNowExpanded = !row.classList.contains('expanded');
      
      if (isNowExpanded) {
        row.classList.add('expanded');
        detailsRow.classList.remove('hidden');
      } else {
        row.classList.remove('expanded');
        detailsRow.classList.add('hidden');
      }

      // Disparar evento para que el módulo cargue sus chips
      row.dispatchEvent(new CustomEvent('table:rowExpanded', {
        bubbles: true,
        detail: { rowId, isExpanded: isNowExpanded }
      }));
      
      return; // Terminamos aquí, la flecha ya fue manejada
    }

    // ==========================================
    // CASO 2: El usuario hizo clic en cualquier parte de la fila
    // ==========================================
    const row = e.target.closest('.data-row');
    if (!row) return;

    // 🛡️ REGLA DE COMPATIBILIDAD: Si la fila tiene un "onclick" inline (código legacy),
    // NO intervenimos. Dejamos que el módulo antiguo (ej. DocenteModule) lo maneje solo.
    if (row.hasAttribute('onclick')) {
      return; 
    }

    // 🛡️ REGLA DE SEGURIDAD: Ignorar clics en elementos interactivos (botones, menús, etc.)
    // para que el gestor no interfiera con su funcionalidad.
    const isInteractive = e.target.closest('button, input, select, a, .context-menu, .action-icon-container, .btn-manage');
    if (isInteractive) {
      return; 
    }

    // Si llegamos aquí, es una fila NUEVA (sin onclick legacy, como ConsultRenderer) 
    // y el clic fue en un área segura. Nosotros tomamos el control.
    e.preventDefault();
    
    const rowId = row.dataset.id;
    const detailsRow = rowId ? document.getElementById(`details-${rowId}`) : null;

    if (!detailsRow) return;

    const isNowExpanded = !row.classList.contains('expanded');
    
    if (isNowExpanded) {
      row.classList.add('expanded');
      detailsRow.classList.remove('hidden');
    } else {
      row.classList.remove('expanded');
      detailsRow.classList.add('hidden');
    }

    // Disparar evento para que ConsultRenderer cargue los chips
    row.dispatchEvent(new CustomEvent('table:rowExpanded', {
      bubbles: true,
      detail: { rowId, isExpanded: isNowExpanded }
    }));
  });

  console.log('✅ [TableExpandManager] Listener global registrado exitosamente.');
}