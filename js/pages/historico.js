import { panelService } from '../api/panel.service.js';
// ===== VARIABLES GLOBALES =====
let allData = [];
let filteredData = [];

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
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      
      if (!jsonData || jsonData.length === 0) {
        alert('El archivo no contiene datos válidos');
        return;
      }

      // Detectar duplicados
      const result = addDataWithoutDuplicates(jsonData);
      
      saveDataToMemory();
      
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
function addDataWithoutDuplicates(newData) {
  let addedCount = 0;
  let duplicateCount = 0;
  const totalInFile = newData.length;

  newData.forEach(newRow => {
    // Verificar si el registro ya existe
    const isDuplicate = allData.some(existingRow => {
      // Comparar por FICHA (número de ficha) como identificador único
      // Si FICHA existe en ambos registros, comparar por FICHA
      if (newRow.FICHA && existingRow.FICHA) {
        return String(newRow.FICHA).trim() === String(existingRow.FICHA).trim();
      }
      
      // Si no hay FICHA, comparar por combinación de campos clave
      const keysMatch = 
        String(newRow.PROGRAMA_FORMACION || '').trim() === String(existingRow.PROGRAMA_FORMACION || '').trim() &&
        String(newRow.NOMBRE_CENTRO || '').trim() === String(existingRow.NOMBRE_CENTRO || '').trim() &&
        String(newRow.FECHA_INICIO || '').trim() === String(existingRow.FECHA_INICIO || '').trim() &&
        String(newRow.MODALIDAD_FORMACION || '').trim() === String(existingRow.MODALIDAD_FORMACION || '').trim();
      
      return keysMatch;
    });

    if (isDuplicate) {
      duplicateCount++;
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
    totalInSystem: allData.length
  };
}

// ===== POBLAR FILTROS DINÁMICAMENTE =====
function populateFilters() {
  const filters = {
    filterRegional: 'NOMBRE_REGIONAL',
    filterCentro: 'NOMBRE_CENTRO',
    filterPrograma: 'PROGRAMA_FORMACION',
    filterNivel: 'NIVEL_FORMACION',
    filterModalidad: 'MODALIDAD_FORMACION',
    filterEstado: 'ESTADO_FICHA',
    filterMunicipio: 'MUNICIPIO'
  };

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
}

// ===== RENDERIZAR TABLA PRINCIPAL =====
function renderTable() {
  tableBody.innerHTML = '';

  if (filteredData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="11" class="text-center text-muted py-5">
          <i class="fas fa-inbox fa-3x mb-3 d-block"></i>
          <p>No se encontraron resultados</p>
        </td>
      </tr>`;
    return;
  }

  filteredData.forEach(row => {
    const tr = document.createElement('tr');
    const estado = getEstado(row.ESTADO_FICHA);
    
    tr.innerHTML = `
      <td><span class="semaphore ${estado.color}"></span></td>
      <td>${row.NOMBRE_REGIONAL || ''}</td>
      <td>${row.NOMBRE_CENTRO || ''}</td>
      <td>${row.PROGRAMA_FORMACION || ''}</td>
      <td><span class="badge bg-info">${row.NIVEL_FORMACION || ''}</span></td>
      <td>${row.MODALIDAD_FORMACION || ''}</td>
      <td><strong>${row.FICHA || ''}</strong></td>
      <td>${row.FECHA_INICIO || ''}</td>
      <td><span class="badge bg-primary">${row.MATRICULADOS || 0}</span></td>
      <td><span class="badge bg-success">${row.CERTIFICADOS || 0}</span></td>
      <td>${row.MUNICIPIO || ''}</td>
    `;
    tableBody.appendChild(tr);
  });

  renderActiveTable();
  renderClosedTable();
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
  
  const activeOffers = filteredData.filter(row => {
    const estado = row.ESTADO_FICHA?.toLowerCase() || '';
    return estado.includes('ejecucion') || estado.includes('activa');
  });

  if (activeOffers.length === 0) {
    activeTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay ofertas activas</td></tr>';
    return;
  }

  activeOffers.forEach(row => {
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
}

// ===== RENDERIZAR TABLA DE OFERTAS CERRADAS =====
function renderClosedTable() {
  closedTableBody.innerHTML = '';
  
  const closedOffers = filteredData.filter(row => {
    const estado = row.ESTADO_FICHA?.toLowerCase() || '';
    return estado.includes('cerrada') || estado.includes('terminada');
  });

  if (closedOffers.length === 0) {
    closedTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay ofertas cerradas</td></tr>';
    return;
  }

  closedOffers.forEach(row => {
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
  const estado = document.getElementById('filterEstado').value;
  const municipio = document.getElementById('filterMunicipio').value;

  filteredData = allData.filter(row => {
    const matchSearch = !searchAllValue || Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchAllValue)
    );
    const matchRegional = !regional || row.NOMBRE_REGIONAL === regional;
    const matchCentro = !centro || row.NOMBRE_CENTRO === centro;
    const matchPrograma = !programa || row.PROGRAMA_FORMACION === programa;
    const matchNivel = !nivel || row.NIVEL_FORMACION === nivel;
    const matchModalidad = !modalidad || row.MODALIDAD_FORMACION === modalidad;
    const matchEstado = !estado || row.ESTADO_FICHA === estado;
    const matchMunicipio = !municipio || row.MUNICIPIO === municipio;

    return matchSearch && matchRegional && matchCentro && matchPrograma && 
           matchNivel && matchModalidad && matchEstado && matchMunicipio;
  });

  renderTable();
  updateStats();
});

// ===== LIMPIAR FILTROS =====
document.getElementById('clearFilters').addEventListener('click', () => {
  searchAll.value = '';
  document.querySelectorAll('.filter-group select').forEach(select => select.value = '');
  filteredData = [...allData];
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
    <div class="row">
      <div class="col-md-4">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">Total Matriculados</h5>
            <h2 class="text-primary">${stats.totalMatriculados}</h2>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">Total Certificados</h5>
            <h2 class="text-success">${stats.totalCertificados}</h2>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card text-center mb-3">
          <div class="card-body">
            <h5 class="card-title">Tasa de Éxito</h5>
            <h2 class="text-info">${stats.tasaExito}%</h2>
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
      </div>
    </div>
  `;
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
  const { totalInFile, addedCount, duplicateCount, totalInSystem } = result;
  
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
  
  if (duplicateCount === 0 && addedCount > 0) {
    // Todos los registros fueron agregados
    modalIcon.className = 'fas fa-check-circle';
    modalTitle.textContent = '¡Carga Exitosa!';
    modalSubtitle.textContent = 'Todos los registros se agregaron correctamente';
    modalDescription.textContent = `Se procesaron ${totalInFile} registros del archivo`;
    
    document.getElementById('alertSuccess').classList.remove('d-none');
    document.getElementById('successMessage').textContent = `${addedCount} registro(s) nuevo(s) agregado(s) al sistema`;
    document.getElementById('alertInfo').classList.remove('d-none');
    
  } else if (duplicateCount > 0 && addedCount > 0) {
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
    
  } else if (duplicateCount > 0 && addedCount === 0) {
    // Todos son duplicados
    modalIcon.className = 'fas fa-info-circle';
    modalTitle.textContent = 'Sin Cambios';
    modalSubtitle.textContent = 'Todos los registros ya existen';
    modalDescription.textContent = `Se procesaron ${totalInFile} registros del archivo`;
    
    document.getElementById('alertWarning').classList.remove('d-none');
    document.getElementById('warningMessage').textContent = `Los ${duplicateCount} registros del archivo ya existen en el sistema. No se agregaron datos nuevos.`;
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
    const data = Array.isArray(res) ? res : (res && res.data ? res.data : []);
    if(!Array.isArray(data)) return;
    allData = data.map(r => ({
      NOMBRE_REGIONAL: r.nombre_regional || '',
      NOMBRE_CENTRO: String(r.cod_centro || ''),
      PROGRAMA_FORMACION: String(r.cod_programa || ''),
      NIVEL_FORMACION: '',
      MODALIDAD_FORMACION: r.modalidad || '',
      FICHA: r.ficha || '',
      FECHA_INICIO: r.fecha_inicio || '',
      FECHA_FIN: r.fecha_fin || '',
      ESTADO_FICHA: r.estado_curso || '',
      MATRICULADOS: r.num_aprendices_matriculados ?? r.num_aprendices_activos ?? 0,
      CERTIFICADOS: r.num_aprendices_certificados ?? 0,
      MUNICIPIO: String(r.cod_municipio || ''),
      INSCRITOS: r.num_aprendices_inscritos ?? 0,
      EN_TRANSITO: r.num_aprendices_en_transito ?? 0,
      FORMACION: r.num_aprendices_formacion ?? 0,
      INDUCCION: r.num_aprendices_induccion ?? 0
    }));
    filteredData = [...allData];
    saveDataToMemory();
    populateFilters();
    renderTable();
    updateStats();
  }catch(err){
    console.error(err);
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
if(allData.length === 0){
  fetchHistoricoTodos();
}
export { fetchHistoricoTodos, fetchHistoricoPorCentro, fetchHistoricoPorPrograma, fetchHistoricoPorFicha, fetchHistoricoPorJornada, fetchHistoricoPorMunicipio };
