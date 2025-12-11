import { catalogoService } from '../api/catalogo.service.js';

// ===== VARIABLES GLOBALES =====
let selectedFile = null;

// ===== ELEMENTOS DEL DOM =====
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const dropZone = document.getElementById('dropZone');
const dropZoneContent = document.getElementById('dropZoneContent');
const btnSelectFile = document.getElementById('btnSelectFile');
const btnRemoveFile = document.getElementById('btnRemoveFile');
const btnUploadFile = document.getElementById('btnUploadFile');

// ===== FUNCIÓN PARA VALIDAR ARCHIVO =====
function validateFile(file) {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ];
  
  if (!validTypes.includes(file.type)) {
    alert('Por favor selecciona un archivo Excel válido (.xlsx o .xls)');
    return false;
  }
  
  // Validar tamaño máximo (10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    alert('El archivo es demasiado grande. Tamaño máximo: 10MB');
    return false;
  }
  
  return true;
}

// ===== FUNCIÓN PARA MOSTRAR ARCHIVO SELECCIONADO =====
function displaySelectedFile(file) {
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  
  // Ocultar zona de drop y mostrar preview
  dropZone.style.display = 'none';
  filePreview.style.display = 'block';
}

// ===== FUNCIÓN PARA LIMPIAR SELECCIÓN =====
function clearSelection() {
  selectedFile = null;
  fileInput.value = '';
  dropZone.style.display = 'flex';
  filePreview.style.display = 'none';
  
  // Ocultar progreso y estado
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadStatus = document.getElementById('uploadStatus');
  uploadProgress.style.display = 'none';
  uploadStatus.style.display = 'none';
}

// ===== EVENTO: CLICK EN BOTÓN SELECCIONAR ARCHIVO =====
btnSelectFile.addEventListener('click', () => {
  fileInput.click();
});

// ===== EVENTO: CLICK EN ZONA DE DROP =====
dropZone.addEventListener('click', (e) => {
  if (e.target !== btnSelectFile && !btnSelectFile.contains(e.target)) {
    fileInput.click();
  }
});

// ===== EVENTO: CAMBIO EN INPUT DE ARCHIVO =====
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file && validateFile(file)) {
    displaySelectedFile(file);
  } else {
    clearSelection();
  }
});

// ===== EVENTO: REMOVER ARCHIVO SELECCIONADO =====
btnRemoveFile.addEventListener('click', () => {
  clearSelection();
});

// ===== EVENTOS DRAG & DROP =====
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    if (validateFile(file)) {
      // Asignar el archivo al input
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      
      displaySelectedFile(file);
    }
  }
});

// ===== EVENTO: SUBIR ARCHIVO =====
btnUploadFile.addEventListener('click', async () => {
  if (!selectedFile) {
    alert('Por favor selecciona un archivo primero');
    return;
  }
  
  await uploadCatalogo();
});

// ===== FUNCIÓN PARA SUBIR EL CATÁLOGO =====
async function uploadCatalogo() {
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const progressPercentage = document.getElementById('progressPercentage');
  const progressText = document.getElementById('progressText');
  const uploadStatus = document.getElementById('uploadStatus');
  const statusMessage = document.getElementById('statusMessage');
  
  try {
    // Deshabilitar botones y mostrar progreso
    btnUploadFile.disabled = true;
    btnRemoveFile.disabled = true;
    btnUploadFile.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Subiendo...';
    uploadProgress.style.display = 'block';
    progressBar.style.width = '50%';
    progressPercentage.textContent = '50%';
    
    // Realizar la petición
    const response = await catalogoService.uploadExcelCatalogo(selectedFile);
    
    // Actualizar progreso a completado
    progressBar.style.width = '100%';
    progressPercentage.textContent = '100%';
    progressBar.classList.remove('progress-bar-animated');
    progressText.innerHTML = '<i class="fas fa-check-circle text-success"></i> ¡Archivo subido exitosamente!';
    
    // Guardar información de la carga
    catalogoService.saveUploadInfo({
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      response: response
    });
    
    // Mostrar modal de éxito
    setTimeout(() => {
      showSuccessModal(response);
      clearSelection();
      loadLastUploadInfo();
    }, 1500);
    
  } catch (error) {
    console.error('Error al subir el catálogo:', error);
    
    // Mostrar mensaje de error
    progressBar.classList.remove('bg-success');
    progressBar.classList.add('bg-danger');
    progressBar.classList.remove('progress-bar-animated');
    progressText.innerHTML = '<i class="fas fa-times-circle text-danger"></i> Error al subir el archivo';
    
    statusMessage.className = 'alert alert-danger';
    statusMessage.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <strong>Error:</strong> ${error.message || 'No se pudo subir el archivo'}
    `;
    uploadStatus.style.display = 'block';
    
  } finally {
    // Restaurar botones
    btnUploadFile.disabled = false;
    btnRemoveFile.disabled = false;
    btnUploadFile.innerHTML = '<i class="fas fa-upload"></i> Subir Archivo';
    
    // Ocultar progreso después de un delay si hubo error
    setTimeout(() => {
      if (progressBar.classList.contains('bg-danger')) {
        uploadProgress.style.display = 'none';
        progressBar.classList.remove('bg-danger');
        progressBar.classList.add('bg-success');
        progressBar.classList.add('progress-bar-animated');
        progressBar.style.width = '0%';
        progressPercentage.textContent = '0%';
        progressText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo archivo...';
      }
    }, 5000);
  }
}

// ===== MOSTRAR MODAL DE ÉXITO =====
function showSuccessModal(response) {
  const modalIcon = document.getElementById('modalIcon');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const modalDescription = document.getElementById('modalDescription');
  
  // Ocultar todas las alertas primero
  document.getElementById('alertSuccess').classList.add('d-none');
  document.getElementById('alertWarning').classList.add('d-none');
  document.getElementById('alertInfo').classList.add('d-none');
  document.getElementById('alertDanger').classList.add('d-none');
  
  // Configurar modal según la respuesta
  modalIcon.className = 'fas fa-check-circle';
  modalTitle.textContent = '¡Catálogo Cargado!';
  modalSubtitle.textContent = 'Carga exitosa';
  modalDescription.textContent = 'El archivo Excel se procesó correctamente';
  
  // Mostrar mensaje de éxito
  document.getElementById('alertSuccess').classList.remove('d-none');
  document.getElementById('successMessage').textContent = response.message || 'El catálogo se cargó exitosamente en el sistema';
  
  document.getElementById('alertInfo').classList.remove('d-none');
  
  // Mostrar el modal
  document.getElementById('successModal').classList.add('show');
}

// ===== CARGAR INFORMACIÓN DE LA ÚLTIMA CARGA =====
async function loadLastUploadInfo() {
  const lastUploadInfo = await catalogoService.getLastUploadInfo();
  const container = document.getElementById('lastUploadInfo');
  
  if (lastUploadInfo) {
    const date = new Date(lastUploadInfo.timestamp);
    const formattedDate = date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    container.innerHTML = `
      <div class="d-flex align-items-start mb-3">
        <div class="flex-shrink-0">
          <i class="fas fa-file-excel text-success fa-2x"></i>
        </div>
        <div class="flex-grow-1 ms-3">
          <h6 class="mb-1"><strong>${lastUploadInfo.fileName}</strong></h6>
          <p class="text-muted small mb-1">
            <i class="fas fa-hdd"></i> ${formatFileSize(lastUploadInfo.fileSize)}
          </p>
          <p class="text-muted small mb-0">
            <i class="fas fa-clock"></i> ${formattedDate}
          </p>
        </div>
      </div>
      <div class="alert alert-success mb-0 small">
        <i class="fas fa-check-circle"></i> Carga completada exitosamente
      </div>
    `;
  }
}

// ===== FUNCIÓN AUXILIAR PARA FORMATEAR TAMAÑO DE ARCHIVO =====
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ===== INICIALIZAR EL MÓDULO =====
async function Init() {
  console.log('Módulo de Catálogo inicializado');
  await loadLastUploadInfo();
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  Init();
});

export { Init };