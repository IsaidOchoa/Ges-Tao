// src/renderer/components/modals/AssignmentModal/relations/ee/EEListRenderer.js

import { BaseRelationRenderer } from '../BaseRelationRenderer.js';

export class EEListRenderer extends BaseRelationRenderer {
  constructor({ api, toast, confirm, stateManager, uiLoader }) {
    super({ api, toast, confirm, stateManager, moduleName: 'ee_asignadas', uiLoader });
  }

  async loadSelect() {
    if (!this._cardRefs?.select || !this._context || !this._periodId) return;

    const { select, assignButton } = this._cardRefs;
    const { entityId } = this._context;

    select.disabled = true;
    select.innerHTML = '<option value="">Cargando...</option>';
    if (assignButton) assignButton.disabled = true;

    try {
      const res = await this.api.listarEEDisponibles({ 
        periodoId: this._periodId, 
        excludeAsignadasA: entityId 
      });
      
      const items = res?.success ? res.data : [];
      
      if (items.length === 0) {
        select.innerHTML = '<option value="" disabled>Todas las EE asignadas</option>';
      } else {
        select.innerHTML = '<option value="">Seleccionar materia...</option>' +
          items.map(ee => `<option value="${ee.id}">${this.helpers.escapeHtml(ee.nombre)} (${this.helpers.escapeHtml(ee.clave_ee)})</option>`).join('');
      }
      
      select.disabled = items.length === 0;
      if (assignButton) assignButton.disabled = items.length === 0;
    } catch (error) {
      console.error('Error cargando EE disponibles:', error);
      select.innerHTML = '<option value="" disabled>Error al cargar</option>';
      select.disabled = true;
    }
  }

async renderList() {
  if (!this._cardRefs?.listContainer || !this._context || !this._periodId) return;

  const { listContainer } = this._cardRefs;
  const { entityId } = this._context;

  this._showLoading();

  try {
    console.log('📡 [EEListRenderer] Obteniendo EE del docente:', { docenteId: entityId, periodoId: this._periodId });
    
    const res = await this.api.obtenerEEDelDocente({ 
      docenteId: entityId, 
      periodoId: this._periodId 
    });
    
    console.log('[EEListRenderer] EE recibidas:', res.data?.length || 0);
    
    if (!res?.success) throw new Error(res?.error || 'Respuesta inválida');
    
    const newItems = res.data || [];
    
    console.log('[EEListRenderer] Enriqueciendo', newItems.length, 'EE con estadísticas...');
    
    const enrichedItems = await Promise.all(newItems.map(async (ee) => {
      try {
        console.log('  🔍 [EEListRenderer] Consultando estadísticas para EE:', ee.id, ee.nombre);
        
        const statsRes = await this.api.obtenerEstadisticasEE({ 
          eeId: ee.id, 
          periodoId: this._periodId 
        });
        
        console.log('  📊 [EEListRenderer] Estadísticas para EE', ee.id, ':', statsRes.data);
        
        const numAlumnos = statsRes?.success ? statsRes.data?.total_alumnos || 0 : 0;
        
        return { 
          ...ee, 
          num_alumnos: numAlumnos,
          creditos_ee: ee.creditos_ee || '0/0/0',
          horas_ee: ee.horas_ee || '0/0'
        };
      } catch (error) {
        console.error('Error obteniendo estadísticas para EE', ee.id, ':', error);
        return { ...ee, num_alumnos: 0, creditos_ee: '0/0/0', horas_ee: '0/0' };
      }
    }));

    console.log('[EEListRenderer] Items enriquecidos:', enrichedItems);

    //Solo comparar IDs si hay elementos. Si está vacío, siempre renderizar.
    if (enrichedItems.length > 0) {
      const newIds = enrichedItems.map(item => item.id);
      const currentIds = Array.from(this._currentItems.keys());
      
      if (newIds.length === currentIds.length && newIds.every((id, idx) => id === currentIds[idx])) {
        console.log('[EEListRenderer] Datos sin cambios, omitiendo re-render');
        this._hideLoading();
        return;
      }
    }

    // Limpiar y renderizar
    listContainer.innerHTML = '';
    this._currentItems.clear();

    if (enrichedItems.length === 0) {
      console.log('📭 [EEListRenderer] Renderizando estado vacío');
      listContainer.innerHTML = `
        <tr class="empty-row">
          <td colspan="${this._getColumnCount()}">Ninguna Experiencia Educativa asignada</td>
        </tr>
      `;
      this._hideLoading();
      return;
    }

    const fragment = document.createDocumentFragment();
    enrichedItems.forEach(ee => {
      const item = this._createItem(ee);
      fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
    
    console.log('🔗 [EEListRenderer] Llamando bindEvents() después de renderizar');
    this.bindEvents();
    
    this._hideLoading();
    
  } catch (error) {
    this._hideLoading();
    console.error('❌ [EEListRenderer] Error cargando EE asignadas:', error);
    listContainer.innerHTML = this.helpers.errorTemplate(error.message);
  }
}

  async refreshCounter() {
    const count = this._currentItems.size;
    this._updateCounterText(count);
  }

async assign() {
  if (!this._cardRefs?.select || !this._cardRefs?.assignButton) return;

  // Protección contra contexto indefinido
  if (!this._context || !this._context.entityId) {
    this.toast.error('Error: Contexto no disponible');
    return;
  }

  const { select, assignButton } = this._cardRefs;
  const { entityId } = this._context;
  const eeId = select.value;

  if (!eeId) {
    this.toast.warning('Seleccione una Experiencia Educativa');
    return;
  }

  assignButton.disabled = true;
  assignButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Asignando...';

  try {
    const res = await this.api.asignarEEAdocente({ 
      docenteId: entityId, 
      eeId: eeId, 
      periodoId: this._periodId, 
      cargaHoraria: 0 
    });
    
    if (res?.success) {
      this.toast.success('EE asignada correctamente');
      
      // 1. Invalidar módulos globales (por si acaso)
      this.stateManager.invalidateModules(['ee_asignadas', 'counters', 'sidebar']);
      
      // 2. Pequeño delay para asegurar que la DB ya hizo el commit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 3. Limpiar cache local para forzar re-render
      this._currentItems.clear();
      
      // 4. Forzar recarga de datos y renderizado
      await this.renderList();
      
    } else {
      this.toast.error(res?.error || 'Error al asignar');
    }
  } catch (error) {
    console.error('❌ Error asignando EE:', error);
    this.toast.error(`Error: ${error.message}`);
  } finally {
    assignButton.disabled = false;
    assignButton.innerHTML = '<i class="fa-solid fa-plus"></i> Asignar';
  }
}

async remove(eeId, eeName) {
  if (!this._cardRefs || !this._context) return;

  const confirmed = await this.confirm.ask(
    `¿Desasignar Experiencia Educativa?`,
    `¿Quitar <strong>"${this.helpers.escapeHtml(eeName)}"</strong>?`
  );

  if (!confirmed) return;

  const btn = this._cardRefs.listContainer.querySelector(`button[data-id="${eeId}"]`);
  const originalState = btn ? { html: btn.innerHTML, disabled: btn.disabled } : null;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Quitando...';
  }

  try {
    const { entityId } = this._context;
    
    const res = await this.api.removerDocenteEE({ 
      docenteId: entityId, 
      eeId: eeId, 
      periodoId: this._periodId 
    });
    
    if (!res?.success) throw new Error(res?.error || 'Error al desasignar');

    this.toast.success('EE desasignada correctamente');
    
    // 1. Invalidar módulos globales
    this.stateManager.invalidateModules(['ee_asignadas', 'counters', 'sidebar']);
    
    // 2. Pequeño delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 3. Limpiar cache local
    this._currentItems.clear();
    
    // 4. Forzar recarga de datos y renderizado
    await this.renderList();
    
  } catch (error) {
    console.error('❌ Error desasignando EE:', error);
    this.toast.error(`No se pudo desasignar: ${error.message}`);
    
    if (btn && originalState) {
      btn.disabled = originalState.disabled;
      btn.innerHTML = originalState.html;
    }
  }
}

   _createItem(ee) {
  const row = document.createElement('tr');
  row.className = 'table-row';
  row.dataset.id = String(ee.id);
  
  const nombre = ee.nombre || 'Sin nombre';
  const clave = ee.clave_ee || '-';
  const creditos = ee.creditos_ee || '0/0/0';
  const horas = ee.horas_ee || '0/0';
  const alumnos = ee.num_alumnos ?? 0;
  
  row.innerHTML = `
    <td class="col-nombre">
      <strong>${this.helpers.escapeHtml(nombre)}</strong>
    </td>
    <td class="col-clave">
      <span class="badge-clave">${this.helpers.escapeHtml(clave)}</span>
    </td>
    <td class="col-creditos">
      <span style="color: var(--text-muted); font-family: monospace;">${creditos}</span>
    </td>
    <td class="col-horas">
      <span style="color: var(--text-muted); font-family: monospace;">${horas}</span>
    </td>
    <td class="col-alumnos">
      <div class="editable-field" 
           data-id="${ee.id}" 
           data-field="num_alumnos" 
           data-value="${alumnos}" 
           style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;" 
           title="Editar número de alumnos"
           onmouseover="this.style.background='rgba(52, 152, 219, 0.1)'"
           onmouseout="this.style.background=''">
        <i class="fa-solid fa-pen-to-square" style="font-size: 0.75rem; opacity: 0.6;"></i>
        <span>${alumnos}</span> <!-- 🔥 AQUÍ ESTÁ EL NÚMERO -->
      </div>
    </td>
    <td class="col-actions" style="text-align: center;">
      <button class="btn-remove-row" data-id="${ee.id}" data-name="${this.helpers.escapeHtml(nombre)}" title="Desasignar Experiencia Educativa">
        <i class="fa-solid fa-trash"></i>
      </button>
    </td>
  `;

  this._currentItems.set(String(ee.id), ee);
  return row;
}

bindEvents() {
  // 1. LLAMAR AL MÉTODO PADRE UNA SOLA VEZ
  if (!this._parentBound) {
    super.bindEvents();
    this._parentBound = true;
  }
  
  if (!this._cardRefs?.listContainer) {
    console.error('❌ [EEListRenderer] listContainer no existe en bindEvents');
    return;
  }

  // 2. Remover listener anterior si existe (evitar duplicados)
  if (this._editableClickHandler) {
    this._cardRefs.listContainer.removeEventListener('click', this._editableClickHandler);
  }

  // 3. Crear handler
  this._editableClickHandler = (e) => {
    const editableField = e.target.closest('.editable-field');
    if (editableField) {
      e.stopPropagation();
      
      const eeId = editableField.dataset.id;
      const field = editableField.dataset.field;
      const currentValue = editableField.dataset.value;
      
      if (field === 'num_alumnos') {
        this._editNumAlumnos(eeId, currentValue, editableField);
      }
      return;
    }

    const removeBtn = e.target.closest('.btn-remove-row');
    if (removeBtn) {
      e.stopPropagation();
      
      const eeId = removeBtn.dataset.id;
      const eeName = removeBtn.dataset.name;
      
      this.remove(eeId, eeName);
      return;
    }
  };

  this._cardRefs.listContainer.addEventListener('click', this._editableClickHandler);
}

  async _editNumAlumnos(eeId, currentValue, fieldElement) {
    console.log('✏️ [EEListRenderer] Iniciando edición en línea para:', { eeId, currentValue });
    
    const ee = this._currentItems.get(String(eeId));
    if (!ee) {
      console.error('❌ [EEListRenderer] EE no encontrada:', eeId);
      return;
    }

    // 1. Guardar el HTML original por si el usuario cancela (Escape)
    const originalHTML = fieldElement.innerHTML;
    const originalValue = fieldElement.dataset.value;

    // 2. Reemplazar temporalmente con un input numérico
    fieldElement.innerHTML = `
      <input type="number" min="0" value="${originalValue}" 
             class="inline-edit-input" 
             style="width: 60px; padding: 2px 6px; border: 1px solid var(--accent-color); border-radius: 4px; font-size: 0.85rem; outline: none; background: var(--bg-white); color: var(--text-dark);">
    `;
    
    const input = fieldElement.querySelector('.inline-edit-input');
    input.focus();
    input.select(); // Seleccionar todo el texto para facilitar la edición

    // 3. Función para guardar los cambios
    const save = async () => {
      const newValue = input.value;
      const parsedValue = parseInt(newValue, 10);
      
      if (isNaN(parsedValue) || parsedValue < 0) {
        this.toast.error('Ingrese un número válido (mayor o igual a 0)');
        fieldElement.innerHTML = originalHTML; // Revertir al estado original
        return;
      }

      // Mostrar indicador de carga
      fieldElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

      try {
        const res = await this.api.actualizarEstadisticasEE({
          eeId: Number(eeId), // La API espera número
          periodoId: this._periodId,
          total_alumnos: parsedValue
        });

        if (res?.success) {
          this.toast.success('Número de alumnos actualizado correctamente');
          
          // Actualizar estado local
          ee.num_alumnos = parsedValue;
          this._currentItems.set(String(eeId), ee);
          
          // Restaurar la vista con el nuevo valor
          fieldElement.innerHTML = `
            <i class="fa-solid fa-pen-to-square" style="font-size: 0.75rem; opacity: 0.6;"></i>
            <span>${parsedValue}</span>
          `;
          fieldElement.dataset.value = String(parsedValue);
        } else {
          this.toast.error(res?.error || 'Error al actualizar');
          fieldElement.innerHTML = originalHTML; // Revertir en caso de error de API
        }
      } catch (error) {
        console.error('❌ Error actualizando:', error);
        this.toast.error(`Error: ${error.message}`);
        fieldElement.innerHTML = originalHTML; // Revertir en caso de error de red
      }
    };

    // 4. Event listeners para controlar el guardado o la cancelación
    input.addEventListener('blur', save); // Guardar al hacer clic fuera
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur(); // Dispara el evento 'blur' que ejecuta save()
      } else if (e.key === 'Escape') {
        fieldElement.innerHTML = originalHTML; // Cancelar y restaurar original
      }
    });
  }
}