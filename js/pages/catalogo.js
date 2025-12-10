// catalogo.js (versión corregida para filtros robustos)

// ===== UTILIDADES DE NORMALIZACIÓN =====
function normalizeText(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/\s+/g, ' ') // compactar espacios
    .replace(/[_\-\.]/g, ' ') // reemplazar guiones/guiones bajos/puntos por espacio
    .trim()
    .toUpperCase();
}

// ===== VARIABLES GLOBALES =====
let allData = [];
let filteredData = [];
let fileHeaderMap = new Map(); // mapa normalizado -> original del archivo

// ===== ELEMENTOS =====
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('inputExcel');
const searchAll = document.getElementById('searchAll');
const tableBody = document.getElementById('tableBody');
const totalRecords = document.getElementById('totalRecords');
const filteredRecords = document.getElementById('filteredRecords');
const selNivel = document.getElementById('filterNivel');
const selModalidad = document.getElementById('filterModalidad');
const selRed = document.getElementById('filterRed');

// ===== HEADERS VISIBLES (de la tabla) =====
function getHEADERS() {
  return Array.from(document.querySelectorAll('#tablaCatalogo thead th')).map(th => th.textContent.trim());
}

// ===== LOCALSTORAGE =====
function saveData() {
  localStorage.setItem('catalogoProgramas', JSON.stringify(allData));
}
function loadData() {
  const d = localStorage.getItem('catalogoProgramas');
  return d ? JSON.parse(d) : [];
}

// ===== EVENTOS DE CARGA =====
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.style.background = '#e9ecef'; });
uploadZone.addEventListener('dragleave', () => { uploadZone.style.background = '#f8f9fa'; });
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) processFile(file);
});
fileInput.addEventListener('change', e => {
  const file = e.target.files && e.target.files[0];
  if (file) processFile(file);
});

// ===== PROCESAR ARCHIVO (mapeo robusto de columnas) =====
function processFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!json || !json.length) return alert('Archivo vacío o no válido');

      // construir mapa normalizado de encabezados del archivo
      fileHeaderMap = new Map();
      const sampleRow = json[0];
      Object.keys(sampleRow).forEach(orig => {
        fileHeaderMap.set(normalizeText(orig), orig);
      });

      // mapear cada fila a los HEADERS visibles
      const HEADERS = getHEADERS();
      const mappedRows = json.map(row => {
        const out = {};
        HEADERS.forEach(h => {
          const normH = normalizeText(h);
          // Buscar coincidencia exacta en fileHeaderMap
          let sourceKey = fileHeaderMap.get(normH);
          if (!sourceKey) {
            // intentar búsqueda por inclusión (archivo contiene la palabra)
            for (let [normFile, orig] of fileHeaderMap.entries()) {
              if (normFile.includes(normH) || normH.includes(normFile)) {
                sourceKey = orig;
                break;
              }
            }
          }
          // fallback: buscar por nombres comunes (ej. PRF_CODIGO puede venir como PRF CODIGO)
          if (!sourceKey) {
            // si no se encuentra, buscar por coincidencia parcial por token
            for (let [normFile, orig] of fileHeaderMap.entries()) {
              const tokensFile = normFile.split(' ');
              const tokensH = normH.split(' ');
              if (tokensH.some(t => tokensFile.includes(t))) {
                sourceKey = orig;
                break;
              }
            }
          }
          out[h] = sourceKey ? row[sourceKey] : '';
        });
        return out;
      });

      // detectar clave para evitar duplicados (PRF_CODIGO u otros)
      const HEADERS_UP = HEADERS.map(h => normalizeText(h));
      let codigoKey = HEADERS.find(h => normalizeText(h).includes('PRF') && normalizeText(h).includes('COD')) 
                   || HEADERS.find(h => normalizeText(h).includes('CODIGO')) 
                   || HEADERS[0]; // fallback al primero
      // ahora mergear sin duplicados usando el valor de codigoKey
      allData = mergeWithoutDuplicates(allData, mappedRows, codigoKey);
      filteredData = [...allData];
      saveData();
      renderTable();
      populateFilters();
      updateStats();
      showSuccessModal(mappedRows.length, allData.length);
    } catch (err) {
      console.error('Error procesando archivo:', err);
      alert('Error al procesar el archivo. Revisa el formato.');
    }
  };
  // leer como array buffer para XLSX
  reader.readAsArrayBuffer(file);
}

// ===== MERGE SIN DUPLICADOS (usa clave detectada) =====
function mergeWithoutDuplicates(existing, incoming, codigoKey) {
  try {
    const existCodes = new Set(existing.map(r => normalizeText(r[codigoKey] || '')));
    const uniques = incoming.filter(r => {
      const code = normalizeText(r[codigoKey] || '');
      return code && !existCodes.has(code);
    });
    return [...existing, ...uniques];
  } catch (e) {
    console.error('mergeWithoutDuplicates error', e);
    return [...existing, ...incoming];
  }
}

// ===== RENDER TABLA =====
function renderTable() {
  const HEADERS = getHEADERS();
  tableBody.innerHTML = '';
  if (!filteredData || !filteredData.length) {
    tableBody.innerHTML = `<tr><td colspan="${HEADERS.length}" class="text-center text-muted py-5"><i class="fas fa-inbox fa-3x mb-3"></i><p>No se encontraron resultados</p></td></tr>`;
    return;
  }
  filteredData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = HEADERS.map(h => `<td>${(row[h] !== undefined && row[h] !== null) ? row[h] : ''}</td>`).join('');
    tableBody.appendChild(tr);
  });
}

// ===== ESTADÍSTICAS =====
function updateStats() {
  totalRecords.textContent = allData.length;
  filteredRecords.textContent = filteredData.length;
}

// ===== FILTRADO (uso de normalizados) =====
document.getElementById('applyFilters').addEventListener('click', () => {
  const search = normalizeText(searchAll.value);
  const nivel = normalizeText(selNivel.value);
  const modalidad = normalizeText(selModalidad.value);
  const red = normalizeText(selRed.value);
  const HEADERS = getHEADERS();

  filteredData = allData.filter(row => {
    // búsqueda en todos los campos visibles
    const matchesSearch = !search || HEADERS.some(h => normalizeText(row[h]).includes(search));
    // coincidencia exacta de filtro (normalizada)
    const matchesNivel = !nivel || normalizeText(row['NIVEL DE FORMACION'] || row['Nivel de Formación'] || '') === nivel;
    const matchesModalidad = !modalidad || normalizeText(row['Modalidad'] || '') === modalidad;
    const matchesRed = !red || normalizeText(row['Red Tecnológica'] || row['RED TECNOLOGICA'] || row['Red de Conocimiento'] || '') === red;
    return matchesSearch && matchesNivel && matchesModalidad && matchesRed;
  });

  renderTable();
  updateStats();
});

document.getElementById('clearFilters').addEventListener('click', () => {
  searchAll.value = '';
  selNivel.value = '';
  selModalidad.value = '';
  selRed.value = '';
  filteredData = [...allData];
  renderTable();
  updateStats();
});

// ===== EXPORTAR =====
document.getElementById('exportExcel').addEventListener('click', () => {
  const HEADERS = getHEADERS();
  if (!filteredData || !filteredData.length) {
    return alert('No hay datos para exportar');
  }
  const ws = XLSX.utils.json_to_sheet(filteredData, { header: HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CatalogoProgramas');
  XLSX.writeFile(wb, `CatalogoProgramas_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// ===== BORRAR DATOS =====
document.getElementById('clearAllData').addEventListener('click', () => {
  if (!confirm('¿Borrar todos los datos del catálogo?')) return;
  allData = [];
  filteredData = [];
  localStorage.removeItem('catalogoProgramas');
  renderTable();
  updateStats();
});

// ===== MODAL =====
function showSuccessModal(newCount, totalCount) {
  document.getElementById('modalNewRecords').textContent = newCount;
  document.getElementById('modalTotalRecords').textContent = totalCount;
  document.getElementById('modalDuplicates').textContent = Math.max(0, newCount - (totalCount - newCount)); // aproximado
  document.getElementById('successModal').style.display = 'flex';
}
function closeSuccessModal() {
  document.getElementById('successModal').style.display = 'none';
}
window.closeSuccessModal = closeSuccessModal;

// ===== FILTROS DINÁMICOS =====
function populateFilters() {
  const niveles = new Set();
  const modalidades = new Set();
  const redes = new Set();
  allData.forEach(r => {
    // leer con varios posibles nombres para mayor robustez
    const nivel = r['NIVEL DE FORMACION'] ?? r['Nivel de Formación'] ?? r['NIVEL_DE_FORMACION'] ?? '';
    const modalidad = r['Modalidad'] ?? r['MODALIDAD'] ?? '';
    const red = r['Red Tecnológica'] ?? r['RED TECNOLOGICA'] ?? r['Red de Conocimiento'] ?? '';
    if ((nivel || '').toString().trim()) niveles.add(nivel.toString().trim());
    if ((modalidad || '').toString().trim()) modalidades.add(modalidad.toString().trim());
    if ((red || '').toString().trim()) redes.add(red.toString().trim());
  });
  fillSelect(selNivel, niveles);
  fillSelect(selModalidad, modalidades);
  fillSelect(selRed, redes);
}
function fillSelect(select, values) {
  if (!select) return;
  const arr = Array.from(values).sort((a,b) => a.localeCompare(b));
  select.innerHTML = '<option value="">Todos</option>' + arr.map(v => `<option value="${v}">${v}</option>`).join('');
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  allData = loadData();
  filteredData = [...allData];
  renderTable();
  updateStats();
  populateFilters();
});
