# Integración con Backend - Estado de Normas

## Resumen de Cambios

Se ha implementado la integración del módulo "Estado de Normas" con el backend FastAPI para sincronizar la carga de archivos Excel.

## Configuración

### Endpoint del Backend
- **URL**: `https://oferta-production-44e9.up.railway.app/cargar_archivos/cargar-archivos`
- **Método**: POST
- **Tipo de contenido**: multipart/form-data

## Archivos Modificados/Creados

### 1. Nuevo Servicio: `js/api/estado-normas.service.js`
Servicio encargado de manejar la comunicación con el backend para la carga de archivos de estado de normas.

**Funciones principales:**
- `uploadEstadoNormas(file)` - Sube el archivo Excel al backend
- `getUploadHistory()` - Obtiene el historial de cargas (si disponible en backend)
- `saveUploadInfo(uploadInfo)` - Guarda información de la carga en localStorage
- `getLastUploadInfo()` - Obtiene la última información de carga almacenada

**Ejemplo de uso:**
```javascript
import { estadoNormasService } from '../api/estado-normas.service.js';

// Subir archivo
const response = await estadoNormasService.uploadEstadoNormas(file);

// Guardar información
estadoNormasService.saveUploadInfo({
  fileName: file.name,
  fileSize: file.size,
  timestamp: new Date()
});
```

### 2. Modificación: `js/pages/estado_normas.js`
Se ha integrado el servicio para sincronizar archivos con el backend.

**Cambios realizados:**
- Importación del servicio `estadoNormasService`
- Nueva función `uploadFileToBackend(file, processingResult)` que:
  - Envía el archivo al backend después de procesarlo localmente
  - Guarda información de carga en localStorage
  - Maneja errores sin afectar el funcionamiento local
  - Registra logs en la consola del navegador

**Flujo de procesamiento:**
1. Usuario carga archivo Excel
2. Sistema procesa el archivo localmente (lectura, validación, detección de duplicados)
3. Se actualiza la interfaz y se guardan datos en sessionStorage
4. Se envía el archivo al backend de forma asincrónica
5. Se muestra un modal de éxito local (independiente del resultado del backend)
6. Se registra la carga en localStorage

### 3. Nuevo Script de Prueba: `js/api/test-connection.js`
Script para verificar la conexión con el backend desde la consola del navegador.

**Funciones disponibles:**
- `testBackendConnection()` - Prueba el endpoint específico de carga
- `checkAPIHealth()` - Verifica la disponibilidad general del servidor
- `runAllTests()` - Ejecuta todas las pruebas

## Cómo Probar la Conexión

### Opción 1: Desde la consola del navegador
1. Abre la consola de desarrollador (F12 o Ctrl+Shift+I)
2. Ejecuta: `runAllTests()`
3. Observa los logs de la prueba

### Opción 2: Cargar el script de prueba en el HTML
Añade esta línea en el HTML (opcional, para facilitar pruebas):
```html
<script src="js/api/test-connection.js"></script>
```

Luego ejecuta en la consola: `runAllTests()`

## Manejo de Errores

El sistema está diseñado para ser robusto:

1. **Si el backend no está disponible:**
   - El archivo se procesa localmente correctamente
   - Se registra un warning en la consola
   - No afecta la experiencia del usuario
   - Los datos se guardan en sessionStorage

2. **Si hay problemas de autenticación (401/403):**
   - Se registra el error en consola
   - Se sugiere verificar el token
   - El archivo sigue procesándose localmente

3. **Si hay otros errores:**
   - Se registran en consola con detalles
   - El usuario puede reintentar
   - Los datos locales se mantienen

## Información de Carga Almacenada

Cuando se sube un archivo exitosamente, se guarda información en localStorage bajo la clave `last_estado_normas_upload`:

```javascript
{
  fileName: "estado_normas.xlsx",
  fileSize: 102400,
  timestamp: "2025-12-11T14:30:00.000Z",
  processingResult: {
    totalInFile: 100,
    addedCount: 95,
    duplicateCount: 5,
    exceededCount: 0,
    totalInSystem: 500
  },
  backendResponse: { /* respuesta del servidor */ }
}
```

## Requisitos

1. **Token de autenticación:** Se envía automáticamente desde localStorage
2. **Formato de archivo:** Solo Excel (.xlsx o .xls)
3. **Conexión HTTPS:** El backend usa HTTPS (obligatorio)

## Logs Disponibles

La aplicación genera logs detallados en la consola del navegador:

```
✓ Archivo subido exitosamente al backend
✗ Error al enviar archivo al backend
```

## Próximos Pasos (Opcionales)

Para mejorar aún más la integración:

1. Implementar endpoint en backend para obtener historial de cargas
2. Agregar indicador visual de estado de sincronización
3. Implementar sincronización automática periódica
4. Agregar estadísticas de cargas por usuario
5. Implementar descarga de archivos cargados desde el backend

## Compatibilidad

- ✓ Navegadores modernos (Chrome, Firefox, Safari, Edge)
- ✓ HTTPS obligatorio
- ✓ Requiere cookies habilitadas
- ✓ Requiere JavaScript habilitado

## Soporte

Para problemas de conexión:
1. Verificar disponibilidad del servidor: https://oferta-production-44e9.up.railway.app
2. Verificar token en localStorage desde consola: `localStorage.getItem('access_token')`
3. Revisar logs en consola del navegador (F12)
4. Verificar CORS en el servidor (si es necesario)
