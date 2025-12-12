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
        console.log(`Token disponible: ${token ? 'Sí' : 'No'}`);

        // Realizar la petición
        console.log('Enviando petición...');
        const response = await fetch(fullURL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: formData
        });

        console.log(`Status: ${response.status} ${response.statusText}`);
        
        // Obtener y mostrar respuesta
        const responseData = await response.json().catch(() => ({
            error: 'No se pudo parsear la respuesta como JSON'
        }));

        console.log('Respuesta del servidor:');
        console.log(JSON.stringify(responseData, null, 2));

        if (response.ok) {
            console.log('\n✓ Conexión EXITOSA');
            console.log('El endpoint está disponible y respondiendo correctamente');
            return {
                success: true,
                status: response.status,
                response: responseData
            };
        } else {
            console.log('\n✗ Error en la respuesta');
            console.log(`El servidor respondió con status ${response.status}`);
            return {
                success: false,
                status: response.status,
                response: responseData
            };
        }

    } catch (error) {
        console.error('\n✗ Error de conexión:');
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

// Ejecutar pruebas
async function runAllTests() {
    console.clear();
    
    // Primero verificar salud general
    const healthOk = await checkAPIHealth();
    
    if (healthOk) {
        // Luego probar el endpoint específico
        await testBackendConnection();
    } else {
        console.error('\nNo se puede probar el endpoint porque el servidor no está disponible');
    }
}

// Exportar funciones para usar en consola
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testBackendConnection,
        checkAPIHealth,
        runAllTests
    };
}

// Si se ejecuta directamente en la consola del navegador
if (typeof window !== 'undefined') {
    window.testBackendConnection = testBackendConnection;
    window.checkAPIHealth = checkAPIHealth;
    window.runAllTests = runAllTests;
    console.log('Funciones de prueba cargadas. Puedes ejecutar:');
    console.log('  - runAllTests() - Ejecutar todas las pruebas');
    console.log('  - testBackendConnection() - Probar endpoint específico');
    console.log('  - checkAPIHealth() - Verificar disponibilidad del servidor');
}
