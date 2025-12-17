/**
 * MÓDULO: ESTADO DE NORMAS
 * Gestión de carga, filtrado, visualización y análisis de normas SENA
 * 
 * SECCIONES PRINCIPALES:
 * 1. Importaciones y Variables Globales
 * 2. Carga y Almacenamiento de Datos
 * 3. Gestión de Archivos Excel
 * 4. Renderización de Tablas
 * 5. Filtros y Búsqueda
 * 6. Gráficas y Estadísticas
 * 7. Inicialización y Eventos
 */

// ===== IMPORTAR SERVICIOS =====
import { estadoNormasService } from '../api/estado-normas.service.js';

// ===== VARIABLES GLOBALES =====
let allData = [];
let filteredData = [];
let currentPage = 1;
let currentVigentesPage = 1;
let currentVencidasPage = 1;
const PAGE_SIZE = 50;
const MAX_RECORDS = 25000;

// ===== CARGAR DATOS DESDE SESSIONSTORAGE AL INICIO =====
function loadDataFromMemory() {
  try {
    const dataStr = sessionStorage.getItem('senaEstadoNormasData');
    if (dataStr) {
      return JSON.parse(dataStr);
    }
  } catch (e) {
    console.error('Error al cargar datos:', e);
  }
  return [];
}

// ==================== SECCIÓN 2: ALMACENAMIENTO DE DATOS ====================

// ===== GUARDAR DATOS EN SESSIONSTORAGE =====
function saveDataToMemory() {
  try {
    // NO guardar si los datos son muy grandes (más de 2MB estimado)
    const estimatedSize = JSON.stringify(allData).length;
    if (estimatedSize > 2000000) {
      console.warn(`⚠️ Datos muy grandes (${(estimatedSize / 1000000).toFixed(1)}MB). No se guardarán en sessionStorage para evitar QuotaExceededError.`);
      return;
    }
    
    const dataStr = JSON.stringify(allData);
    sessionStorage.setItem('senaEstadoNormasData', dataStr);
    sessionStorage.setItem('senaEstadoNormasLastUpdate', new Date().toISOString());
    console.log('✓ Datos guardados en sessionStorage');
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn('⚠️ sessionStorage lleno. Los datos funcionarán en memoria pero no se guardarán localmente.');
      // Intentar limpiar sessionStorage y continuar
      try {
        sessionStorage.clear();
        console.log('✓ sessionStorage limpiado');
      } catch (clearError) {
        console.warn('No se pudo limpiar sessionStorage');
      }
    } else {
      console.error('Error al guardar datos:', e);
    }
  }
}

// ===== INICIALIZAR DATOS =====
// Limpiar sessionStorage si está muy lleno
try {
  const storedData = sessionStorage.getItem('senaEstadoNormasData');
  if (storedData && storedData.length > 1000000) { // Si hay más de 1MB almacenado
    console.warn('⚠️ sessionStorage contiene datos muy grandes. Limpiando...');
    sessionStorage.clear();
  }
} catch (e) {
  console.warn('No se pudo verificar tamaño de sessionStorage');
}

allData = loadDataFromMemory();
filteredData = [...allData];

// ==================== ELEMENTOS DEL DOM ====================
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const searchAll = document.getElementById('searchAll');
const tableBody = document.getElementById('tableBody');
const vigentesTableBody = document.getElementById('vigentesTableBody');
const vencidasTableBody = document.getElementById('vencidasTableBody');
const statsContent = document.getElementById('statsContent');
const totalRecords = document.getElementById('totalRecords');
const filteredRecords = document.getElementById('filteredRecords');

// ==================== SECCIÓN 3: GESTIÓN DE ARCHIVOS EXCEL ====================

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

  // UI: Iniciar tarea
  const taskId = addUploadTask(file);
  // showLoadingOverlay(true); // Desactivado para permitir trabajo en segundo plano

  // Subir con progreso
  estadoNormasService.uploadExcelWithProgress(file, (percent) => {
    updateUploadProgress(taskId, percent);
  })
  .then((response) => {
    console.log('Respuesta upload:', response);
    // Asumimos que el backend devuelve los datos o confirmación
    // Si el backend no devuelve los datos procesados, leemos localmente para actualizar la tabla
    
    // Leer localmente para refrescar la UI (híbrido)
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
            
            if (jsonData.length > 0) {
                const result = addDataWithoutDuplicates(jsonData);
                saveDataToMemory();
                populateFilters();
                renderTable();
                updateStats();
                
                completeUploadTask(taskId, true, 'Completado');
                showSuccessModal(result);
            }
        } catch(err) {
            console.error('Error local processing:', err);
            completeUploadTask(taskId, true, 'Subido (Error visualización)');
        }
    };
    reader.readAsArrayBuffer(file);

  })
  .catch((error) => {
    console.error('Error al subir:', error);
    completeUploadTask(taskId, false, error.message || 'Error');
    alert('Error al subir el archivo: ' + (error.message || 'Error desconocido'));
  })
  .finally(() => {
    // showLoadingOverlay(false);
  });
}

// ===== UPLOAD TRAY LOGIC =====
const loadingOverlay = document.getElementById('loadingOverlay');
const uploadsTray = document.getElementById('uploadsTray');
const btnUploads = document.getElementById('btnUploads');
const uploadsPanel = document.getElementById('uploadsPanel');
const uploadsList = document.getElementById('uploadsList');
const uploadAlert = document.getElementById('uploadAlert');

let activeUploads = new Map();

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

// ===== ENVIAR ARCHIVO AL BACKEND =====
async function uploadFileToBackend(file, processingResult) {
  try {
    console.log('=== INICIANDO CARGA AL BACKEND ===');
    console.log('Archivo:', file.name);
    console.log('Tamaño:', file.size, 'bytes');
    console.log('Tipo:', file.type);
    
    // Verificar si el token existe
    const token = localStorage.getItem('access_token');
    console.log('Token disponible:', token ? 'Sí' : 'No');
    
    if (!token) {
      console.warn('⚠️ No hay token de autenticación. La carga podría fallar.');
    }
    
    const backendResponse = await estadoNormasService.uploadExcel(file);
    
    console.log('✓ Respuesta recibida del backend:');
    console.log(JSON.stringify(backendResponse, null, 2));
    
    // Recargar datos desde la API después de la carga exitosa
    await fetchEstadoNormasFromAPI();
    
    console.log('✓ Archivo subido exitosamente al backend');
    console.info('%c✓ CARGA EXITOSA', 'color: green; font-weight: bold; font-size: 14px;');
    console.info('El archivo se ha sincronizado correctamente con la base de datos');
    
  } catch (error) {
    console.error('=== ERROR AL ENVIAR ARCHIVO ===');
    console.error('Mensaje de error:', error.message);
    console.error('Stack:', error.stack);
    
    console.warn('%c⚠️ El archivo se procesó localmente pero no se sincronizó con el backend', 'color: orange; font-weight: bold;');
    console.warn('Detalles del error:', error.message);
    console.warn('Revisa la consola para más información');
    console.warn('Los datos están disponibles localmente en sessionStorage');
  }
}

// ===== AGREGAR DATOS SIN DUPLICADOS =====
function addDataWithoutDuplicates(newData) {
  let addedCount = 0;
  let duplicateCount = 0;
  let exceededCount = 0;
  const totalInFile = newData.length;

  newData.forEach(newRow => {
    const isDuplicate = allData.some(existingRow => {
      // Buscar por combinación de campos clave
      const keysMatch =
        String(newRow['CODIGO NCL'] || '').trim() === String(existingRow['CODIGO NCL'] || '').trim() &&
        String(newRow['VERSION'] || '').trim() === String(existingRow['VERSION'] || '').trim() &&
        String(newRow['NOMBRE_NCL'] || '').trim() === String(existingRow['NOMBRE_NCL'] || '').trim();
      return keysMatch;
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

// ===== POBLAR FILTROS DINÁMICAMENTE =====
function populateFilters() {
  const filters = {
    filterRedConocimiento: 'RED CONOCIMIENTO',
    filterNombreNCL: 'NOMBRE_NCL',
    filterTipoNorma: 'Tipo de Norma',
    filterMesaSectorial: 'Mesa Sectorial',
    filterTipoCompetencia: 'Tipo de competencia',
    filterCodigoPrograma: 'CODIGO PROGRAMA'
  };

  // ==================== SECCIÓN 4: RENDERIZACIÓN DE TABLAS ====================
  
  Object.keys(filters).forEach(filterId => {
    const select = document.getElementById(filterId);
    const field = filters[filterId];
    const uniqueValues = [...new Set(allData.map(item => item[field]).filter(Boolean))].sort();
    
    select.innerHTML = '<option value="">Todos</option>';
    uniqueValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  });

  // Poblar filtro de año
  const selectAno = document.getElementById('filterAno');
  const selectAnoTable = document.getElementById('filterAnoTable');
  
  if (selectAno || selectAnoTable) {
    const anos = new Set();
    allData.forEach(item => {
      const fecha = item['Fecha de Elaboración'];
      if (fecha) {
        const ano = new Date(fecha).getFullYear();
        if (!isNaN(ano)) {
          anos.add(ano);
        }
      }
    });
    
    const anosArray = [...anos].sort((a, b) => b - a);
    
    if (selectAno) {
      selectAno.innerHTML = '<option value="">Todos</option>';
      anosArray.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        selectAno.appendChild(option);
      });
    }
    
    if (selectAnoTable) {
      selectAnoTable.innerHTML = '<option value="">Todos</option>';
      anosArray.forEach(ano => {
        const option = document.createElement('option');
        option.value = ano;
        option.textContent = ano;
        selectAnoTable.appendChild(option);
      });
    }
  }
}

// ===== RENDERIZAR TABLA PRINCIPAL =====
const wrap = (text) => `<div class="cell-content" title="${String(text || '').replace(/"/g, '&quot;')}">${text || ''}</div>`;

function renderTable() {
  tableBody.innerHTML = '';

  if (filteredData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-5">
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

    tr.innerHTML = `
      <td>${wrap(row['RED CONOCIMIENTO'])}</td>
      <td>${wrap(row['NOMBRE_NCL'])}</td>
      <td>${wrap(row['CODIGO NCL'] || row['NCL CODIGO'])}</td>
      <td>${wrap(row['Tipo de competencia'])}</td>
      <td><div class="cell-content"><span class="badge ${getVigenciaBadge(row['Vigencia'])}">${row['Vigencia'] || ''}</span></div></td>
      <td>${wrap(row['Fecha de Elaboración'])}</td>
    `;
    tableBody.appendChild(tr);
  });

  renderVigentesTable();
  renderVencidasTable();
  renderPagination();
}

// ===== OBTENER CLASE DE VIGENCIA =====
function getVigenciaBadge(vigencia) {
  const cls = classifyVigencia(vigencia);
  if (cls === 'vigentes') return 'bg-success';
  if (cls === 'noVigentes') return 'bg-danger';
  if (cls === 'noNecesita') return 'bg-warning';
  return 'bg-secondary';
}

// ===== RENDERIZAR TABLA DE NORMAS VIGENTES =====
function renderVigentesTable() {
  vigentesTableBody.innerHTML = '';
  
  const vigentes = filteredData.filter(row => classifyVigencia(row['Vigencia']) === 'vigentes');

  if (vigentes.length === 0) {
    vigentesTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay normas vigentes</td></tr>';
    renderVigentesPagination(0);
    return;
  }

  const start = (currentVigentesPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageData = vigentes.slice(start, end);

  pageData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${wrap(row['RED CONOCIMIENTO'])}</td>
      <td>${wrap(row['NOMBRE_NCL'])}</td>
      <td>${wrap(row['Tipo de Norma'])}</td>
      <td>${wrap(row['Mesa Sectorial'])}</td>
      <td><div class="cell-content"><span class="badge bg-success">${row['Vigencia'] || ''}</span></div></td>
    `;
    vigentesTableBody.appendChild(tr);
  });
  
  renderVigentesPagination(vigentes.length);
}

function renderVigentesPagination(total) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentVigentesPage > totalPages) currentVigentesPage = totalPages;
  
  const pageInfo = document.getElementById('pageInfoVigentes');
  if (pageInfo) pageInfo.textContent = `Página ${currentVigentesPage} de ${totalPages}`;
  
  const btnPrev = document.getElementById('btnPrevPageVigentes');
  const btnNext = document.getElementById('btnNextPageVigentes');
  
  if (btnPrev) {
    btnPrev.disabled = currentVigentesPage <= 1;
    btnPrev.onclick = () => {
      if (currentVigentesPage > 1) {
        currentVigentesPage--;
        renderVigentesTable();
      }
    };
  }
  
  if (btnNext) {
    btnNext.disabled = currentVigentesPage >= totalPages;
    btnNext.onclick = () => {
      if (currentVigentesPage < totalPages) {
        currentVigentesPage++;
        renderVigentesTable();
      }
    };
  }
}

// ===== RENDERIZAR TABLA DE NORMAS VENCIDAS =====
function renderVencidasTable() {
  vencidasTableBody.innerHTML = '';
  
  const vencidas = filteredData.filter(row => classifyVigencia(row['Vigencia']) === 'noVigentes');

  if (vencidas.length === 0) {
    vencidasTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay normas vencidas</td></tr>';
    renderVencidasPagination(0);
    return;
  }

  const start = (currentVencidasPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageData = vencidas.slice(start, end);

  pageData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${wrap(row['RED CONOCIMIENTO'])}</td>
      <td>${wrap(row['NOMBRE_NCL'])}</td>
      <td>${wrap(row['Tipo de Norma'])}</td>
      <td><div class="cell-content"><span class="badge bg-danger">${row['Vigencia'] || ''}</span></div></td>
      <td>${wrap(row['Fecha de revisión'] || 'N/A')}</td>
    `;
    vencidasTableBody.appendChild(tr);
  });
  
  renderVencidasPagination(vencidas.length);
}

function renderVencidasPagination(total) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentVencidasPage > totalPages) currentVencidasPage = totalPages;
  
  const pageInfo = document.getElementById('pageInfoVencidas');
  if (pageInfo) pageInfo.textContent = `Página ${currentVencidasPage} de ${totalPages}`;
  
  const btnPrev = document.getElementById('btnPrevPageVencidas');
  const btnNext = document.getElementById('btnNextPageVencidas');
  
  if (btnPrev) {
    btnPrev.disabled = currentVencidasPage <= 1;
    btnPrev.onclick = () => {
      if (currentVencidasPage > 1) {
        currentVencidasPage--;
        renderVencidasTable();
      }
    };
  }
  
  if (btnNext) {
    btnNext.disabled = currentVencidasPage >= totalPages;
    btnNext.onclick = () => {
      if (currentVencidasPage < totalPages) {
        currentVencidasPage++;
        renderVencidasTable();
      }
    };
  }
}

// ==================== SECCIÓN 5: FILTROS Y BÚSQUEDA ====================

// ===== ACTUALIZAR ESTADÍSTICAS =====
function updateStats() {
  totalRecords.textContent = allData.length;
  filteredRecords.textContent = filteredData.length;
}

// ===== APLICAR FILTROS =====
document.getElementById('applyFilters').addEventListener('click', () => {
  const searchAllValue = (searchAll?.value || '').toLowerCase();
  const redConocimiento = document.getElementById('filterRedConocimiento')?.value || '';
  const nombreNCL = document.getElementById('filterNombreNCL')?.value || '';
  const tipoNorma = document.getElementById('filterTipoNorma')?.value || '';
  const mesaSectorial = document.getElementById('filterMesaSectorial')?.value || '';
  const tipoCompetencia = document.getElementById('filterTipoCompetencia')?.value || '';
  const vigencia = document.getElementById('filterVigencia')?.value || '';
  const codigoPrograma = document.getElementById('filterCodigoPrograma')?.value || '';
  // En este layout no existe #filterAno en el panel izquierdo; si no existe, tratamos como "Todos"
  const ano = document.getElementById('filterAno')?.value || '';
  const fechaDesde = document.getElementById('filterFechaElaboracionDe')?.value || '';
  const fechaHasta = document.getElementById('filterFechaElaboracionHasta')?.value || '';

  filteredData = allData.filter(row => {
    const matchSearch = !searchAllValue || Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchAllValue)
    );
    const matchRed = !redConocimiento || row['RED CONOCIMIENTO'] === redConocimiento;
    const matchNombre = !nombreNCL || row['NOMBRE_NCL'] === nombreNCL;
    const matchTipo = !tipoNorma || row['Tipo de Norma'] === tipoNorma;
    const matchMesa = !mesaSectorial || row['Mesa Sectorial'] === mesaSectorial;
    const matchCompetencia = !tipoCompetencia || row['Tipo de competencia'] === tipoCompetencia;
    
    // Filtro vigencia (Activo/Inactivo) usando clasificador exclusivo
    let matchVigencia = true;
    if (vigencia) {
      const cat = classifyVigencia(row['Vigencia']);
      if (vigencia === 'Activo') matchVigencia = (cat === 'vigentes');
      else if (vigencia === 'Inactivo') matchVigencia = (cat === 'noVigentes');
    }
    
    const matchCodigoPrograma = !codigoPrograma || row['CODIGO PROGRAMA'] === codigoPrograma;
    
    // Filtro por año
    let matchAno = true;
    if (ano) {
      const fecha = row['Fecha de Elaboración'];
      if (fecha) {
        const anoFecha = new Date(fecha).getFullYear();
        matchAno = anoFecha.toString() === ano;
      } else {
        matchAno = false;
      }
    }
    
    // Filtro fecha elaboración
    let matchFecha = true;
    if (fechaDesde || fechaHasta) {
      const fecha = row['Fecha de Elaboración'];
      if (fechaDesde && fecha < fechaDesde) matchFecha = false;
      if (fechaHasta && fecha > fechaHasta) matchFecha = false;
    }

    return matchSearch && matchRed && matchNombre && matchTipo && 
           matchMesa && matchCompetencia && matchVigencia && matchCodigoPrograma && matchAno && matchFecha;
  });

  currentPage = 1;
  currentVigentesPage = 1;
  currentVencidasPage = 1;
  renderTable();
  updateStats();
});

// ===== LIMPIAR FILTROS =====
document.getElementById('clearFilters').addEventListener('click', () => {
  searchAll.value = '';
  document.querySelectorAll('.filter-group select').forEach(select => select.value = '');
  document.getElementById('filterFechaElaboracionDe').value = '';
  document.getElementById('filterFechaElaboracionHasta').value = '';
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
  XLSX.utils.book_append_sheet(wb, ws, 'Normas');
  XLSX.writeFile(wb, `EstadoNormas_${new Date().toISOString().slice(0,10)}.xlsx`);
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

// ===== FILTRO DE AÑO EN LA TABLA =====
document.getElementById('filterAnoTable')?.addEventListener('change', () => {
  const selectedAno = document.getElementById('filterAnoTable').value;
  
  // Filtrar datos por año
  if (selectedAno) {
    const anoNum = parseInt(selectedAno, 10);
    filteredData = allData.filter(row => {
      const fecha = row['Fecha de Elaboración'];
      if (fecha) {
        const anoFecha = new Date(fecha).getFullYear();
        return anoFecha === anoNum;
      }
      return false;
    });
  } else {
    filteredData = [...allData];
  }
  
  // Mostrar contador de registros filtrados
  const countByYear = document.getElementById('countByYear');
  if (countByYear) {
    if (filteredData.length > 0) {
      countByYear.textContent = `${filteredData.length} registros`;
      countByYear.style.display = 'inline-block';
    } else {
      countByYear.style.display = 'none';
    }
  }
  
  currentPage = 1;
  renderTable();
  updateStats();
});

// ===== BOTÓN DE ESTADÍSTICAS =====
const btnStats = document.getElementById('btnStats');
if (btnStats) {
  btnStats.addEventListener('click', () => {
    console.log('Click en Estadísticas');
    const stats = calculateStats();
    
    if (!statsContent) {
      console.error('statsContent no encontrado en el DOM');
      return;
    }
    
    statsContent.innerHTML = `
      <div class="row">
        <div class="col-md-4">
          <div class="card text-center mb-3">
            <div class="card-body">
              <h5 class="card-title">Total de Normas</h5>
              <h2 class="text-primary">${stats.totalNormas}</h2>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center mb-3">
            <div class="card-body">
              <h5 class="card-title">Normas Vigentes</h5>
              <h2 class="text-success">${stats.totalVigentes}</h2>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card text-center mb-3">
            <div class="card-body">
              <h5 class="card-title">Normas Vencidas</h5>
              <h2 class="text-danger">${stats.totalVencidas}</h2>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header bg-primary text-white">
          <strong>Resumen por Red de Conocimiento</strong>
        </div>
        <div class="card-body">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Red de Conocimiento</th>
                <th>Total Normas</th>
                <th>Vigentes</th>
                <th>Vencidas</th>
              </tr>
            </thead>
            <tbody>
              ${stats.porRed.map(r => `
                <tr>
                  <td>${r.red}</td>
                  <td>${r.total}</td>
                  <td><span class="badge bg-success">${r.vigentes}</span></td>
                  <td><span class="badge bg-danger">${r.vencidas}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="mt-3">
            <h6 class="mb-2">Distribución por Tipo de Norma</h6>
            <div id="chartTipoNorma" style="min-height: 400px; width: 100%;"></div>
          </div>
          <div class="mt-4">
            <h6 class="mb-2">Vigentes vs No Vigentes por Tipo de Norma</h6>
            <div id="chartTipoNormaVigencia" style="min-height: 400px; width: 100%;"></div>
          </div>
        </div>
      </div>
    `;
    
    // Renderizar gráficas con delay para asegurar DOM listo
    setTimeout(() => {
      console.log('Renderizando gráficas...');
      try {
        imprimirGraficaTipoNorma(filteredData);
      } catch (err) {
        console.error('Error renderizando gráfica circular:', err);
      }
      try {
        imprimirGraficaTipoNormaVigencia(filteredData);
      } catch (err) {
        console.error('Error renderizando gráfica de vigencia:', err);
      }
    }, 300);
  });
} else {
  console.warn('⚠️ Botón #btnStats no encontrado');
}

// ===== CALCULAR ESTADÍSTICAS =====
function calculateStats() {
  const totalNormas = filteredData.length;

  let totalVigentes = 0;
  let totalVencidas = 0; // aquí tratamos "noVigentes" como vencidas para el resumen

  const redes = {};
  filteredData.forEach(row => {
    const cat = classifyVigencia(row['Vigencia']);
    if (cat === 'vigentes') totalVigentes++;
    else if (cat === 'noVigentes') totalVencidas++;

    const red = row['RED CONOCIMIENTO'] || 'Sin Red';
    if (!redes[red]) redes[red] = { vigentes: 0, vencidas: 0 };
    if (cat === 'vigentes') redes[red].vigentes++;
    else if (cat === 'noVigentes') redes[red].vencidas++;
  });

  const porRed = Object.keys(redes).map(red => ({
    red,
    total: redes[red].vigentes + redes[red].vencidas,
    vigentes: redes[red].vigentes,
    vencidas: redes[red].vencidas
  }));

  return { totalNormas, totalVigentes, totalVencidas, porRed };
}

// ===== CARGAR DATOS DE EJEMPLO =====
document.getElementById('loadSampleData').addEventListener('click', () => {
  const sampleData = generateSampleData();
  const result = addDataWithoutDuplicates(sampleData);
  
  saveDataToMemory();
  populateFilters();
  currentPage = 1;
  renderTable();
  updateStats();
  
  showSuccessModal(result);
});

// ===== BORRAR TODOS LOS DATOS =====
document.getElementById('clearAllData').addEventListener('click', () => {
  if (confirm('¿Estás seguro de que quieres borrar TODOS los datos? Esta acción no se puede deshacer.')) {
    allData = [];
    filteredData = [];
    sessionStorage.removeItem('senaEstadoNormasData');
    sessionStorage.removeItem('senaEstadoNormasLastUpdate');
    
    populateFilters();
    renderTable();
    updateStats();
    
    alert('✓ Todos los datos han sido borrados');
  }
});

// ===== GENERAR DATOS DE EJEMPLO =====
function generateSampleData() {
  const redesConocimiento = [
    'Administración',
    'Agropecuaria',
    'Artesanías',
    'Comercio y Servicios',
    'Construcción',
    'Diseño e Innovación Tecnológica Industrial',
    'Gestión Administrativa',
    'Información y Comunicación'
  ];

  const tiposNorma = ['Estándar de Competencia', 'Norma de Competencia', 'Guía de Orientación'];
  const mesasSectoriales = ['Mesa Agropecuaria', 'Mesa Administrativa', 'Mesa de Comercio', 'Mesa de Tecnología'];
  const tiposCompetencia = ['Genérica', 'Específica', 'Transversal'];
  const vigencias = ['Vigente', 'Vencida'];

  const data = [];
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < 60; i++) {
    const red = redesConocimiento[Math.floor(Math.random() * redesConocimiento.length)];
    const tipoNorma = tiposNorma[Math.floor(Math.random() * tiposNorma.length)];
    const mesa = mesasSectoriales[Math.floor(Math.random() * mesasSectoriales.length)];
    const tipoComp = tiposCompetencia[Math.floor(Math.random() * tiposCompetencia.length)];
    const vigencia = vigencias[Math.floor(Math.random() * vigencias.length)];

    const codigoNCL = `NCL-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const version = `${Math.floor(Math.random() * 5) + 1}.0`;
    const añoElaboracion = currentYear - Math.floor(Math.random() * 5);
    const mesElaboracion = Math.floor(Math.random() * 12) + 1;
    const diaElaboracion = Math.floor(Math.random() * 28) + 1;
    const fechaElaboracion = `${añoElaboracion}-${String(mesElaboracion).padStart(2, '0')}-${String(diaElaboracion).padStart(2, '0')}`;

    const mesRevisión = Math.floor(Math.random() * 12) + 1;
    const diaRevisión = Math.floor(Math.random() * 28) + 1;
    const fechaRevisión = `${currentYear}-${String(mesRevisión).padStart(2, '0')}-${String(diaRevisión).padStart(2, '0')}`;

    data.push({
      'RED CONOCIMIENTO': red,
      'NOMBRE_NCL': `Norma de ${red} - ${tipoNorma}`,
      'CODIGO NCL': codigoNCL,
      'NCL VERSION': version,
      'Norma corte a NOVIEMBRE': `${red} - v${version}`,
      'Versión': version,
      'Norma - Versión': `${codigoNCL} - ${version}`,
      'Mesa Sectorial': mesa,
      'Tipo de Norma': tipoNorma,
      'Observación': `Norma actualizada en ${añoElaboracion}`,
      'Fecha de revisión': fechaRevisión,
      'Tipo de competencia': tipoComp,
      'Vigencia': vigencia,
      'Fecha de Elaboración': fechaElaboracion,
      'CODIGO PROGRAMA': `PROG-${String(Math.floor(Math.random() * 9000) + 1000)}`
    });
  }

  return data;
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
  
  // Ocultar todas las alertas primero
  document.getElementById('alertSuccess').classList.add('d-none');
  document.getElementById('alertWarning').classList.add('d-none');
  document.getElementById('alertInfo').classList.add('d-none');
  const alertDangerEl = document.getElementById('alertDanger');
  if (alertDangerEl) alertDangerEl.classList.add('d-none');
  
  if (duplicateCount === 0 && addedCount > 0) {
    modalIcon.className = 'fas fa-check-circle';
    modalTitle.textContent = '¡Carga Exitosa!';
    modalSubtitle.textContent = 'Todas las normas se agregaron correctamente';
    modalDescription.textContent = `Se procesaron ${totalInFile} registros del archivo`;
    
    document.getElementById('alertSuccess').classList.remove('d-none');
    document.getElementById('successMessage').textContent = `${addedCount} norma(s) nueva(s) agregada(s) al sistema`;
    document.getElementById('alertInfo').classList.remove('d-none');
    
  } else if (duplicateCount > 0 && addedCount > 0 && (!exceededCount || exceededCount === 0)) {
    modalIcon.className = 'fas fa-exclamation-circle';
    modalTitle.textContent = 'Carga Completada con Observaciones';
    modalSubtitle.textContent = 'Se encontraron registros duplicados';
    modalDescription.textContent = `Se procesaron ${totalInFile} registros del archivo`;
    
    document.getElementById('alertSuccess').classList.remove('d-none');
    document.getElementById('successMessage').textContent = `${addedCount} norma(s) nueva(s) agregada(s)`;
    
    document.getElementById('alertWarning').classList.remove('d-none');
    document.getElementById('warningMessage').textContent = `${duplicateCount} norma(s) duplicada(s) no se agregaron (ya existen en el sistema)`;
    
    document.getElementById('alertInfo').classList.remove('d-none');
    
  } else if (duplicateCount > 0 && addedCount === 0 && (!exceededCount || exceededCount === 0)) {
    modalIcon.className = 'fas fa-info-circle';
    modalTitle.textContent = 'Sin Cambios';
    modalSubtitle.textContent = 'Todas las normas ya existen';
    modalDescription.textContent = `Se procesaron ${totalInFile} registros del archivo`;
    
    document.getElementById('alertWarning').classList.remove('d-none');
    document.getElementById('warningMessage').textContent = `Las ${duplicateCount} normas del archivo ya existen en el sistema. No se agregaron datos nuevos.`;
  }

  if (exceededCount && exceededCount > 0) {
    modalIcon.className = 'fas fa-times-circle';
    modalTitle.textContent = 'Límite de registros excedido';
    modalSubtitle.textContent = 'Algunas normas no se agregaron por límite máximo';
    modalDescription.textContent = `Se intentaron agregar ${totalInFile} registros, pero ${exceededCount} superan el máximo permitido (${MAX_RECORDS}).`;
    if (alertDangerEl) {
      alertDangerEl.classList.remove('d-none');
      const dangerMessage = document.getElementById('dangerMessage');
      if (dangerMessage) dangerMessage.textContent = `${exceededCount} norma(s) rechazada(s) por superar el límite máximo (${MAX_RECORDS}).`;
    }
    document.getElementById('alertInfo').classList.remove('d-none');
    if (addedCount > 0) {
      document.getElementById('alertSuccess').classList.remove('d-none');
      document.getElementById('successMessage').textContent = `${addedCount} norma(s) nueva(s) agregada(s)`;
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

// ===== FUNCIONES DE PAGINACIÓN =====
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

// ==================== SECCIÓN 6: GRÁFICAS Y ESTADÍSTICAS ====================

// ===== CLASIFICAR VIGENCIA =====
function classifyVigencia(vigenciaRaw) {
  if (!vigenciaRaw) return 'noAplica';
  
  const vigencia = vigenciaRaw.toLowerCase().trim();
  
  // Prioridad: no aplica → no necesita → no vigente → vigente
  if (vigencia.includes('no aplica')) return 'noAplica';
  if (vigencia.includes('no necesita') || vigencia.includes('no requiere')) return 'noNecesita';
  if (vigencia.includes('vencid') || vigencia.includes('expir') || vigencia.includes('inactiv') || vigencia.includes('no vigente')) return 'noVigentes';
  if (vigencia.includes('vigente') || vigencia.includes('activo') || vigencia.includes('sí')) return 'vigentes';
  
  return 'noAplica'; // Default
}

// ===== GRÁFICA CIRCULAR: VIGENTES | NO VIGENTES | NO NECESITA | NO APLICA =====

// ===== GRÁFICA CIRCULAR: VIGENTES vs NO VIGENTES =====

function imprimirGraficaTipoNorma(data){
  try {
    console.log('Iniciando gráfica circular con', data.length, 'registros');
    
    let vigentes = 0;
    let noVigentes = 0;
    let noNecesita = 0;
    let noAplica = 0;

    (Array.isArray(data) ? data : []).forEach(r => {
      const cat = classifyVigencia(r['Vigencia']);
      if (cat === 'vigentes') vigentes++;
      else if (cat === 'noVigentes') noVigentes++;
      else if (cat === 'noNecesita') noNecesita++;
      else if (cat === 'noAplica') noAplica++;
      else noAplica++;
    });
    
    console.log('Conteos:', { vigentes, noVigentes, noNecesita, noAplica });
    
    const finalSeries = [vigentes, noVigentes, noNecesita, noAplica];
    const finalLabels = [
      `Vigentes (${vigentes})`,
      `No Vigentes (${noVigentes})`,
      `No Necesita (${noNecesita})`,
      `No Aplica (${noAplica})`
    ];
    const finalColors = ['#28a745', '#dc3545', '#ffc107', '#6c757d'];
    
    const el = document.querySelector('#chartTipoNorma');
    if (!el) {
      console.error('❌ Contenedor #chartTipoNorma NO encontrado');
      return;
    }
    
    console.log('✓ Contenedor encontrado');
    el.innerHTML = '<p class="text-center text-muted">Cargando gráfica...</p>';
    
    if (typeof ApexCharts === 'undefined') {
      console.error('❌ ApexCharts no está cargado');
      el.innerHTML = '<p class="text-danger">Error: ApexCharts no cargado</p>';
      return;
    }
    
    console.log('✓ ApexCharts disponible');
    
    const options = {
      series: finalSeries,
      chart: { 
        type: 'pie',
        width: '100%',
        height: 400
      },
      labels: finalLabels,
      colors: finalColors,
      plotOptions: {
        pie: {
          dataLabels: {
            enabled: true,
            minAngleToShowLabel: 0,
            formatter: function(val, opts) {
              const count = opts.w.globals.series[opts.seriesIndex];
              return count > 0 ? count : '';
            }
          }
        }
      },
      dataLabels: {
        enabled: true,
        style: {
          fontSize: '12px',
          fontWeight: 'bold'
        }
      },
      legend: {
        position: 'bottom',
        show: true
      },
      tooltip: {
        y: {
          formatter: function (val) {
            return val + ' normas';
          }
        }
      }
    };
    
    el.innerHTML = '';
    const chart = new ApexCharts(el, options);
    chart.render();
    console.log('✓ Gráfica circular renderizada exitosamente');
  } catch (error) {
    console.error('❌ Error al renderizar gráfica circular:', error);
  }
}

// ===== CREAR GRÁFICA DE DISTRIBUCIÓN POR TIPO DE NORMA CON VIGENCIA =====
function imprimirGraficaTipoNormaVigencia(data) {
  try {
    console.log('Iniciando gráfica de vigencia con', data.length, 'registros');
    
    const tipos = {};
    
    (Array.isArray(data) ? data : []).forEach(r => {
      const tipo = r['Tipo de Norma'] || 'Sin Tipo';
      const cat = classifyVigencia(r['Vigencia']);
      if (!tipos[tipo]) tipos[tipo] = { vigentes: 0, noVigentes: 0, total: 0 };
      tipos[tipo].total++;
      if (cat === 'vigentes') tipos[tipo].vigentes++;
      else tipos[tipo].noVigentes++;
    });
    
    const entries = Object.entries(tipos).sort((a, b) => b[1].total - a[1].total);
    
    console.log('Tipos encontrados:', entries.length);
    
    const el = document.querySelector('#chartTipoNormaVigencia');
    if (!el) {
      console.error('❌ Contenedor #chartTipoNormaVigencia NO encontrado');
      return;
    }
    
    console.log('✓ Contenedor encontrado');
    
    if (entries.length === 0) {
      el.innerHTML = '<p class="text-center text-muted">No hay datos disponibles</p>';
      return;
    }
    
    if (typeof ApexCharts === 'undefined') {
      console.error('❌ ApexCharts no está cargado');
      el.innerHTML = '<p class="text-danger">Error: ApexCharts no cargado</p>';
      return;
    }
    
    const labels = entries.map(e => e[0]);
    const vigentesData = entries.map(e => {
      const porcentaje = e[1].total > 0 ? (e[1].vigentes / e[1].total) * 100 : 0;
      return Math.round(porcentaje);
    });
    
    const noVigentesData = entries.map(e => {
      const porcentaje = e[1].total > 0 ? (e[1].noVigentes / e[1].total) * 100 : 0;
      return Math.round(porcentaje);
    });
    
    el.innerHTML = '';
    
    const options = {
      series: [
        {
          name: 'Vigentes (%)',
          data: vigentesData
        },
        {
          name: 'No Vigentes (%)',
          data: noVigentesData
        }
      ],
      chart: {
        type: 'bar',
        height: 350,
        stacked: true,
        stackType: '100%'
      },
      colors: ['#28a745', '#dc3545'],
      plotOptions: {
        bar: {
          horizontal: false,
          dataLabels: {
            enabled: true,
            formatter: function(val) {
              return val > 0 ? val + '%' : '';
            }
          }
        }
      },
      xaxis: {
        categories: labels,
        title: {
          text: 'Tipo de Norma'
        }
      },
      yaxis: {
        title: {
          text: 'Porcentaje (%)'
        },
        max: 100
      },
      legend: {
        position: 'bottom'
      },
      tooltip: {
        y: {
          formatter: function (val) {
            return val + '%';
          }
        }
      }
    };
    
    const chart = new ApexCharts(el, options);
    chart.render();
    console.log('✓ Gráfica de vigencia renderizada exitosamente');
  } catch (error) {
    console.error('❌ Error al renderizar gráfica de vigencia:', error);
  }
}
if (allData.length > 0) {
  populateFilters();
  renderTable();
  updateStats();
}

// ===== CARGAR DATOS DESDE LA API =====
async function fetchEstadoNormasFromAPI() {
  try {
    console.log('Cargando datos desde la API...');
    const res = await estadoNormasService.getAll();
    
    // Extraer el array de datos de diferentes estructuras de respuesta
    const data = Array.isArray(res) ? res : (res?.data || res?.items || res?.records || []);
    
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('Respuesta sin registros o formato no esperado', res);
      allData = [];
      filteredData = [];
    } else {
      // Mapear datos del backend al formato esperado por la tabla
      allData = data.map(row => ({
        'RED CONOCIMIENTO': row.red_conocimiento || row.red || '',
        'NOMBRE_NCL': row.nombre_ncl || row.nombre || '',
        'CODIGO NCL': row.codigo_ncl || row.codigo || '',
        'NCL VERSION': row.version || row.ncl_version || '',
        'Norma corte a NOVIEMBRE': row.norma_corte || '',
        'Versión': row.version || '',
        'Norma - Versión': row.norma_version || `${row.codigo_ncl || ''} - ${row.version || ''}`,
        'Mesa Sectorial': row.mesa_sectorial || row.mesa || '',
        'Tipo de Norma': row.tipo_norma || row.tipo || '',
        'Observación': row.observacion || '',
        'Fecha de revisión': row.fecha_revision || '',
        'Tipo de competencia': row.tipo_competencia || '',
        'Vigencia': row.vigencia || '',
        'Fecha de Elaboración': row.fecha_elaboracion || '',
        'CODIGO PROGRAMA': row.codigo_programa || ''
      }));
      filteredData = [...allData];
      saveDataToMemory(); // Guardar en sessionStorage
      console.log(`✓ ${allData.length} registros cargados desde la API`);
    }
    
    populateFilters();
    renderTable();
    updateStats();
  } catch (error) {
    console.error('Error cargando estado de normas desde API:', error);
    // Si falla la API, intentar cargar desde sessionStorage
    allData = loadDataFromMemory();
    filteredData = [...allData];
    if (allData.length > 0) {
      console.info('Usando datos guardados localmente');
      populateFilters();
      renderTable();
      updateStats();
    }
  }
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Página cargada. Iniciando carga de datos desde la API...');
  await fetchEstadoNormasFromAPI();
});

export function Init() {
  fetchEstadoNormasFromAPI();
}
