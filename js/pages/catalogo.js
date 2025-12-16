import { catalogoService } from '../api/catalogo.service.js';

const MAX_RECORDS = 25000;
// ===== VARIABLES GLOBALES =====
let allData = [];
let filteredData = [];
let currentPage = 1;
const PAGE_SIZE = 50;
let tableColumns = [];

// ===== CARGAR DATOS DESDE SESSIONSTORAGE AL INICIO =====
function loadDataFromMemory() {
  try {
    const dataStr = sessionStorage.getItem('senaCatalogoData');
    if (dataStr) {
      return JSON.parse(dataStr);
    }
  } catch (e) {
    console.error('Error al cargar datos:', e);
  }
  return [];
}

// ===== GUARDAR DATOS EN SESSIONSTORAGE =====
function saveDataToMemory() {
  try {
    const dataStr = JSON.stringify(allData);
    sessionStorage.setItem('senaCatalogoData', dataStr);
    sessionStorage.setItem('senaCatalogoLastUpdate', new Date().toISOString());
  } catch (e) {
    console.error('Error al guardar datos:', e);
  }
}

// ===== INICIALIZAR DATOS =====
allData = loadDataFromMemory();
filteredData = [...allData];

// ===== ELEMENTOS DEL DOM =====
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const searchAll = document.getElementById('searchAll');
const tableBody = document.getElementById('tableBody');
const tableHeader = document.getElementById('tableHeader');
const statsContent = document.getElementById('statsContent');
const totalRecords = document.getElementById('totalRecords');
const filteredRecords = document.getElementById('filteredRecords');

// ===== MANEJO DE CARGA DE ARCHIVOS =====
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = '#0056b3';
  uploadZone.style.background = '#e9ecef';
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.borderColor = '#007bff';
  uploadZone.style.background = '#f8f9fa';
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.style.borderColor = '#007bff';
  uploadZone.style.background = '#f8f9fa';
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processFile(file);
});

// ===== PROCESAR ARCHIVO EXCEL =====
function processFile(file) {
  const name = file?.name || '';
  if (!/\.(xlsx|xls)$/i.test(name)) {
    alert('Formato de archivo no soportado. Por favor, suba un Excel (.xlsx o .xls).');
    return;
  }

  // UI: Iniciar tarea de subida
  const taskId = addUploadTask(file);
  showLoadingOverlay(true);

  // Subir archivo a la API con progreso
  catalogoService.uploadExcelCatalogoWithProgress(file, (percent) => {
    updateUploadProgress(taskId, percent);
  })
  .then((response) => {
    console.log('Respuesta upload:', response);
    
    // Procesar respuesta
    let programas = [];
    if (Array.isArray(response)) {
      programas = response;
    } else if (response.data && Array.isArray(response.data)) {
      programas = response.data;
    } else if (response.results && Array.isArray(response.results)) {
        programas = response.results;
    } else {
        // Fallback: intentar leer el archivo localmente si la API no devuelve los datos procesados
        console.warn('La API no devolvió los datos procesados, leyendo localmente...');
        readFileLocally(file);
        completeUploadTask(taskId, true, 'Subido (Procesando local)');
        showLoadingOverlay(false);
        return;
    }

    if (programas.length > 0) {
      allData = programas;
      filteredData = [...allData];
      saveDataToMemory();
      extractColumns();
      populateFilters();
      renderTable();
      updateStats();
      
      completeUploadTask(taskId, true, 'Completado');
      alert(`✓ Se cargaron ${programas.length} registros exitosamente.`);
    } else {
      completeUploadTask(taskId, true, 'Sin datos nuevos');
      alert('El archivo se subió pero no se encontraron registros nuevos.');
    }
  })
  .catch((error) => {
    console.error('Error al subir:', error);
    completeUploadTask(taskId, false, error.message || 'Error');
    alert('Error al subir el archivo: ' + (error.message || 'Error desconocido'));
  })
  .finally(() => {
    showLoadingOverlay(false);
  });
}

function readFileLocally(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
            if (jsonData.length > 0) {
                addDataWithoutDuplicates(jsonData);
                saveDataToMemory();
                extractColumns();
                populateFilters();
                renderTable();
                updateStats();
            }
        } catch (err) {
            console.error('Error lectura local:', err);
        }
    };
    reader.readAsArrayBuffer(file);
}

// ===== UPLOAD TRAY LOGIC =====
const loadingOverlay = document.getElementById('loadingOverlay');
const uploadsTray = document.getElementById('uploadsTray');
const btnUploads = document.getElementById('btnUploads');
const uploadsPanel = document.getElementById('uploadsPanel');
const uploadsList = document.getElementById('uploadsList');
const uploadAlert = document.getElementById('uploadAlert');

let activeUploads = new Map(); // id -> { name, progress, status, message }

if (btnUploads) {
    btnUploads.addEventListener('click', () => {
        if (uploadsPanel) uploadsPanel.style.display = uploadsPanel.style.display === 'none' ? 'block' : 'none';
    });
}

function showLoadingOverlay(show) {
    if (loadingOverlay) loadingOverlay.style.display = show ? 'block' : 'none';
}

function addUploadTask(file) {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    activeUploads.set(id, { name: file.name, progress: 0, status: 'pending' });
    renderUploadsList();
    if (uploadsPanel && uploadsPanel.style.display === 'none') {
        uploadsPanel.style.display = 'block';
    }
    return id;
}

function updateUploadProgress(id, percent) {
    const task = activeUploads.get(id);
    if (task) {
        task.progress = percent;
        task.status = 'uploading';
        renderUploadsList();
    }
}

function completeUploadTask(id, success, message) {
    const task = activeUploads.get(id);
    if (task) {
        task.progress = 100;
        task.status = success ? 'success' : 'error';
        task.message = message;
        renderUploadsList();
        
        if (uploadAlert) {
            uploadAlert.className = `alert alert-${success ? 'success' : 'danger'} py-1 px-2`;
            uploadAlert.textContent = success ? 'Carga completada' : 'Error en la carga';
            uploadAlert.style.display = 'block';
            setTimeout(() => { uploadAlert.style.display = 'none'; }, 3000);
        }
    }
}

function renderUploadsList() {
    if (!uploadsList) return;
    uploadsList.innerHTML = '';
    
    if (activeUploads.size === 0) {
        uploadsList.innerHTML = '<div class="list-group-item text-muted small">No hay subidas en curso</div>';
        return;
    }

    // Convert map to array and reverse to show newest first
    const tasks = Array.from(activeUploads.entries()).reverse();

    tasks.forEach(([id, task]) => {
        const item = document.createElement('div');
        item.className = 'list-group-item p-2';
        
        let statusIcon = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';
        let statusClass = 'text-primary';
        
        if (task.status === 'success') {
            statusIcon = '<i class="fas fa-check-circle text-success"></i>';
            statusClass = 'text-success';
        } else if (task.status === 'error') {
            statusIcon = '<i class="fas fa-times-circle text-danger"></i>';
            statusClass = 'text-danger';
        }

        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <div class="text-truncate small fw-bold" style="max-width: 180px;" title="${task.name}">${task.name}</div>
                ${statusIcon}
            </div>
            <div class="progress" style="height: 4px;">
                <div class="progress-bar ${task.status === 'error' ? 'bg-danger' : 'bg-primary'}" role="progressbar" style="width: ${task.progress}%"></div>
            </div>
            <div class="d-flex justify-content-between mt-1">
                <small class="${statusClass}" style="font-size: 0.75rem;">${task.status === 'uploading' ? task.progress + '%' : (task.status === 'success' ? 'Completado' : 'Error')}</small>
                ${task.message ? `<small class="text-muted ms-2 text-truncate" style="max-width: 100px; font-size: 0.75rem;" title="${task.message}">${task.message}</small>` : ''}
            </div>
        `;
        uploadsList.appendChild(item);
    });
}

// ===== AGREGAR DATOS SIN DUPLICADOS =====
function addDataWithoutDuplicates(newData) {
  let addedCount = 0;
  let duplicateCount = 0;
  let exceededCount = 0;
  const totalInFile = newData.length;

  newData.forEach(newRow => {
    const isDuplicate = allData.some(existingRow => {
      // Comparar por código de programa o nombre
      const codigoMatch = (newRow.CODIGO_PROGRAMA || newRow['Código Programa']) && 
                          (existingRow.CODIGO_PROGRAMA || existingRow['Código Programa']) &&
                          String(newRow.CODIGO_PROGRAMA || newRow['Código Programa']).trim() === 
                          String(existingRow.CODIGO_PROGRAMA || existingRow['Código Programa']).trim();
      
      if (codigoMatch) return true;
      
      // Si no hay código, comparar por nombre de programa
      const nombreMatch = Object.keys(newRow).some(key => {
        if (key.toLowerCase().includes('programa') || key.toLowerCase().includes('nombre')) {
          return Object.keys(existingRow).some(existingKey => {
            if (existingKey.toLowerCase().includes('programa') || existingKey.toLowerCase().includes('nombre')) {
              return String(newRow[key] || '').trim() === String(existingRow[existingKey] || '').trim();
            }
            return false;
          });
        }
        return false;
      });
      
      return nombreMatch;
    });

    if (isDuplicate) {
      duplicateCount++;
    } else if (allData.length + addedCount >= MAX_RECORDS) {
      exceededCount++;
    } else {
      allData.push(newRow);
      addedCount++;
    }
  });

  filteredData = [...allData];

  return {
    totalInFile,
    addedCount,
    duplicateCount,
    exceededCount,
    totalInSystem: allData.length
  };
}

// ===== EXTRAER COLUMNAS DEL ARCHIVO =====
function extractColumns() {
  if (allData.length === 0) return;
  
  // Extraer TODAS las columnas del primer registro
  tableColumns = Object.keys(allData[0]);
  
  console.log('Columnas detectadas:', tableColumns);
}

// ===== POBLAR FILTROS DINÁMICAMENTE =====
function populateFilters() {
  const filters = {
    filterCentro: ['NOMBRE_CENTRO', 'Centro', 'Centro de Formación'],
    filterPrograma: ['PROGRAMA_FORMACION', 'Programa', 'Nombre Programa', 'Programa de Formación'],
    filterNivel: ['NIVEL_FORMACION', 'Nivel', 'Nivel de Formación'],
    filterModalidad: ['MODALIDAD_FORMACION', 'Modalidad']
  };

  Object.keys(filters).forEach(filterId => {
    const select = document.getElementById(filterId);
    const possibleFields = filters[filterId];
    
    // Buscar cuál campo existe en los datos
    const field = possibleFields.find(f => tableColumns.includes(f));
    
    if (field) {
      const uniqueValues = [...new Set(allData.map(item => item[field]).filter(Boolean))].sort();
      
      select.innerHTML = '<option value="">Todos</option>';
      uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
      select.dataset.field = field; // Guardar el campo que se está usando
    }
  });
}

// ===== RENDERIZAR TABLA PRINCIPAL =====
function renderTable() {
  // Renderizar encabezado
  tableHeader.innerHTML = '';
  tableColumns.forEach(column => {
    const th = document.createElement('th');
    th.textContent = column;
    tableHeader.appendChild(th);
  });

  tableBody.innerHTML = '';

  if (filteredData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="${tableColumns.length}" class="text-center text-muted py-5">
          <i class="fas fa-inbox fa-3x mb-3 d-block"></i>
          <p>No se encontraron resultados</p>
        </td>
      </tr>`;
    renderPagination();
    return;
  }

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageData = filteredData.slice(start, end);

  pageData.forEach(row => {
    const tr = document.createElement('tr');
    tableColumns.forEach(column => {
      const td = document.createElement('td');
      
      // Crear contenedor con scroll para contenido largo
      const div = document.createElement('div');
      div.className = 'cell-content';
      div.textContent = row[column] || '';
      div.title = row[column] || ''; // Tooltip nativo para ver todo el contenido
      
      td.appendChild(div);
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });

  renderPagination();
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function updateStats() {
  totalRecords.textContent = allData.length;
  filteredRecords.textContent = filteredData.length;
}

// ===== APLICAR FILTROS =====
document.getElementById('applyFilters').addEventListener('click', () => {
  const searchAllValue = searchAll.value.toLowerCase();
  const centro = document.getElementById('filterCentro').value;
  const programa = document.getElementById('filterPrograma').value;
  const nivel = document.getElementById('filterNivel').value;
  const modalidad = document.getElementById('filterModalidad').value;

  filteredData = allData.filter(row => {
    const matchSearch = !searchAllValue || Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchAllValue)
    );
    
    const matchCentro = !centro || row[document.getElementById('filterCentro').dataset.field] === centro;
    const matchPrograma = !programa || row[document.getElementById('filterPrograma').dataset.field] === programa;
    const matchNivel = !nivel || row[document.getElementById('filterNivel').dataset.field] === nivel;
    const matchModalidad = !modalidad || row[document.getElementById('filterModalidad').dataset.field] === modalidad;

    return matchSearch && matchCentro && matchPrograma && matchNivel && matchModalidad;
  });

  currentPage = 1;
  renderTable();
  updateStats();
});

// ===== LIMPIAR FILTROS =====
document.getElementById('clearFilters').addEventListener('click', () => {
  searchAll.value = '';
  document.querySelectorAll('.filter-group select').forEach(select => select.value = '');
  filteredData = [...allData];
  currentPage = 1;
  renderTable();
  updateStats();
});

// ===== EXPORTAR A EXCEL =====
document.getElementById('exportExcel').addEventListener('click', () => {
  if (filteredData.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  
  const ws = XLSX.utils.json_to_sheet(filteredData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catálogo');
  XLSX.writeFile(wb, `Catalogo_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// ===== CAMBIAR ENTRE TABS =====
document.querySelectorAll('.btn-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    document.querySelectorAll('.sub-table').forEach(t => t.classList.remove('active'));
    document.getElementById(`table-${btn.dataset.tab}`).classList.add('active');
  });
});

// ===== BOTÓN DE ESTADÍSTICAS =====
document.getElementById('btnStats').addEventListener('click', () => {
  const stats = calculateStats();
  
  statsContent.innerHTML = `
    <div class="row">
      <div class="col-md-4">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">Total Programas</h5>
            <h2 class="text-primary">${stats.totalProgramas}</h2>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">Centros</h5>
            <h2 class="text-success">${stats.totalCentros}</h2>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">Modalidades</h5>
            <h2 class="text-info">${stats.totalModalidades}</h2>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header bg-primary text-white">
        <strong>Resumen por Centro</strong>
      </div>
      <div class="card-body">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Centro</th>
              <th>Programas</th>
            </tr>
          </thead>
          <tbody>
            ${stats.porCentro.map(c => `
              <tr>
                <td>${c.centro}</td>
                <td>${c.programas}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
});

// ===== CALCULAR ESTADÍSTICAS =====
function calculateStats() {
  const totalProgramas = filteredData.length;
  
  // Buscar campo de centro
  const centroField = ['NOMBRE_CENTRO', 'Centro', 'Centro de Formación'].find(f => tableColumns.includes(f));
  const modalidadField = ['MODALIDAD_FORMACION', 'Modalidad'].find(f => tableColumns.includes(f));
  
  const centros = {};
  const modalidades = new Set();
  
  filteredData.forEach(row => {
    if (centroField) {
      const centro = row[centroField] || 'Sin centro';
      centros[centro] = (centros[centro] || 0) + 1;
    }
    if (modalidadField && row[modalidadField]) {
      modalidades.add(row[modalidadField]);
    }
  });

  const porCentro = Object.keys(centros).map(centro => ({
    centro,
    programas: centros[centro]
  }));

  return { 
    totalProgramas, 
    totalCentros: Object.keys(centros).length,
    totalModalidades: modalidades.size,
    porCentro 
  };
}

// ===== MOSTRAR MODAL DE ÉXITO =====
function showSuccessModal(result) {
  const { totalInFile, addedCount, duplicateCount, exceededCount, totalInSystem } = result;
  
  document.getElementById('modalNewRecords').textContent = addedCount;
  document.getElementById('modalDuplicates').textContent = duplicateCount;
  document.getElementById('modalTotalRecords').textContent = totalInSystem;
  
  const modalIcon = document.getElementById('modalIcon');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const modalDescription = document.getElementById('modalDescription');
  
  document.getElementById('alertSuccess').classList.add('d-none');
  document.getElementById('alertWarning').classList.add('d-none');
  document.getElementById('alertInfo').classList.add('d-none');
  const alertDangerEl = document.getElementById('alertDanger');
  if (alertDangerEl) alertDangerEl.classList.add('d-none');
  
  if (duplicateCount === 0 && addedCount > 0) {
    modalIcon.className = 'fas fa-check-circle';
    modalTitle.textContent = '¡Carga Exitosa!';
    modalSubtitle.textContent = 'Todos los registros se agregaron correctamente';
    modalDescription.textContent = `Se procesaron ${totalInFile} registros del archivo`;
    
    document.getElementById('alertSuccess').classList.remove('d-none');
    document.getElementById('successMessage').textContent = `${addedCount} registro(s) nuevo(s) agregado(s) al sistema`;
    document.getElementById('alertInfo').classList.remove('d-none');
    
  } else if (duplicateCount > 0 && addedCount > 0 && (!exceededCount || exceededCount === 0)) {
    modalIcon.className = 'fas fa-exclamation-circle';
    modalTitle.textContent = 'Carga Completada con Observaciones';
    modalSubtitle.textContent = 'Se encontraron registros duplicados';
    modalDescription.textContent = `Se procesaron ${totalInFile} registros del archivo`;
    
    document.getElementById('alertSuccess').classList.remove('d-none');
    document.getElementById('successMessage').textContent = `${addedCount} registro(s) nuevo(s) agregado(s)`;
    
    document.getElementById('alertWarning').classList.remove('d-none');
    document.getElementById('warningMessage').textContent = `${duplicateCount} registro(s) duplicado(s) no se agregaron (ya existen en el sistema)`;
    
    document.getElementById('alertInfo').classList.remove('d-none');
    
  } else if (duplicateCount > 0 && addedCount === 0 && (!exceededCount || exceededCount === 0)) {
    modalIcon.className = 'fas fa-info-circle';
    modalTitle.textContent = 'Sin Cambios';
    modalSubtitle.textContent = 'Todos los registros ya existen';
    modalDescription.textContent = `Se procesaron ${totalInFile} registros del archivo`;
    
    document.getElementById('alertWarning').classList.remove('d-none');
    document.getElementById('warningMessage').textContent = `Los ${duplicateCount} registros del archivo ya existen en el sistema. No se agregaron datos nuevos.`;
  }

  if (exceededCount && exceededCount > 0) {
    modalIcon.className = 'fas fa-times-circle';
    modalTitle.textContent = 'Límite de registros excedido';
    if (alertDangerEl) {
      alertDangerEl.classList.remove('d-none');
      const dangerMessage = document.getElementById('dangerMessage');
      if (dangerMessage) dangerMessage.textContent = `${exceededCount} registro(s) rechazado(s) por superar el límite máximo (${MAX_RECORDS}).`;
    }
  }
  
  document.getElementById('successModal').classList.add('show');
}

// ===== CERRAR MODAL =====
function closeSuccessModal() {
  document.getElementById('successModal').classList.remove('show');
}

// Cerrar modal al hacer click fuera
document.getElementById('successModal').addEventListener('click', (e) => {
  if (e.target.id === 'successModal') {
    closeSuccessModal();
  }
});

// Exponer función globalmente
window.closeSuccessModal = closeSuccessModal;

// ===== PAGINACIÓN =====
function renderPagination(){
  const total = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const pageInfo = document.getElementById('pageInfo');
  if (pageInfo) pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  if (btnPrev) btnPrev.disabled = currentPage <= 1;
  if (btnNext) btnNext.disabled = currentPage >= totalPages;
  const inputPage = document.getElementById('inputPageNumber');
  if (inputPage) inputPage.value = String(currentPage);
}

document.getElementById('btnPrevPage')?.addEventListener('click', () => {
  if (currentPage > 1){
    currentPage--;
    renderTable();
  }
});

document.getElementById('btnNextPage')?.addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  if (currentPage < totalPages){
    currentPage++;
    renderTable();
  }
});

document.getElementById('btnGoToPage')?.addEventListener('click', () => {
  const input = document.getElementById('inputPageNumber');
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  let v = parseInt(input?.value || '1', 10);
  if (isNaN(v) || v < 1) v = 1;
  if (v > totalPages) v = totalPages;
  currentPage = v;
  renderTable();
});

document.getElementById('inputPageNumber')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter'){
    const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
    let v = parseInt(e.target.value || '1', 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > totalPages) v = totalPages;
    currentPage = v;
    renderTable();
  }
});

// ===== TOGGLE MOBILE MENU =====
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (hamburgerBtn) {
  hamburgerBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('show');
    const icon = hamburgerBtn.querySelector('i');
    if (mobileMenu.classList.contains('show')) {
      icon.className = 'fas fa-times';
    } else {
      icon.className = 'fas fa-bars';
    }
  });
}

document.addEventListener('click', (e) => {
  if (mobileMenu && !mobileMenu.contains(e.target) && !hamburgerBtn.contains(e.target)) {
    mobileMenu.classList.remove('show');
    if (hamburgerBtn) hamburgerBtn.querySelector('i').className = 'fas fa-bars';
  }
});

// ===== CARGAR DATOS AL INICIAR =====
async function loadInitialData() {
  const loadingIndicator = document.getElementById('loadingIndicator');
  const tableContainer = document.getElementById('tableContainer');
  
  try {
    // Mostrar indicador de carga
    if (loadingIndicator && tableContainer) {
      loadingIndicator.style.display = 'block';
      tableContainer.style.display = 'none';
    }

    console.log('Iniciando carga de datos desde la API...');
    
    // Primero intenta cargar desde la API
    let programas = await catalogoService.obtenerTodosProgramas();
    
    console.log('Respuesta de la API:', programas);
    console.log('Tipo de datos:', typeof programas);
    console.log('Es array:', Array.isArray(programas));
    
    // Manejo flexible de la respuesta
    if (programas) {
      // Si es un objeto con propiedad 'data' o 'results' o 'items'
      if (!Array.isArray(programas)) {
        if (programas.data && Array.isArray(programas.data)) {
          programas = programas.data;
        } else if (programas.results && Array.isArray(programas.results)) {
          programas = programas.results;
        } else if (programas.items && Array.isArray(programas.items)) {
          programas = programas.items;
        } else {
          // Intentar extraer el primer array encontrado
          const firstArray = Object.values(programas).find(val => Array.isArray(val));
          programas = firstArray || [];
        }
      }
      
      console.log('Datos procesados. Total:', programas.length);
      
      if (programas.length > 0) {
        allData = programas;
        filteredData = [...allData];
        saveDataToMemory();
        extractColumns();
        populateFilters();
        renderTable();
        updateStats();
        console.log(`✓ Se cargaron ${programas.length} programas desde la API`);
      } else {
        console.warn('⚠ La API no retornó datos. Usando datos guardados...');
        // Si no hay datos en API, cargar desde sessionStorage
        if (allData.length > 0) {
          extractColumns();
          populateFilters();
          renderTable();
          updateStats();
        }
      }
    } else {
      console.warn('⚠ Respuesta vacía de la API');
    }
  } catch (error) {
    console.error('✗ Error cargando datos iniciales:', error);
    console.error('Detalles del error:', error.message);
    // Si falla la API, usar datos guardados
    if (allData.length > 0) {
      console.log('Usando datos guardados en sessionStorage...');
      extractColumns();
      populateFilters();
      renderTable();
      updateStats();
    }
  } finally {
    // Ocultar indicador de carga
    if (loadingIndicator && tableContainer) {
      loadingIndicator.style.display = 'none';
      tableContainer.style.display = 'block';
    }
  }
}

// ===== INICIALIZACIÓN =====
loadInitialData();