/**
 * Script para verificar la conexión con el endpoint de carga de archivos del backend
 * Ruta: https://oferta-production-44e9.up.railway.app/cargar_archivos/cargar-archivos
 */

async function testBackendConnection() {
    const baseURL = 'https://oferta-production-44e9.up.railway.app';
    const endpoint = '/cargar_archivos/cargar-archivos';
    const fullURL = `${baseURL}${endpoint}`;

    console.log('=== TEST DE CONEXIÓN CON BACKEND ===');
    console.log(`Endpoint: ${fullURL}`);
    console.log('Método: POST');
    console.log('Tipo de contenido: multipart/form-data (archivo Excel)');
    console.log('---');

    try {
        // Crear un archivo de prueba
        const testFileName = 'test-estado-normas.xlsx';
        const testContent = new Uint8Array([
            0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
            0x08, 0x00, 0x00, 0x00, 0x21, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        
        const blob = new Blob([testContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const file = new File([blob], testFileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Crear FormData
        const formData = new FormData();
        formData.append('file', file);

        // Obtener token de localStorage (si existe)
        const token = localStorage.getItem('access_token');
        console.log(`Token disponible: ${token ? 'Sí (' + token.substring(0, 20) + '...)' : 'No'}`);

        if (!token) {
            console.warn('⚠️ ADVERTENCIA: No hay token. El backend podría rechazar la petición');
        }

        // Realizar la petición
        console.log('\n📤 Enviando petición...');
        const response = await fetch(fullURL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: formData
        });

        console.log(`\n📩 Status: ${response.status} ${response.statusText}`);
        
        // Obtener y mostrar respuesta
        let responseData;
        const contentType = response.headers.get('content-type');
        console.log(`Content-Type: ${contentType}`);

        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            const text = await response.text();
            responseData = { rawResponse: text };
        }

        console.log('\n📄 Respuesta del servidor:');
        console.log(JSON.stringify(responseData, null, 2));

        if (response.ok) {
            console.log('\n✅ Conexión EXITOSA');
            console.log('El endpoint está disponible y respondiendo correctamente');
            return {
                success: true,
                status: response.status,
                response: responseData
            };
        } else {
            console.log('\n❌ Error en la respuesta');
            console.log(`El servidor respondió con status ${response.status}`);
            
            // Proporcionar diagnóstico
            switch(response.status) {
                case 400:
                    console.error('Error 400: Solicitud inválida - Verifica el formato del archivo');
                    break;
                case 401:
                    console.error('Error 401: No autorizado - Token inválido o ausente');
                    break;
                case 403:
                    console.error('Error 403: Prohibido - Verifica permisos');
                    break;
                case 404:
                    console.error('Error 404: Endpoint no encontrado - Verifica la URL');
                    break;
                case 500:
                    console.error('Error 500: Error interno del servidor');
                    break;
            }
            
            return {
                success: false,
                status: response.status,
                response: responseData
            };
        }

    } catch (error) {
        console.error('\n❌ Error de conexión:');
        console.error(error.message);
        console.error('\nPosibles causas:');
        console.error('1. El servidor no está disponible');
        console.error('2. Problema de CORS');
        console.error('3. Conexión de red interrumpida');
        console.error('4. URL incorrecta');
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Función para verificar el estado de la API en general
async function checkAPIHealth() {
    const baseURL = 'https://oferta-production-44e9.up.railway.app';
    
    console.log('\n=== VERIFICACIÓN DE SALUD DE LA API ===');
    console.log(`Base URL: ${baseURL}`);
    
    try {
        // Intentar acceder a la raíz de la API
        const response = await fetch(baseURL, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('✓ Servidor disponible');
        
        return true;
    } catch (error) {
        console.error('✗ Servidor no disponible');
        console.error(`Error: ${error.message}`);
        return false;
    }
}

// Función para obtener información del último upload
function getLastUploadStatus() {
    console.log('\n=== INFORMACIÓN DEL ÚLTIMO UPLOAD ===');
    
    try {
        const uploadInfo = localStorage.getItem('last_estado_normas_upload');
        if (!uploadInfo) {
            console.log('No hay información de uploads anteriores');
            return null;
        }
        
        const info = JSON.parse(uploadInfo);
        console.log('📝 Última carga:');
        console.log(JSON.stringify(info, null, 2));
        return info;
    } catch (error) {
        console.error('Error al obtener información:', error.message);
        return null;
    }
}

// Función para verificar token
function checkToken() {
    console.log('\n=== VERIFICACIÓN DE AUTENTICACIÓN ===');
    
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        console.warn('❌ No hay token de autenticación');
        console.warn('Necesitas iniciar sesión para usar el backend');
        return false;
    }
    
    console.log('✓ Token disponible');
    console.log('Primeros 30 caracteres:', token.substring(0, 30) + '...');
    
    // Intentar decodificar JWT (solo para información)
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log('📋 Información del token:');
            console.log(JSON.stringify(payload, null, 2));
            
            // Verificar si está expirado
            if (payload.exp) {
                const expDate = new Date(payload.exp * 1000);
                const now = new Date();
                if (expDate < now) {
                    console.error('❌ Token expirado desde:', expDate);
                    return false;
                } else {
                    console.log('✓ Token válido hasta:', expDate);
                }
            }
        }
    } catch (e) {
        console.log('No se pudo decodificar el token');
    }
    
    return true;
}

// Ejecutar pruebas completas
async function runAllTests() {
    console.clear();
    console.log('%c════════════════════════════════════════', 'color: blue; font-weight: bold;');
    console.log('%c    SUITE COMPLETA DE DIAGNÓSTICO', 'color: blue; font-weight: bold; font-size: 14px;');
    console.log('%c════════════════════════════════════════', 'color: blue; font-weight: bold;');
    
    // 1. Verificar token
    const hasToken = checkToken();
    
    // 2. Verificar salud general
    const healthOk = await checkAPIHealth();
    
    // 3. Si todo está bien, probar el endpoint específico
    if (healthOk) {
        await testBackendConnection();
    } else {
        console.error('\n❌ No se puede probar el endpoint porque el servidor no está disponible');
    }
    
    // 4. Mostrar información del último upload
    getLastUploadStatus();
    
    console.log('\n%c════════════════════════════════════════', 'color: green; font-weight: bold;');
    console.log('%c    FIN DEL DIAGNÓSTICO', 'color: green; font-weight: bold;');
    console.log('%c════════════════════════════════════════', 'color: green; font-weight: bold;');
}

// Exportar funciones para usar en consola
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testBackendConnection,
        checkAPIHealth,
        getLastUploadStatus,
        checkToken,
        runAllTests
    };
}

// Si se ejecuta directamente en la consola del navegador
if (typeof window !== 'undefined') {
    window.testBackendConnection = testBackendConnection;
    window.checkAPIHealth = checkAPIHealth;
    window.getLastUploadStatus = getLastUploadStatus;
    window.checkToken = checkToken;
    window.runAllTests = runAllTests;
    console.log('%c✓ Funciones de prueba cargadas', 'color: green; font-weight: bold;');
    console.log('Puedes ejecutar en la consola:');
    console.log('  - runAllTests() - Suite completa de diagnóstico');
    console.log('  - testBackendConnection() - Probar endpoint específico');
    console.log('  - checkAPIHealth() - Verificar disponibilidad del servidor');
    console.log('  - checkToken() - Verificar autenticación');
    console.log('  - getLastUploadStatus() - Ver última carga');
}

