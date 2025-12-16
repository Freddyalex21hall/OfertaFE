import { panelService } from '../api/historico.service.js';
const MAX_RECORDS = 25000;
// ===== VARIABLES GLOBALES =====
let allData = [];
let filteredData = [];
let currentPage = 1;
const PAGE_SIZE = 50;
let currentPageActive = 1;
let currentPageClosed = 1;
let isPopulating = false;

function normalizeText(v){
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function extractArrayPayload(res){
  if (Array.isArray(res)) return res;
  function pick(obj){
    if (!obj || typeof obj !== 'object') return undefined;
    const keys = ['data','historico','results','items'];
    for (const k of keys){
      const v = obj[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object'){
        const nested = pick(v);
        if (Array.isArray(nested)) return nested;
      }
    }
    for (const k in obj){
      const v = obj[k];
      if (Array.isArray(v)) return v;
      if (v && typeof v === 'object'){
        const nested = pick(v);
        if (Array.isArray(nested)) return nested;
      }
    }
    return undefined;
  }
  const arr = pick(res);
  return Array.isArray(arr) ? arr : [];
}

// ===== CARGAR DATOS DESDE SESSIONSTORAGE AL INICIO =====
function loadDataFromMemory() {
  try {
    const dataStr = sessionStorage.getItem('senaOfertaData');
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
    sessionStorage.setItem('senaOfertaData', dataStr);
    sessionStorage.setItem('senaOfertaLastUpdate', new Date().toISOString());
  } catch (e) {
    console.error('Error al guardar datos:', e);
  }
}

// ===== INICIALIZAR DATOS =====
allData = loadDataFromMemory();
filteredData = [...allData];
let existingKeys = new Set();
function initIndexFromMemory(){
  existingKeys = new Set();
  for (const r of allData){
    const ficha = r.FICHA ? String(r.FICHA).trim() : '';
    if (ficha) existingKeys.add(`F:${ficha}`); else {
      const programa = String(r.PROGRAMA_FORMACION || '').trim();
      const centro = String(r.NOMBRE_CENTRO || '').trim();
      const inicio = String(r.FECHA_INICIO || '').trim();
      const modalidad = String(r.MODALIDAD_FORMACION || '').trim();
      existingKeys.add(`C:${programa}|${centro}|${inicio}|${modalidad}`);
    }
  }
}
initIndexFromMemory();

// ===== ELEMENTOS DEL DOM =====
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const searchAll = document.getElementById('searchAll');
const tableBody = document.getElementById('tableBody');
const activeTableBody = document.getElementById('activeTableBody');
const closedTableBody = document.getElementById('closedTableBody');
const statsContent = document.getElementById('statsContent');
const totalRecords = document.getElementById('totalRecords');
const filteredRecords = document.getElementById('filteredRecords');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
let overlayShownAt = 0;
const MIN_OVERLAY_MS = 500;

function showLoading(text){
  if (loadingOverlay){
    overlayShownAt = performance.now();
    if (loadingText && text) loadingText.textContent = text;
    loadingOverlay.style.display = 'block';
  }
}
function hideLoading(){
  if (loadingOverlay){
    const elapsed = performance.now() - overlayShownAt;
    const remain = Math.max(0, MIN_OVERLAY_MS - elapsed);
    if (remain > 0){
      setTimeout(() => { loadingOverlay.style.display = 'none'; }, remain);
    } else {
      loadingOverlay.style.display = 'none';
    }
  }
}

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

// ===== SUBIDAS EN SEGUNDO PLANO =====
const uploadsPanel = document.getElementById('uploadsPanel');
const uploadsList = document.getElementById('uploadsList');
const btnUploads = document.getElementById('btnUploads');
btnUploads?.addEventListener('click', () => {
  if (!uploadsPanel) return;
  uploadsPanel.style.display = uploadsPanel.style.display === 'none' ? 'block' : 'none';
});
let uploads = [];
function renderUploads(){
  if (!uploadsList) return;
  if (uploads.length === 0){
    uploadsList.innerHTML = '<div class="list-group-item text-muted small">No hay subidas en curso</div>';
    return;
  }
  uploadsList.innerHTML = uploads.map((u,i) => `
    <div class="list-group-item">
      <div class="d-flex justify-content-between"><span class="small">${u.name}</span><span class="small">${Math.round((u.size||0)/1024)} KB</span></div>
      <div class="progress mt-1" style="height:6px;">
        <div class="progress-bar ${u.status==='error'?'bg-danger':(u.status==='completado'?'bg-success':'')}" role="progressbar" style="width:${u.percent||0}%"></div>
      </div>
      <div class="d-flex justify-content-between align-items-center mt-1">
        <div class="small text-muted">${u.status}${u.message? ' - '+u.message:''}</div>
        ${u.status==='error' ? `<button class="btn btn-sm btn-outline-primary btn-retry-upload" data-idx="${i}">Reintentar</button>` : ''}
      </div>
    </div>
  `).join('');
}
function showUploadAlert(type, text){
  const el = document.getElementById('uploadAlert');
  if (!el) return;
  el.className = `alert alert-${type} alert-dismissible fade show py-1 px-2`;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}
uploadsList?.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-retry-upload');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx,10);
  const item = uploads[idx];
  if (item && item.file){
    showUploadAlert('info','Reintentando subida...');
    addUploadTask(item.file);
  }
});
async function addUploadTask(file){
  const item = { name:file.name, size:file.size, percent:0, status:'subiendo', message:'', file };
  uploads.unshift(item);
  renderUploads();
  try{
    await panelService.uploadExcelHistoricoWithProgress(file, (p)=>{ item.percent = p; renderUploads(); });
    item.status='procesando'; renderUploads();
    await fetchHistoricoTodos();
    item.percent = 100;
    item.status='completado'; item.message='Datos actualizados'; renderUploads();
    showUploadAlert('success','Archivo subido correctamente');
  }catch(err){
    item.status='error'; item.message=err?.message||'Error al subir'; renderUploads();
    showUploadAlert('danger', item.message);
  }
}

// ===== PROCESAR ARCHIVO EXCEL =====
async function processFile(file) {
  const name = file?.name || '';
  if (!/\.(xlsx|xls)$/i.test(name)) {
    alert('Formato de archivo no soportado. Por favor, suba un Excel (.xlsx o .xls).');
    return;
  }
  addUploadTask(file);
  return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      showLoading('Leyendo archivo...');
      await new Promise(r => setTimeout(r, 0));
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      showLoading('Procesando Excel...');
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      
      if (!jsonData || jsonData.length === 0) {
        hideLoading();
        alert('El archivo no contiene datos válidos');
        return;
      }

      function getField(row, keys){
        const map = {};
        for (const k in row){ map[normalizeText(k)] = row[k]; }
        for (const key of keys){
          const v = map[normalizeText(key)];
          if (v !== undefined && v !== null) return v;
        }
        return undefined;
      }
      function isValidRowRegional(row){
        const cod = getField(row,['cod_regional','codigo_regional','codigo de regional','codigo regional','cod regional']);
        const nom = getField(row,['nombre_regional','regional','nombre de regional','nombre regional']);
        const codNum = parseInt(cod);
        const nomNorm = normalizeText(nom);
        return codNum === 66 && nomNorm.includes('risaralda');
      }
      const validRows = jsonData.filter(isValidRowRegional);
      const invalidCount = jsonData.length - validRows.length;
      if (validRows.length === 0){
        hideLoading();
        alert('El archivo no contiene registros de la Regional 66 - RISARALDA. No se subirá.');
        return;
      }

      try{
        if (invalidCount > 0) throw new Error('Archivo contiene registros de otras regionales');
        showLoading('Subiendo al servidor...');
        const res = await panelService.uploadExcelHistorico(file);
        console.log('[Historico][Upload Response]', res);
        showLoading('Actualizando datos del servidor...');
        await fetchHistoricoTodos();
        hideLoading();
        alert('✓ Archivo subido y datos actualizados desde el servidor');
        return;
      }catch(uploadErr){
        console.error('Error al subir a la API, se mostrará localmente:', uploadErr);
      }

      showLoading('Integrando registros localmente (RISARALDA)...');
      const result = await addDataWithoutDuplicatesChunked(validRows);
      saveDataToMemory();
      populateFilters();
      renderTable();
      updateStats();
      hideLoading();
      showSuccessModal(result);
    } catch (error) {
      console.error('Error procesando archivo:', error);
      hideLoading();
      alert('Error al procesar el archivo Excel. Verifica el formato.');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function addDataWithoutDuplicatesChunked(newData){
  const CHUNK_SIZE = 2000;
  let addedCount = 0, duplicateCount = 0, exceededCount = 0;
  const totalInFile = newData.length;
  for (let i = 0; i < newData.length; i += CHUNK_SIZE){
    const chunk = newData.slice(i, i + CHUNK_SIZE);
    const res = addDataWithoutDuplicates(chunk);
    addedCount += res.addedCount;
    duplicateCount += res.duplicateCount;
    exceededCount += res.exceededCount;
    if (i + CHUNK_SIZE < newData.length){
      showLoading(`Integrando registros... ${Math.min(i + CHUNK_SIZE, totalInFile)}/${totalInFile}`);
      await new Promise(r => setTimeout(r, 0));
    }
  }
  return { totalInFile, addedCount, duplicateCount, exceededCount, totalInSystem: allData.length };
}

function getRowKey(row){
  const ficha = row.FICHA ? String(row.FICHA).trim() : '';
  if (ficha) return `F:${ficha}`;
  const programa = String(row.PROGRAMA_FORMACION || '').trim();
  const centro = String(row.NOMBRE_CENTRO || '').trim();
  const inicio = String(row.FECHA_INICIO || '').trim();
  const modalidad = String(row.MODALIDAD_FORMACION || '').trim();
  return `C:${programa}|${centro}|${inicio}|${modalidad}`;
}
function rebuildIndex(){
  existingKeys = new Set();
  for (const r of allData){
    existingKeys.add(getRowKey(r));
  }
}

// ===== AGREGAR DATOS SIN DUPLICADOS =====
function addDataWithoutDuplicates(newData) {
  let addedCount = 0;
  let duplicateCount = 0;
  let exceededCount = 0;
  const totalInFile = newData.length;

  newData.forEach(newRow => {
    const key = getRowKey(newRow);
    const isDuplicate = existingKeys.has(key);

    if (isDuplicate) {
      duplicateCount++;
    } else if (allData.length + addedCount >= MAX_RECORDS) {
      exceededCount++;
    } else {
      allData.push(newRow);
      existingKeys.add(key);
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
  isPopulating = true;
  const filters = {
    filterRegional: 'NOMBRE_REGIONAL',
    filterCentro: 'NOMBRE_CENTRO',
    filterPrograma: 'PROGRAMA_FORMACION',
    filterNivel: 'NIVEL_FORMACION',
    filterModalidad: 'MODALIDAD_FORMACION',
    filterJornada: 'JORNADA',
    filterEstado: 'ESTADO_FICHA',
    filterEstrategia: 'CODIGO_ESTRATEGIA',
    filterMunicipio: 'MUNICIPIO'
  };

  Object.keys(filters).forEach(filterId => {
    const select = document.getElementById(filterId);
    const field = filters[filterId];
    const seen = new Map();
    allData.forEach(item => {
      const v = item[field];
      if (!v) return;
      const key = normalizeText(v);
      if (!seen.has(key)) seen.set(key, String(v));
    });
    const uniqueValues = Array.from(seen.values()).sort();
    
    select.innerHTML = '<option value="">Todos</option>';
    uniqueValues.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  });
  updateDependentFilters();
  isPopulating = false;
}

// ===== RENDERIZAR TABLA PRINCIPAL =====
function renderTable() {
  tableBody.innerHTML = '';

  if (filteredData.length === 0 && allData.length > 0) {
    filteredData = [...allData];
  }
  if (filteredData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="33" class="text-center text-muted py-5">
          <i class="fas fa-inbox fa-3x mb-3 d-block"></i>
          <p>No se encontraron resultados</p>
        </td>
      </tr>`;
    renderPagination();
    return;
  }

  console.log('[Historico][RenderTable] filteredData:', { length: filteredData.length });
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageData = filteredData.slice(start, end);
  console.log('[Historico][RenderTable] pageData sample:', pageData.slice(0, 3));

  pageData.forEach(row => {
    const tr = document.createElement('tr');
    const estado = getEstado(row.ESTADO_FICHA);

    const activos = row.ACTIVOS ?? 0;
    const inscritos = row.INSCRITOS ?? 0;
    const enTransito = row.EN_TRANSITO ?? 0;
    const formacion = row.FORMACION ?? 0;
    const induccion = row.INDUCCION ?? 0;
    const condicionados = row.CONDICIONADOS ?? 0;
    const aplazados = row.APLAZADOS ?? 0;
    const retiradoVoluntario = row.RETIROS_VOLUNTARIOS ?? 0;
    const cancelados = row.CANCELADOS ?? 0;
    const reprobados = row.REPROBADOS ?? 0;
    const noAptos = row.NO_APTOS ?? 0;
    const reingresados = row.REINGRESADO ?? 0;
    const porCertificar = row.POR_CERTIFICAR ?? 0;
    const certificados = row.CERTIFICADOS ?? 0;
    const trasladados = row.TRASLADADOS ?? 0;

    tr.innerHTML = `
      <td><span class="semaphore ${estado.color}"></span></td>
      <td>${row.CODIGO_REGIONAL || ''}</td>
      <td>${row.NOMBRE_REGIONAL || ''}</td>
      <td><strong>${row.FICHA || ''}</strong></td>
      <td>${row.CODIGO_PROGRAMA || row.CODIGO_PROGRAMA_FORMACION || ''}</td>
      <td>${row.CODIGO_CENTRO || ''}</td>
      <td>${row.MODALIDAD_FORMACION || ''}</td>
      <td>${row.JORNADA || ''}</td>
      <td>${row.ETAPA_FICHA || ''}</td>
      <td>${row.ESTADO_FICHA || ''}</td>
      <td>${row.FECHA_INICIO || ''}</td>
      <td>${row.FECHA_FIN || ''}</td>
      <td>${row.CODIGO_MUNICIPIO || ''}</td>
      <td>${row.CODIGO_ESTRATEGIA || ''}</td>
      <td>${row.CUPO_ASIGNADO ?? ''}</td>
      <td><span class="badge bg-primary">${row.MATRICULADOS ?? 0}</span></td>
      <td>${activos}</td>
      <td>${row.HISTORICO ?? ''}</td>
      <td>${row.CODIGO_FICHA_RELACIONADO || ''}</td>
      <td>${inscritos}</td>
      <td>${enTransito}</td>
      <td>${formacion}</td>
      <td>${induccion}</td>
      <td>${condicionados}</td>
      <td>${aplazados}</td>
      <td>${retiradoVoluntario}</td>
      <td>${cancelados}</td>
      <td>${reprobados}</td>
      <td>${noAptos}</td>
      <td>${reingresados}</td>
      <td>${porCertificar}</td>
      <td><span class="badge bg-success">${certificados}</span></td>
      <td>${trasladados}</td>
    `;
    tableBody.appendChild(tr);
  });

  renderActiveTable();
  renderClosedTable();
  renderPagination();
}

// ===== DETERMINAR ESTADO DE LA FICHA =====
function getEstado(estado) {
  if (!estado) return { color: 'semaphore-red', text: 'Desconocido' };
  const estadoLower = estado.toLowerCase();
  if (estadoLower.includes('ejecucion') || estadoLower.includes('activa')) {
    return { color: 'semaphore-green', text: 'Activa' };
  }
  if (estadoLower.includes('cerrada') || estadoLower.includes('terminada')) {
    return { color: 'semaphore-red', text: 'Cerrada' };
  }
  return { color: 'semaphore-yellow', text: 'En proceso' };
}

// ===== RENDERIZAR TABLA DE OFERTAS ACTIVAS =====
function renderActiveTable() {
  activeTableBody.innerHTML = '';
  const activeOffers = getActiveOffers();

  if (activeOffers.length === 0) {
    activeTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay ofertas activas</td></tr>';
    renderActivePagination(0);
    return;
  }

  const start = (currentPageActive - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageData = activeOffers.slice(start, end);

  pageData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.NOMBRE_CENTRO || ''}</td>
      <td>${row.PROGRAMA_FORMACION || ''}</td>
      <td>${row.FICHA || ''}</td>
      <td>${row.MATRICULADOS || 0}</td>
      <td>${row.FORMACION || 0}</td>
    `;
    activeTableBody.appendChild(tr);
  });
  renderActivePagination(activeOffers.length);
}

// ===== RENDERIZAR TABLA DE OFERTAS CERRADAS =====
function renderClosedTable() {
  closedTableBody.innerHTML = '';
  const closedOffers = getClosedOffers();

  if (closedOffers.length === 0) {
    closedTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay ofertas cerradas</td></tr>';
    renderClosedPagination(0);
    return;
  }

  const start = (currentPageClosed - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageData = closedOffers.slice(start, end);

  pageData.forEach(row => {
    const matriculados = parseInt(row.MATRICULADOS) || 0;
    const certificados = parseInt(row.CERTIFICADOS) || 0;
    const tasa = matriculados > 0 ? ((certificados / matriculados) * 100).toFixed(1) : 0;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.NOMBRE_CENTRO || ''}</td>
      <td>${row.PROGRAMA_FORMACION || ''}</td>
      <td>${row.FICHA || ''}</td>
      <td>${certificados}</td>
      <td><span class="badge ${tasa >= 70 ? 'bg-success' : 'bg-warning'}">${tasa}%</span></td>
    `;
    closedTableBody.appendChild(tr);
  });
  renderClosedPagination(closedOffers.length);
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function updateStats() {
  totalRecords.textContent = allData.length;
  filteredRecords.textContent = filteredData.length;
}

// ===== APLICAR FILTROS =====
document.getElementById('applyFilters').addEventListener('click', () => {
  const searchAllValue = searchAll.value.toLowerCase();
  const regional = document.getElementById('filterRegional').value;
  const centro = document.getElementById('filterCentro').value;
  const programa = document.getElementById('filterPrograma').value;
  const nivel = document.getElementById('filterNivel').value;
  const modalidad = document.getElementById('filterModalidad').value;
  const jornada = document.getElementById('filterJornada').value;
  const estado = document.getElementById('filterEstado').value;
  const estrategia = document.getElementById('filterEstrategia').value;
  const municipio = document.getElementById('filterMunicipio').value;
  const fechaInicio = document.getElementById('filterFechaInicio').value;
  const fechaFin = document.getElementById('filterFechaFin').value;

  function matchField(rowVal, selVal){
    if (!selVal) return true;
    return normalizeText(rowVal) === normalizeText(selVal);
  }

  filteredData = allData.filter(row => {
    const matchSearch = !searchAllValue || Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchAllValue)
    );
    const matchRegional = matchField(row.NOMBRE_REGIONAL, regional);
    const matchCentro = matchField(row.NOMBRE_CENTRO, centro);
    const matchPrograma = matchField(row.PROGRAMA_FORMACION, programa);
    const matchNivel = matchField(row.NIVEL_FORMACION, nivel);
    const matchModalidad = matchField(row.MODALIDAD_FORMACION, modalidad);
    const matchJornada = matchField(row.JORNADA, jornada);
    const matchEstado = matchField(row.ESTADO_FICHA, estado);
    const matchEstrategia = matchField(row.CODIGO_ESTRATEGIA, estrategia);
    const matchMunicipio = matchField(row.MUNICIPIO, municipio);
    const rowInicio = row.FECHA_INICIO ? new Date(row.FECHA_INICIO) : null;
    const rowFin = row.FECHA_FIN ? new Date(row.FECHA_FIN) : null;
    const matchFechaInicio = !fechaInicio || (rowInicio && rowInicio >= new Date(fechaInicio));
    const matchFechaFin = !fechaFin || (rowFin && rowFin <= new Date(fechaFin));

    return matchSearch && matchRegional && matchCentro && matchPrograma && 
           matchNivel && matchModalidad && matchJornada && matchEstado && matchEstrategia && matchMunicipio && matchFechaInicio && matchFechaFin;
  });

  currentPage = 1;
  currentPage = 1;
  currentPageActive = 1;
  currentPageClosed = 1;
  renderTable();
  updateStats();
});

document.querySelectorAll('.filter-group select').forEach(sel => {
  sel.addEventListener('change', () => {
    if (!isPopulating) document.getElementById('applyFilters').click();
  });
});
document.getElementById('searchAll')?.addEventListener('input', () => {
  document.getElementById('applyFilters').click();
});
document.getElementById('filterFechaInicio')?.addEventListener('change', () => {
  document.getElementById('applyFilters').click();
});
document.getElementById('filterFechaFin')?.addEventListener('change', () => {
  document.getElementById('applyFilters').click();
});

// ===== LIMPIAR FILTROS =====
document.getElementById('clearFilters').addEventListener('click', () => {
  searchAll.value = '';
  document.querySelectorAll('.filter-group select').forEach(select => select.value = '');
  const elInicio = document.getElementById('filterFechaInicio');
  if (elInicio) elInicio.value = '';
  const elFin = document.getElementById('filterFechaFin');
  if (elFin) elFin.value = '';
  filteredData = [...allData];
  currentPage = 1;
  currentPage = 1;
  currentPageActive = 1;
  currentPageClosed = 1;
  renderTable();
  updateStats();
  populateFilters();
});

// ===== EXPORTAR A EXCEL =====
document.getElementById('exportExcel').addEventListener('click', () => {
  if (filteredData.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  
  const ws = XLSX.utils.json_to_sheet(filteredData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ofertas');
  XLSX.writeFile(wb, `Ofertas_${new Date().toISOString().slice(0,10)}.xlsx`);
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
    <div class="container">
      <div class="row justify-content-center mb-3">
        <div class="col-md-8 text-center">
          <h3 class="mb-3">Estadísticas del Histórico</h3>
          <p class="text-muted">Resumen general y comparación entre centros</p>
        </div>
      </div>
      <div class="row justify-content-center">
        <div class="col-md-3">
          <div class="card text-center mb-3">
            <div class="card-body">
              <h5 class="card-title">Total Matriculados</h5>
              <h1 class="text-primary">${stats.totalMatriculados}</h1>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-center mb-3">
            <div class="card-body">
              <h5 class="card-title">Total Certificados</h5>
              <h1 class="text-success">${stats.totalCertificados}</h1>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-center mb-3">
            <div class="card-body">
              <h5 class="card-title">Tasa de Éxito</h5>
              <h1 class="text-info">${stats.tasaExito}%</h1>
            </div>
          </div>
        </div>
      </div>
      <div class="row justify-content-center">
        <div class="col-md-10">
          <div class="card">
            <div class="card-header bg-primary text-white">
              <strong>Resumen por Centro</strong>
            </div>
            <div class="card-body">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Centro</th>
                    <th>Ofertas</th>
                    <th>Matriculados</th>
                    <th>Certificados</th>
                  </tr>
                </thead>
                <tbody>
                  ${stats.porCentro.map(c => `
                    <tr>
                      <td>${c.centro}</td>
                      <td>${c.ofertas}</td>
                      <td>${c.matriculados}</td>
                      <td>${c.certificados}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="mt-4 text-center">
                <div id="chartCentroFormacion" class="d-inline-block"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  imprimirGraficaCentros(filteredData);
});

// ===== CALCULAR ESTADÍSTICAS =====
function calculateStats() {
  const totalMatriculados = filteredData.reduce((sum, row) => sum + (parseInt(row.MATRICULADOS) || 0), 0);
  const totalCertificados = filteredData.reduce((sum, row) => sum + (parseInt(row.CERTIFICADOS) || 0), 0);
  const tasaExito = totalMatriculados > 0 ? ((totalCertificados / totalMatriculados) * 100).toFixed(1) : 0;

  const centros = {};
  filteredData.forEach(row => {
    const centro = row.NOMBRE_CENTRO || 'Sin centro';
    if (!centros[centro]) {
      centros[centro] = { ofertas: 0, matriculados: 0, certificados: 0 };
    }
    centros[centro].ofertas++;
    centros[centro].matriculados += parseInt(row.MATRICULADOS) || 0;
    centros[centro].certificados += parseInt(row.CERTIFICADOS) || 0;
  });

  const porCentro = Object.keys(centros).map(centro => ({
    centro,
    ...centros[centro]
  }));

  return { totalMatriculados, totalCertificados, tasaExito, porCentro };
}

// ===== CARGAR DATOS DE EJEMPLO =====
document.getElementById('loadSampleData').addEventListener('click', () => {
  const sampleData = generateSampleData();
  const result = addDataWithoutDuplicates(sampleData);
  
  saveDataToMemory();
  populateFilters();
  currentPage = 1;
  currentPageActive = 1;
  currentPageClosed = 1;
  renderTable();
  updateStats();
  
  showSuccessModal(result);
});

// ===== BORRAR TODOS LOS DATOS =====
document.getElementById('clearAllData').addEventListener('click', () => {
  if (confirm('¿Estás seguro de que quieres borrar TODOS los datos? Esta acción no se puede deshacer.')) {
    allData = [];
    filteredData = [];
    sessionStorage.removeItem('senaOfertaData');
    sessionStorage.removeItem('senaOfertaLastUpdate');
    
    populateFilters();
    renderTable();
    updateStats();
    
    alert('✓ Todos los datos han sido borrados');
  }
});

// ===== GENERAR DATOS DE EJEMPLO =====
function generateSampleData() {
  const regionales = ['RISARALDA', 'CALDAS', 'QUINDIO'];
  const centros = [
    'Centro de Comercio y Servicios',
    'Centro de Diseño e Innovación Tecnológica Industrial',
    'Centro Atención Sector Agropecuario'
  ];
  const programas = [
    'Tecnólogo en Análisis y Desarrollo de Software',
    'Técnico en Sistemas',
    'Tecnólogo en Gestión Logística',
    'Técnico en Contabilidad y Finanzas',
    'Tecnólogo en Gestión Administrativa',
    'Técnico en Cocina',
    'Tecnólogo en Gestión de Mercados',
    'Técnico en Diseño Gráfico',
    'Tecnólogo en Producción Agrícola',
    'Técnico en Mantenimiento de Equipos de Cómputo'
  ];
  const niveles = ['TECNÓLOGO', 'TÉCNICO', 'ESPECIALIZACIÓN TECNOLÓGICA'];
  const modalidades = ['PRESENCIAL', 'VIRTUAL', 'MIXTA'];
  const estados = ['EN EJECUCIÓN', 'CERRADA', 'POR INICIAR'];
  const municipios = ['PEREIRA', 'DOSQUEBRADAS', 'LA VIRGINIA', 'SANTA ROSA DE CABAL', 'MARSELLA'];
  const jornadas = ['DIURNA', 'NOCTURNA', 'MIXTA', 'FINES DE SEMANA'];

  const data = [];
  const currentYear = 2025;
  let fichaCounter = 2840000;

  for (let i = 0; i < 50; i++) {
    const regional = regionales[Math.floor(Math.random() * regionales.length)];
    const centro = centros[Math.floor(Math.random() * centros.length)];
    const programa = programas[Math.floor(Math.random() * programas.length)];
    const nivel = niveles[Math.floor(Math.random() * niveles.length)];
    const modalidad = modalidades[Math.floor(Math.random() * modalidades.length)];
    const estado = estados[Math.floor(Math.random() * estados.length)];
    const municipio = municipios[Math.floor(Math.random() * municipios.length)];
    const jornada = jornadas[Math.floor(Math.random() * jornadas.length)];
    
    const inscritos = Math.floor(Math.random() * 50) + 20;
    const matriculados = Math.floor(inscritos * (0.8 + Math.random() * 0.2));
    const enFormacion = estado === 'EN EJECUCIÓN' ? Math.floor(matriculados * (0.7 + Math.random() * 0.3)) : 0;
    const certificados = estado === 'CERRADA' ? Math.floor(matriculados * (0.6 + Math.random() * 0.3)) : 0;
    const retiros = estado === 'CERRADA' ? matriculados - certificados : Math.floor(matriculados * 0.1);
    
    const mesInicio = Math.floor(Math.random() * 12) + 1;
    const año = currentYear - Math.floor(Math.random() * 3);
    const fechaInicio = `${año}-${String(mesInicio).padStart(2, '0')}-15`;
    
    let fechaFin = '';
    const mesesDuracion = nivel === 'TECNÓLOGO' ? 24 : 12;
    if (estado === 'CERRADA') {
      const mesFin = (mesInicio + mesesDuracion) % 12 || 12;
      const añoFin = año + Math.floor((mesInicio + mesesDuracion) / 12);
      fechaFin = `${añoFin}-${String(mesFin).padStart(2, '0')}-15`;
    }

    data.push({
      CODIGO_REGIONAL: `R${regionales.indexOf(regional) + 1}`,
      NOMBRE_REGIONAL: regional,
      CODIGO_CENTRO: `C${centros.indexOf(centro) + 1}`,
      NOMBRE_CENTRO: centro,
      DATOS_CENTRO: `${centro} - ${municipio}`,
      CODIGO_PROGRAMA_FORMACION: `P${Math.floor(Math.random() * 9000) + 1000}`,
      PROGRAMA_FORMACION: programa,
      VERSION_PROGRAMA: `V${Math.floor(Math.random() * 5) + 1}`,
      TIPO_PROGRAMA: 'FORMACIÓN TITULADA',
      NIVEL_FORMACION: nivel,
      JORNADA: jornada,
      ID_MUNICIPIO: municipios.indexOf(municipio) + 1,
      MUNICIPIO: municipio,
      FIC_MOD_FORMACION: modalidad.substring(0, 3),
      MODALIDAD_FORMACION: modalidad,
      FICHA: fichaCounter + i,
      FECHA_INICIO: fechaInicio,
      FECHA_FIN: fechaFin,
      MESES_DURACION: mesesDuracion,
      DURACION_PROGRAMA: `${mesesDuracion} MESES`,
      ESTADO_FICHA: estado,
      CODIGO_PROGRAMA_ESPECIAL: '',
      NOMBRE_PROGRAMA_ESPECIAL: '',
      INSCRITOS: inscritos,
      MATRICULADOS: matriculados,
      EN_TRANSITO: Math.floor(Math.random() * 5),
      FORMACION: enFormacion,
      INDUCCION: estado === 'POR INICIAR' ? matriculados : 0,
      CONDICIONADOS: Math.floor(Math.random() * 3),
      APLAZADOS: Math.floor(Math.random() * 2),
      RETIROS_VOLUNTARIOS: Math.floor(retiros * 0.6),
      CANCELADOS: Math.floor(retiros * 0.2),
      REPROBADOS: Math.floor(retiros * 0.2),
      NO_APTOS: Math.floor(Math.random() * 2),
      REINGRESADO: Math.floor(Math.random() * 3),
      POR_CERTIFICAR: estado === 'CERRADA' ? 0 : Math.floor(enFormacion * 0.1),
      CERTIFICADOS: certificados,
      TRASLADADOS: Math.floor(Math.random() * 2)
    });
  }

  return data;
}

// ===== MOSTRAR MODAL DE ÉXITO =====
function showSuccessModal(result) {
  const { totalInFile, addedCount, duplicateCount, exceededCount, totalInSystem } = result;
  
  // Actualizar números en el modal
  document.getElementById('modalNewRecords').textContent = addedCount;
  document.getElementById('modalDuplicates').textContent = duplicateCount;
  document.getElementById('modalTotalRecords').textContent = totalInSystem;
  
  // Actualizar icono y título según el resultado
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
    // Todos los registros fueron agregados
    modalIcon.className = 'fas fa-check-circle';
    modalTitle.textContent = '¡Carga Exitosa!';
    modalSubtitle.textContent = 'Todos los registros se agregaron correctamente';
    modalDescription.textContent = `Se procesaron ${totalInFile} registros del archivo`;
    
    document.getElementById('alertSuccess').classList.remove('d-none');
    document.getElementById('successMessage').textContent = `${addedCount} registro(s) nuevo(s) agregado(s) al sistema`;
    document.getElementById('alertInfo').classList.remove('d-none');
    
  } else if (duplicateCount > 0 && addedCount > 0 && (!exceededCount || exceededCount === 0)) {
    // Algunos duplicados encontrados
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
    // Todos son duplicados
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
    modalSubtitle.textContent = 'Algunos registros no se agregaron por límite máximo';
    modalDescription.textContent = `Se intentaron agregar ${totalInFile} registros, pero ${exceededCount} superan el máximo permitido (${MAX_RECORDS}).`;
    if (alertDangerEl) {
      alertDangerEl.classList.remove('d-none');
      const dangerMessage = document.getElementById('dangerMessage');
      if (dangerMessage) dangerMessage.textContent = `${exceededCount} registro(s) rechazado(s) por superar el límite máximo (${MAX_RECORDS}).`;
    }
    document.getElementById('alertInfo').classList.remove('d-none');
    if (addedCount > 0) {
      document.getElementById('alertSuccess').classList.remove('d-none');
      document.getElementById('successMessage').textContent = `${addedCount} registro(s) nuevo(s) agregado(s)`;
    }
  }
  
  // Mostrar el modal
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

// ===== INICIALIZACIÓN =====
if (allData.length > 0) {
  populateFilters();
  renderTable();
  updateStats();
}
async function loadFromAPI(getter, ...args){
  try{
    const res = await getter(...args);
    console.log('[Historico][API Raw Response]', { endpoint: getter?.name, args, res });
    const data = extractArrayPayload(res);
    console.log('[Historico][API Extracted Array]', Array.isArray(data) ? { length: data.length, sample: data.slice(0, 5) } : { data });
    if(!Array.isArray(data) || data.length === 0){
      console.warn('[Historico] Respuesta vacía, se mantiene la tabla actual');
      renderPagination();
      return;
    }
    allData = data.map(r => ({
      CODIGO_REGIONAL: String(r.cod_regional || ''),
      NOMBRE_REGIONAL: r.nombre_regional || '',
      CODIGO_CENTRO: String(r.cod_centro || ''),
      NOMBRE_CENTRO: r.nombre_centro || String(r.cod_centro || ''),
      CODIGO_PROGRAMA: String(r.cod_programa || ''),
      PROGRAMA_FORMACION: r.programa_formacion || String(r.cod_programa || ''),
      NIVEL_FORMACION: r.nivel_formacion || '',
      MODALIDAD_FORMACION: r.modalidad || '',
      JORNADA: r.jornada || '',
      ETAPA_FICHA: r.etapa_ficha || '',
      FICHA: r.ficha || '',
      FECHA_INICIO: r.fecha_inicio || '',
      FECHA_FIN: r.fecha_fin || '',
      ESTADO_FICHA: r.estado_curso || '',
      CODIGO_MUNICIPIO: String(r.cod_municipio || ''),
      CODIGO_ESTRATEGIA: String(r.cod_estrategia || ''),
      CUPO_ASIGNADO: r.cupo_asignado ?? '',
      HISTORICO: r.id_historico ?? r.historico ?? '',
      CODIGO_FICHA_RELACIONADO: String(r.cod_ficha_relacionado ?? r.id_grupo ?? ''),
      MATRICULADOS: r.num_aprendices_matriculados ?? r.num_aprendices_activos ?? 0,
      ACTIVOS: r.num_aprendices_activos ?? 0,
      INSCRITOS: r.num_aprendices_inscritos ?? 0,
      EN_TRANSITO: r.num_aprendices_en_transito ?? 0,
      FORMACION: r.num_aprendices_formacion ?? 0,
      INDUCCION: r.num_aprendices_induccion ?? 0,
      CONDICIONADOS: r.num_aprendices_condicionados ?? 0,
      APLAZADOS: r.num_aprendices_aplazados ?? 0,
      RETIROS_VOLUNTARIOS: r.num_aprendices_retirado_voluntario ?? 0,
      CANCELADOS: r.num_aprendices_cancelados ?? 0,
      REPROBADOS: r.num_aprendices_reprobados ?? 0,
      NO_APTOS: r.num_aprendices_no_aptos ?? 0,
      REINGRESADO: r.num_aprendices_reingresados ?? 0,
      POR_CERTIFICAR: r.num_aprendices_por_certificar ?? 0,
      CERTIFICADOS: r.num_aprendices_certificados ?? 0,
      TRASLADADOS: r.num_aprendices_trasladados ?? 0
    }));
    console.log('[Historico][Mapped allData]', { length: allData.length, sample: allData.slice(0, 5) });
    filteredData = [...allData];
    rebuildIndex();
    saveDataToMemory();
    populateFilters();
    currentPage = 1;
    currentPageActive = 1;
    currentPageClosed = 1;
    renderTable();
    updateStats();
  }catch(err){
    tableBody.innerHTML = `
      <tr>
        <td colspan="33" class="text-center text-danger py-5">
          <i class="fas fa-exclamation-triangle fa-3x mb-3 d-block"></i>
          <p>Error al cargar datos desde la API</p>
        </td>
      </tr>`;
    renderActiveTable();
    renderClosedTable();
    renderPagination();
  }
}
async function fetchHistoricoTodos(){
  await loadFromAPI(panelService.getHistorico);
}
async function fetchHistoricoPorCentro(cod){
  await loadFromAPI(panelService.porCodCentro, cod);
}
async function fetchHistoricoPorPrograma(cod){
  await loadFromAPI(panelService.porCodPrograma, cod);
}
async function fetchHistoricoPorFicha(ficha){
  await loadFromAPI(panelService.porFicha, ficha);
}
async function fetchHistoricoPorJornada(jornada){
  await loadFromAPI(panelService.porJornada, jornada);
}
async function fetchHistoricoPorMunicipio(cod){
  await loadFromAPI(panelService.porCodMunicipio, cod);
}
fetchHistoricoTodos();
export { fetchHistoricoTodos, fetchHistoricoPorCentro, fetchHistoricoPorPrograma, fetchHistoricoPorFicha, fetchHistoricoPorJornada, fetchHistoricoPorMunicipio };

function imprimirGraficaCentros(data){
  const totalsByCode = new Map();
  const nameByCode = new Map();
  (Array.isArray(data) ? data : []).forEach(r => {
    const code = String(r.CODIGO_CENTRO || r.cod_centro || '').trim() || null;
    const name = (r.NOMBRE_CENTRO || r.nombre_centro || '').trim();
    const key = code || name || 'Sin Centro';
    const val = parseInt(r.MATRICULADOS) || 0;
    totalsByCode.set(key, (totalsByCode.get(key) || 0) + val);
    if (!nameByCode.has(key)) nameByCode.set(key, name);
  });
  const entries = Array.from(totalsByCode.entries()).sort((a,b) => b[1]-a[1]).slice(0,5);
  const labels = entries.map(([key]) => {
    const nm = nameByCode.get(key) || '';
    return nm && key ? `${nm} (${key})` : (nm || key || 'Centro');
  });
  const series = entries.map(([,val]) => val);
  const uniqueCentersCount = totalsByCode.size || 0;
  const options = {
    series: series.length ? series : [10, 8, 6, 4, 2],
    chart: { width: 640, type: 'pie' },
    labels: labels.length ? labels : ['Centro A','Centro B','Centro C','Centro D','Centro E'],
    title: { text: `Top ${uniqueCentersCount} centros identificados`, align: 'center' },
    responsive: [{ breakpoint: 480, options: { chart: { width: 260 }, legend: { position: 'bottom' } } }]
  };
  const el = document.querySelector('#chartCentroFormacion');
  if (!el) return;
  el.innerHTML = '';
  const chart = new ApexCharts(el, options);
  chart.render();
}

function getActiveOffers(){
  return filteredData.filter(row => {
    const estado = normalizeText(row.ESTADO_FICHA);
    return estado.includes('ejecucion') || estado.includes('activa') || estado.includes('en curso');
  });
}
function getClosedOffers(){
  return filteredData.filter(row => {
    const estado = normalizeText(row.ESTADO_FICHA);
    return estado.includes('cerrada') || estado.includes('terminada') || estado.includes('finalizada') || estado.includes('finalizado') || estado.includes('cerrado');
  });
}

function renderActivePagination(total){
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPageActive > totalPages) currentPageActive = totalPages;
  const info = document.getElementById('pageInfoActive');
  if (info) info.textContent = `Página ${currentPageActive} de ${totalPages}`;
  const prev = document.getElementById('btnPrevPageActive');
  const next = document.getElementById('btnNextPageActive');
  if (prev) prev.disabled = currentPageActive <= 1;
  if (next) next.disabled = currentPageActive >= totalPages;
}
function renderClosedPagination(total){
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPageClosed > totalPages) currentPageClosed = totalPages;
  const info = document.getElementById('pageInfoClosed');
  if (info) info.textContent = `Página ${currentPageClosed} de ${totalPages}`;
  const prev = document.getElementById('btnPrevPageClosed');
  const next = document.getElementById('btnNextPageClosed');
  if (prev) prev.disabled = currentPageClosed <= 1;
  if (next) next.disabled = currentPageClosed >= totalPages;
}

document.getElementById('btnPrevPageActive')?.addEventListener('click', () => {
  if (currentPageActive > 1){
    currentPageActive--;
    renderActiveTable();
  }
});
document.getElementById('btnNextPageActive')?.addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(getActiveOffers().length / PAGE_SIZE));
  if (currentPageActive < totalPages){
    currentPageActive++;
    renderActiveTable();
  }
});
document.getElementById('btnPrevPageClosed')?.addEventListener('click', () => {
  if (currentPageClosed > 1){
    currentPageClosed--;
    renderClosedTable();
  }
});
document.getElementById('btnNextPageClosed')?.addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(getClosedOffers().length / PAGE_SIZE));
  if (currentPageClosed < totalPages){
    currentPageClosed++;
    renderClosedTable();
  }
});

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

function setSelectOptions(selectId, values, currentValue){
  const select = document.getElementById(selectId);
  if (!select) return;
  const prev = currentValue ?? select.value;
  select.innerHTML = '<option value="">Todos</option>';
  values.forEach(v => {
    const option = document.createElement('option');
    option.value = v;
    option.textContent = v;
    select.appendChild(option);
  });
  if (prev && values.includes(prev)) select.value = prev; else select.value = '';
}
function updateDependentFilters(){
  const selectedRegional = document.getElementById('filterRegional')?.value || '';
  const selectedCentro = document.getElementById('filterCentro')?.value || '';
  const selectedPrograma = document.getElementById('filterPrograma')?.value || '';
  const selectedNivel = document.getElementById('filterNivel')?.value || '';
  const selectedModalidad = document.getElementById('filterModalidad')?.value || '';
  const selectedJornada = document.getElementById('filterJornada')?.value || '';
  const selectedEstado = document.getElementById('filterEstado')?.value || '';
  const selectedEstrategia = document.getElementById('filterEstrategia')?.value || '';
  const selectedMunicipio = document.getElementById('filterMunicipio')?.value || '';
  let subset = allData;
  if (selectedRegional) subset = subset.filter(r => r.NOMBRE_REGIONAL === selectedRegional);
  if (selectedCentro) subset = subset.filter(r => r.NOMBRE_CENTRO === selectedCentro);
  if (selectedPrograma) subset = subset.filter(r => r.PROGRAMA_FORMACION === selectedPrograma);
  if (selectedNivel) subset = subset.filter(r => r.NIVEL_FORMACION === selectedNivel);
  if (selectedModalidad) subset = subset.filter(r => r.MODALIDAD_FORMACION === selectedModalidad);
  if (selectedJornada) subset = subset.filter(r => r.JORNADA === selectedJornada);
  if (selectedEstado) subset = subset.filter(r => r.ESTADO_FICHA === selectedEstado);
  if (selectedEstrategia) subset = subset.filter(r => r.CODIGO_ESTRATEGIA === selectedEstrategia);
  if (selectedMunicipio) subset = subset.filter(r => r.MUNICIPIO === selectedMunicipio);
  const centers = [...new Set(subset.map(r => r.NOMBRE_CENTRO).filter(Boolean))].sort();
  const programs = [...new Set(subset.map(r => r.PROGRAMA_FORMACION).filter(Boolean))].sort();
  const niveles = [...new Set(subset.map(r => r.NIVEL_FORMACION).filter(Boolean))].sort();
  const modalidades = [...new Set(subset.map(r => r.MODALIDAD_FORMACION).filter(Boolean))].sort();
  const jornadas = [...new Set(subset.map(r => r.JORNADA).filter(Boolean))].sort();
  const estados = [...new Set(subset.map(r => r.ESTADO_FICHA).filter(Boolean))].sort();
  const estrategias = [...new Set(subset.map(r => r.CODIGO_ESTRATEGIA).filter(Boolean))].sort();
  const municipios = [...new Set(subset.map(r => r.MUNICIPIO).filter(Boolean))].sort();
  setSelectOptions('filterCentro', centers);
  setSelectOptions('filterPrograma', programs);
  setSelectOptions('filterNivel', niveles);
  setSelectOptions('filterModalidad', modalidades);
  setSelectOptions('filterJornada', jornadas);
  setSelectOptions('filterEstado', estados);
  setSelectOptions('filterEstrategia', estrategias);
  setSelectOptions('filterMunicipio', municipios);
}
document.getElementById('filterRegional')?.addEventListener('change', () => {
  updateDependentFilters();
});
document.getElementById('filterCentro')?.addEventListener('change', () => {
  updateDependentFilters();
});
['filterPrograma','filterNivel','filterModalidad','filterJornada','filterEstado','filterEstrategia','filterMunicipio'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', () => {
    updateDependentFilters();
  });
});
