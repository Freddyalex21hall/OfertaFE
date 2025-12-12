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

        // Crear FormData para enviar el archivo
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'accept': 'application/json'
                    // No agregamos 'Content-Type' porque el navegador lo establece automáticamente con boundary
                },
                body: formData
            });

            // Manejo de errores HTTP
            if (response.status === 401) {
                console.warn("No tiene permisos para realizar esta acción");
                throw new Error('No autorizado');
            }

            if (response.status === 403) {
                console.warn("Token inválido");
                throw new Error('Token inválido');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ 
                    detail: 'Ocurrió un error al subir el archivo.' 
                }));
                throw new Error(errorData.detail || 'Error al subir el archivo');
            }

            // Si la respuesta es exitosa, devolvemos el JSON
            return await response.json();

        } catch (error) {
            console.error('Error en uploadEstadoNormas:', error);
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
