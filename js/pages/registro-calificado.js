import { registroCalificadoService } from '../api/panel.service.js';


localStorage.clear();

// ===== VARIABLES GLOBALES =====
let allData = [];
let filteredData = [];
const PAGE_SIZE = 50;
let currentPage = 1;

// Leer encabezados directamente del HTML para que siempre coincidan
function getHEADERS() {
    return Array.from(document.querySelectorAll('#tablaRegistro thead th')).map(th => th.textContent.trim());
}

// Normalizar texto: mayúsculas, sin tildes, sin puntos dobles, espacios simples
function normalize(txt) {
    return String(txt || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
        .replace(/\./g, '') // quitar puntos
        .replace(/\s+/g, ' ') // compactar espacios
        .trim()
        .toUpperCase();
}

// Diccionario de sinónimos para robustecer el mapeo de encabezados
const headerAliases = new Map([
    // clave: forma normalizada del archivo, valor: forma normalizada esperada según la tabla
    ['COD DEL PROGRAMA', 'COD DEL PROGRAMA'],
    ['CODIGO DEL PROGRAMA', 'COD DEL PROGRAMA'],
    ['COD DEL PROGRAMA SNIES', 'COD DEL PROGRAMA'],
    ['CODIGO SNIES', 'COD DEL PROGRAMA'],
    ['CÓDIGO SNIES', 'COD DEL PROGRAMA'],
    ['SNIES', 'COD DEL PROGRAMA'],
    ['DIRECCION', 'DIRECCIÓN'],
    ['FECHA DE RESOLUCION', 'FECHA DE RESOLUCIÓN'],
    ['FECHA RESOLUCION', 'FECHA DE RESOLUCIÓN'],
    ['FECHA_RESOLUCION', 'FECHA DE RESOLUCIÓN'],
    ['NUMERO DE RESOLUCION', 'NOMBRE DE RESOLUCIÓN'],
    ['CLASIFICACION PARA TRAMITE', 'CLASIFICACIÓN PARA TRÁMITE'],
    ['CLASIFICACION PARA TRÁMITE', 'CLASIFICACIÓN PARA TRÁMITE'],
    ['CLASIFICACIÓN PARA TRAMITE', 'CLASIFICACIÓN PARA TRÁMITE'],
    ['FECHA DE VENCIMIENTO', 'Fecha de vencimiento'],
]);

function canonicalize(normKey) {
    const key = normKey.toUpperCase();
    return headerAliases.get(key) || key;
}


// ===== INICIALIZAR DATOS =====
// Los datos se cargarán desde la API al inicio
allData = [];
filteredData = [];

// ===== ELEMENTOS DEL DOM =====
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('inputExcel');
const searchAll = document.getElementById('searchAll');
const tableBody = document.getElementById('tableBody');
const totalRecords = document.getElementById('totalRecords');
const filteredRecords = document.getElementById('filteredRecords');
const selTipo = document.getElementById('filterTipo');
const selRadicado = document.getElementById('filterRadicado');
const inputResolucion = document.getElementById('filterResolucion');
const inputSnies = document.getElementById('filterSnies');
const inputVencimiento = document.getElementById('filterVencimiento');
const inputPrograma = document.getElementById('filterPrograma');
const selModalidad = document.getElementById('filterModalidad');
const paginationInfo = document.getElementById('paginationInfo');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');

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
        const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
                    if (!jsonData || jsonData.length === 0) {
                alert('El archivo no contiene datos válidos');
                return;
            }
                    // Mapear columnas del archivo a los encabezados del HTML
                    const HEADERS = getHEADERS();
                    // Construir conjunto de headers del archivo (unión de claves presentes)
                    const fileHeaderSet = new Set();
                    jsonData.slice(0, 20).forEach(row => Object.keys(row).forEach(k => fileHeaderSet.add(k))); // primeras 20 filas bastan
                    const fileHeaders = Array.from(fileHeaderSet);
                    // Mapa: encabezado HTML -> header del archivo que mejor coincide
                    const mapHtmlToFile = new Map();
                    const normalizedFileMap = new Map(); // norm -> original
                    fileHeaders.forEach(h => {
                        const norm = canonicalize(normalize(h));
                        if (!normalizedFileMap.has(norm)) normalizedFileMap.set(norm, h);
                    });
                    HEADERS.forEach(h => {
                        const normH = canonicalize(normalize(h));
                        if (normalizedFileMap.has(normH)) {
                            mapHtmlToFile.set(h, normalizedFileMap.get(normH));
                        } else {
                            // intentar coincidencia por inclusión parcial
                            const candidate = fileHeaders.find(fh => normalize(fh).includes(normH) || normH.includes(normalize(fh)));
                            if (candidate) mapHtmlToFile.set(h, candidate);
                        }
                    });

                    // Transformar filas del archivo a objetos con solo HEADERS del HTML
                            const transformed = jsonData.map(row => {
                        const obj = {};
                        HEADERS.forEach(h => {
                            const sourceKey = mapHtmlToFile.get(h);
                                    let val = sourceKey ? (row[sourceKey] ?? '') : '';
                                    // Normalizar fechas para columnas clave
                                    if (['FECHA DE RESOLUCIÓN','Fecha de vencimiento','FECHA RADICADO'].includes(h)) {
                                        val = normalizeDate(val);
                                    }
                                    obj[h] = val;
                        });
                        return obj;
                    });

                    // Agregar datos evitando duplicados
                    const result = addDataWithoutDuplicates(transformed, HEADERS);
            currentPage = 1;
                          populateFilters();
            renderTable();
            updateStats();
            showSuccessModal(result);
        } catch (error) {
            console.error('Error procesando archivo:', error);
            alert('Error al procesar el archivo Excel. Verifica el formato.');
        }
    };
    reader.readAsArrayBuffer(file);
}

// ===== AGREGAR DATOS SIN DUPLICADOS =====
function addDataWithoutDuplicates(newData, HEADERS = getHEADERS()) {
    let addedCount = 0;
    let duplicateCount = 0;
    const totalInFile = newData.length;

    newData.forEach(newRow => {
        // Verificar si el registro ya existe (todas las columnas iguales)
        const isDuplicate = allData.some(existingRow => {
            return HEADERS.every(h => (existingRow[h] || '') === (newRow[h] || ''));
        });
        if (isDuplicate) {
            duplicateCount++;
        } else {
            // Solo guardar los campos definidos en HEADERS
            const cleanRow = {};
            HEADERS.forEach(h => { cleanRow[h] = newRow[h] || ''; });
            allData.push(cleanRow);
            addedCount++;
        }
    });

    filteredData = [...allData];

    return {
        totalInFile,
        addedCount,
        duplicateCount,
        totalInSystem: allData.length
    };
}

// ===== MAPEAR RESPUESTA DEL BACKEND A LAS COLUMNAS DE LA TABLA =====
function mapApiDataToTable(apiRows = []) {
    const HEADERS = getHEADERS();
    const canon = (h) => canonicalize(normalize(h));

    return apiRows.map(row => {
        const source = {
            TIPO_TRAMITE: row.tipo_tramite ?? row.tramite ?? '',
            FECHA_RADICADO: normalizeDate(row.fecha_radicado ?? ''),
            NUMERO_RESOLUCION: row.numero_resolucion ?? row.num_resolucion ?? '',
            FECHA_RESOLUCION: normalizeDate(row.fecha_resolucion ?? ''),
            SNIES: row.snies ?? row.codigo_snies ?? row.cod_programa ?? '',
            FECHA_VENCIMIENTO: normalizeDate(row.fecha_vencimiento ?? ''),
            CODIGO_PROGRAMA: row.codigo_programa ?? row.cod_programa ?? '',
            MODALIDAD: row.modalidad ?? row.modalidad_formacion ?? ''
        };

        const mapped = {};
        HEADERS.forEach(header => {
            const key = canon(header);
            switch (key) {
                case canon('TIPO DE TRAMITE'):
                    mapped[header] = source.TIPO_TRAMITE;
                    break;
                case canon('FECHA RADICADO'):
                    mapped[header] = source.FECHA_RADICADO;
                    break;
                case canon('NUMERO DE RESOLUCION'):
                    mapped[header] = source.NUMERO_RESOLUCION;
                    break;
                case canon('FECHA RESOLUCION'):
                    mapped[header] = source.FECHA_RESOLUCION;
                    break;
                case canon('RESUELVE'):
                    mapped[header] = source.RESUELVE;
                    break;
                case canon('SNIES'):
                    mapped[header] = source.SNIES;
                    break;
                case canon('FECHA DE VENCIMIENTO'):
                    mapped[header] = source.FECHA_VENCIMIENTO;
                    break;
                case canon('VIGENCIA RC'):
                    mapped[header] = source.VIGENCIA_RC;
                    break;
                case canon('CODIGO PROGRAMA'):
                    mapped[header] = source.CODIGO_PROGRAMA;
                    break;
                case canon('NOMBRE DEL PROGRAMA'):
                    mapped[header] = source.NOMBRE_PROGRAMA;
                    break;
                case canon('NIVEL DE FORMACION'):
                    mapped[header] = source.NIVEL_FORMACION;
                    break;
                case canon('RED DE CONOCIMIENTO'):
                    mapped[header] = source.RED_CONOCIMIENTO;
                    break;
                case canon('MODALIDAD'):
                    mapped[header] = source.MODALIDAD;
                    break;
                case canon('CENTRO DE FORMACION'):
                    mapped[header] = source.CENTRO_FORMACION;
                    break;
                case canon('NOMBRE SEDE'):
                    mapped[header] = source.NOMBRE_SEDE;
                    break;
                case canon('TIPO SEDE'):
                    mapped[header] = source.TIPO_SEDE;
                    break;
                case canon('MUNICIPIO'):
                    mapped[header] = source.MUNICIPIO;
                    break;
                case canon('LUGAR DE DESARROLLO'):
                    mapped[header] = source.LUGAR_DESARROLLO;
                    break;
                case canon('REGIONAL'):
                    mapped[header] = source.REGIONAL;
                    break;
                case canon('NOMBRE REGIONAL'):
                    mapped[header] = source.NOMBRE_REGIONAL;
                    break;
                case canon('CLASIFICACION TRAMITE'):
                    mapped[header] = source.CLASIFICACION_TRAMITE;
                    break;
                default:
                    mapped[header] = row[header] ?? '';
            }
        });
        return mapped;
    });
}

// ===== Paginación =====
function getTotalPages() {
    return Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
}

function ensureValidPage() {
    const totalPages = getTotalPages();
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
}

function renderPagination() {
    if (!paginationInfo || !prevPageBtn || !nextPageBtn) return;
    ensureValidPage();
    const total = filteredData.length;
    const totalPages = getTotalPages();
    const start = total === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1;
    const end = total === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, total);
    paginationInfo.textContent = `Mostrando ${start}-${end} de ${total}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = total === 0 || currentPage >= totalPages;
}

// ===== RENDERIZAR TABLA PRINCIPAL =====
function renderTable() {
    const HEADERS = getHEADERS();
    tableBody.innerHTML = '';
    ensureValidPage();

    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${HEADERS.length}" class="text-center text-muted py-5">
                    <i class="fas fa-inbox fa-3x mb-3 d-block"></i>
                    <p>No se encontraron resultados</p>
                </td>
            </tr>`;
        renderPagination();
        return;
    }

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredData.slice(startIdx, startIdx + PAGE_SIZE);
    pageRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = HEADERS.map(h => `<td>${row[h] || ''}</td>`).join('');
        tableBody.appendChild(tr);
    });
    renderPagination();
}

// ===== Normalización de fechas =====
function normalizeDate(value) {
    if (value === null || value === undefined) return '';
    let v = String(value).trim();
    if (v === '') return '';
    // Si viene como número serial de Excel
    if (!isNaN(v) && /^\d+$/.test(v)) {
        const serial = parseInt(v, 10);
        const date = excelSerialToDate(serial);
        return formatYMD(date);
    }
    // Reemplazar distintos separadores por '-'
    v = v.replace(/[\.\/]/g, '-');
    // Formatos posibles: YYYY-MM-DD, YYYY-M-D, DD-MM-YYYY, D-M-YYYY
    const parts = v.split('-').map(p => p.padStart(2, '0'));
    if (parts.length === 3) {
        // Detectar si viene YYYY-MM-DD o DD-MM-YYYY
        const [a,b,c] = parts;
        if (a.length === 4) {
            // YYYY-MM-DD
            const d = new Date(`${a}-${b}-${c}`);
            return isNaN(d) ? v : formatYMD(d);
        } else if (c.length === 4) {
            // DD-MM-YYYY -> YYYY-MM-DD
            const d = new Date(`${c}-${b}-${a}`);
            return isNaN(d) ? v : formatYMD(d);
        }
    }
    // Intento final con Date.parse
    const d = new Date(v);
    return isNaN(d) ? v : formatYMD(d);
}

function excelSerialToDate(serial) {
    // Excel serial date (1900-based, con bug del 1900 leap year)
    const utc_days = serial - 25569; // days since 1970-01-01
    const utc_value = utc_days * 86400; // seconds
    const date_info = new Date(utc_value * 1000);
    return new Date(date_info.getUTCFullYear(), date_info.getUTCMonth(), date_info.getUTCDate());
}

function formatYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}/${m}/${d}`; // formato requerido año/mes/día
}

// ===== Filtros de vigencia por Fecha de vencimiento =====
const btnVencidos = document.getElementById('filterVencidos');
const btnPorVencer = document.getElementById('filterPorVencer');
const btnVigentes = document.getElementById('filterVigentes');

function parseYMD(str) {
    if (!str) return null;
    const s = String(str).replace(/[\.\-]/g,'/');
    const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (!m) return null;
    const y = parseInt(m[1],10);
    const mo = parseInt(m[2],10)-1;
    const d = parseInt(m[3],10);
    const dt = new Date(y, mo, d);
    return isNaN(dt) ? null : dt;
}

function applyVigenciaFilter(mode) {
    const today = new Date();
    const in30 = new Date(today.getFullYear(), today.getMonth(), today.getDate()+30);
    const HEADERS = getHEADERS();
    const vencCol = HEADERS.find(h => normalize(h) === normalize('Fecha de vencimiento')) || 'Fecha de vencimiento';
    currentPage = 1;
    filteredData = allData.filter(row => {
        const dt = parseYMD(row[vencCol]);
        if (!dt) return false;
        if (mode === 'vencidos') return dt < new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (mode === 'por-vencer') return dt >= today && dt <= in30;
        if (mode === 'vigentes') return dt > in30;
        return true;
    });
    renderTable();
    updateStats();
}

if (btnVencidos) btnVencidos.addEventListener('click', () => applyVigenciaFilter('vencidos'));
if (btnPorVencer) btnPorVencer.addEventListener('click', () => applyVigenciaFilter('por-vencer'));
if (btnVigentes) btnVigentes.addEventListener('click', () => applyVigenciaFilter('vigentes'));

// ===== Paginación eventos =====
if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage -= 1;
            renderTable();
        }
    });
}

if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
        const totalPages = getTotalPages();
        if (currentPage < totalPages) {
            currentPage += 1;
            renderTable();
        }
    });
}

// ===== ACTUALIZAR ESTADÍSTICAS =====
function updateStats() {
    totalRecords.textContent = allData.length;
    filteredRecords.textContent = filteredData.length;
}

// ===== APLICAR FILTROS =====
document.getElementById('applyFilters').addEventListener('click', () => {
    const HEADERS = getHEADERS();
    const searchAllValue = searchAll.value.toLowerCase();
    const tipo = selTipo?.value || '';
    const radicado = selRadicado?.value || '';
    const resolucion = inputResolucion?.value?.trim() || '';
    const snies = inputSnies?.value?.trim() || '';
    const vencimiento = inputVencimiento?.value || '';
    const programa = inputPrograma?.value?.trim() || '';
    const modalidad = selModalidad?.value || '';
    currentPage = 1;
    filteredData = allData.filter(row => {
        const matchesSearch = !searchAllValue || HEADERS.some(h => String(row[h] || '').toLowerCase().includes(searchAllValue));
        const matchesTipo = !tipo || String(row['TIPO DE TRAMITE'] || '').toLowerCase() === tipo.toLowerCase();
        const matchesRadicado = !radicado || String(row['FECHA RADICADO'] || '') === radicado;
        const matchesResolucion = !resolucion || String(row['NUMERO DE RESOLUCION'] || '').toLowerCase().includes(resolucion.toLowerCase());
        const matchesSnies = !snies || String(row['SNIES'] || '').toLowerCase().includes(snies.toLowerCase());
        const matchesVenc = (() => {
            if (!vencimiento) return true;
            const cutoff = new Date(vencimiento);
            cutoff.setHours(0,0,0,0);
            const rowDate = parseYMD(row['FECHA DE VENCIMIENTO']);
            if (!rowDate) return false;
            return rowDate < cutoff; // solo anteriores a la fecha elegida
        })();
        const matchesPrograma = !programa || String(row['CODIGO PROGRAMA'] || '').toLowerCase().includes(programa.toLowerCase());
        const matchesModalidad = !modalidad || String(row['MODALIDAD'] || '').toLowerCase() === modalidad.toLowerCase();
        return matchesSearch && matchesTipo && matchesRadicado && matchesResolucion && matchesSnies && matchesVenc && matchesPrograma && matchesModalidad;
    });
    renderTable();
    updateStats();
});

// ===== LIMPIAR FILTROS =====
document.getElementById('clearFilters').addEventListener('click', () => {
    searchAll.value = '';
    if (selTipo) selTipo.value = '';
    if (selRadicado) selRadicado.value = '';
    if (inputResolucion) inputResolucion.value = '';
    if (inputSnies) inputSnies.value = '';
    if (inputVencimiento) inputVencimiento.value = '';
    if (inputPrograma) inputPrograma.value = '';
    if (selModalidad) selModalidad.value = '';
    currentPage = 1;
    filteredData = [...allData];
    renderTable();
    updateStats();
});

// ===== EXPORTAR A EXCEL =====
document.getElementById('exportExcel').addEventListener('click', () => {
    const HEADERS = getHEADERS();
    if (filteredData.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(filteredData, { header: HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros Calificados');
    XLSX.writeFile(wb, `RegistrosCalificados_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// ===== BORRAR TODOS LOS DATOS =====
const clearAllBtn = document.getElementById('clearAllData');
if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
        if (confirm('¿Borrar TODOS los registros? Esta acción no se puede deshacer.')) {
            allData = [];
            filteredData = [];
            currentPage = 1;
            renderTable();
            updateStats();
            alert('✓ Todos los datos han sido borrados');
        }
    });
}

// ===== Extraer payload de distintas formas de respuesta =====
function extractApiArray(payload) {
    const candidates = [
        payload,
        payload?.data,
        payload?.data?.data,
        payload?.data?.items,
        payload?.items,
        payload?.results,
        payload?.content,
        payload?.rows,
        payload?.records,
    ];
    return candidates.find(Array.isArray) || [];
}

// ===== CARGAR DESDE BACKEND =====
async function fetchRegistrosCalificados() {
    try {
        console.log('Cargando datos desde la API...');
        const res = await registroCalificadoService.getAll();
        const data = extractApiArray(res);
        if (!Array.isArray(data) || data.length === 0) {
            console.warn('Respuesta sin registros o con formato no esperado', res);
            allData = [];
            filteredData = [];
        } else {
            allData = mapApiDataToTable(data);
            filteredData = [...allData];
            console.log(`✓ ${allData.length} registros cargados desde la API`);
        }
        currentPage = 1;
        populateFilters();
        renderTable();
        updateStats();
    } catch (error) {
        console.error('Error cargando registros calificados desde API:', error);
        allData = [];
        filteredData = [];
        renderTable();
        updateStats();
    }
}

// ===== RENDER INICIAL =====
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar datos desde la API cada vez que se carga la página
    console.log('Página cargada. Iniciando carga de datos desde la API...');
    renderTable();
    updateStats();
    await fetchRegistrosCalificados();
});

// ===== Poblar filtros de manera dinámica =====
function populateFilters() {
    try {
        const tipos = new Set();
        const radicados = new Set();
        const modalidades = new Set();

        // Poblar valores reales desde la base de datos
        allData.forEach(row => {
            if (row['TIPO DE TRAMITE']) tipos.add(String(row['TIPO DE TRAMITE']).trim());
            if (row['FECHA RADICADO']) radicados.add(String(row['FECHA RADICADO']).trim());
            if (row['MODALIDAD']) modalidades.add(String(row['MODALIDAD']).toUpperCase().trim());
        });

        console.log('Filtros poblados:', {
            tipos: Array.from(tipos),
            radicados: Array.from(radicados),
            modalidades: Array.from(modalidades)
        });

        const fill = (selectEl, values) => {
            if (!selectEl) return;
            const sorted = Array.from(values).sort((a,b) => a.localeCompare(b));
            selectEl.innerHTML = '<option value="">Todos</option>' + sorted.map(v => `<option value="${v}">${v}</option>`).join('');
        };

        fill(selTipo, tipos);
        fill(selRadicado, radicados);
        fill(selModalidad, modalidades);
    } catch (e) {
        console.error('Error populating filters', e);
    }
}

// ===== MOSTRAR MODAL DE ÉXITO =====
function showSuccessModal(result) {
    const { totalInFile, addedCount, duplicateCount, totalInSystem } = result;
    document.getElementById('modalNewRecords').textContent = addedCount;
    document.getElementById('modalDuplicates').textContent = duplicateCount;
    document.getElementById('modalTotalRecords').textContent = totalInSystem;
    const alertSuccess = document.getElementById('alertSuccess');
    const alertWarning = document.getElementById('alertWarning');
    const alertInfo = document.getElementById('alertInfo');
    const successMessage = document.getElementById('successMessage');
    const warningMessage = document.getElementById('warningMessage');
    if (alertSuccess) alertSuccess.classList.remove('d-none');
    if (successMessage) successMessage.textContent = `${addedCount} registro(s) nuevo(s) agregado(s) al sistema`;
    if (alertInfo) alertInfo.classList.remove('d-none');
    if (duplicateCount > 0 && alertWarning && warningMessage) {
        alertWarning.classList.remove('d-none');
        warningMessage.textContent = `${duplicateCount} registro(s) duplicado(s) no se agregaron (ya existen en el sistema)`;
    } else if (alertWarning) {
        alertWarning.classList.add('d-none');
    }
    document.getElementById('successModal').style.display = 'flex';
}

// ===== CERRAR MODAL =====
window.closeSuccessModal = function() {
    document.getElementById('successModal').style.display = 'none';
};
