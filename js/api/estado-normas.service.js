import { request } from './apiClient.js';

const API_BASE_URL = 'https://oferta-production-44e9.up.railway.app';

export const estadoNormasService = {
    /**
     * Subir archivo Excel de estado de normas
     * @param {File} file - Archivo Excel a subir
     * @returns {Promise<object>}
     */
    uploadEstadoNormas: async (file) => {
        const url = `${API_BASE_URL}/cargar_archivos/cargar-archivos`;
        const token = localStorage.getItem('access_token');

        console.log('📤 Iniciando petición al backend');
        console.log('URL completa:', url);

        // Crear FormData para enviar el archivo
        const formData = new FormData();
        formData.append('file', file);

        console.log('FormData creado con archivo:', file.name);

        try {
            console.log('Enviando petición POST...');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'accept': 'application/json'
                    // No agregamos 'Content-Type' porque el navegador lo establece automáticamente con boundary
                },
                body: formData
            });

            console.log('📩 Respuesta recibida');
            console.log('Status:', response.status, response.statusText);
            console.log('Headers:', {
                'content-type': response.headers.get('content-type'),
                'content-length': response.headers.get('content-length')
            });

            // Manejo de errores HTTP
            if (response.status === 401) {
                console.error('❌ Error 401: No autorizado');
                console.warn("No tiene permisos para realizar esta acción");
                throw new Error('No autorizado - Verifique su token de autenticación');
            }

            if (response.status === 403) {
                console.error('❌ Error 403: Prohibido');
                console.warn("Token inválido");
                throw new Error('Token inválido - Inicie sesión nuevamente');
            }

            if (!response.ok) {
                console.error('❌ Error en la respuesta del servidor');
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { detail: `Error HTTP ${response.status}` };
                }
                console.error('Detalles del error:', errorData);
                throw new Error(errorData.detail || `Error HTTP ${response.status}`);
            }

            // Si la respuesta es exitosa, devolvemos el JSON
            let responseData;
            try {
                responseData = await response.json();
            } catch (e) {
                console.warn('No se pudo parsear la respuesta como JSON');
                responseData = { success: true, message: 'Archivo cargado' };
            }
            
            console.log('✓ Respuesta JSON:', responseData);
            return responseData;

        } catch (error) {
            console.error('❌ Error en uploadEstadoNormas:', error.message);
            console.error('Stack:', error.stack);
            throw error;
        }
    },

    /**
     * Obtener historial de cargas (si el backend lo proporciona)
     * @returns {Promise<object>}
     */
    getUploadHistory: async () => {
        try {
            return await request('/cargar_archivos/historial');
        } catch (error) {
            console.error('Error al obtener historial de cargas:', error);
            throw error;
        }
    },

    /**
     * Guardar información de la última carga en localStorage
     * @param {object} uploadInfo - Información de la carga
     */
    saveUploadInfo: (uploadInfo) => {
        try {
            const info = {
                ...uploadInfo,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('last_estado_normas_upload', JSON.stringify(info));
            console.log('📝 Información de carga guardada en localStorage');
        } catch (error) {
            console.error('Error al guardar información de carga:', error);
        }
    },

    /**
     * Obtener información de la última carga almacenada localmente
     * @returns {Promise<object|null>}
     */
    getLastUploadInfo: async () => {
        try {
            const storedInfo = localStorage.getItem('last_estado_normas_upload');
            return storedInfo ? JSON.parse(storedInfo) : null;
        } catch (error) {
            console.error('Error al obtener información de última carga:', error);
            return null;
        }
    }
};
