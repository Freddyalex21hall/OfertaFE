const API_BASE_URL = 'https://oferta-production-44e9.up.railway.app';

export const catalogoService = {
    /**
     * Subir archivo Excel de catálogo de programas
     * @param {File} file - Archivo Excel a subir
     * @returns {Promise<object>}
     */
    uploadExcelCatalogo: async (file) => {
        const url = `${API_BASE_URL}/catalogo/upload-excel-catalogo-programas/`;
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
                alert("No tiene permisos para realizar esta acción");
                throw new Error('No autorizado');
            }

            if (response.status === 403) {
                alert("Token inválido");
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
            console.error('Error en uploadExcelCatalogo:', error);
            throw error;
        }
    },

    /**
     * Obtener información del último catálogo cargado (si existe endpoint)
     * @returns {Promise<object>}
     */
    getLastUploadInfo: async () => {
        // Este método es opcional, si tienes un endpoint para consultar
        // el historial de cargas, puedes implementarlo aquí
        try {
            const storedInfo = localStorage.getItem('last_catalogo_upload');
            return storedInfo ? JSON.parse(storedInfo) : null;
        } catch (error) {
            console.error('Error al obtener información de última carga:', error);
            return null;
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
            localStorage.setItem('last_catalogo_upload', JSON.stringify(info));
        } catch (error) {
            console.error('Error al guardar información de carga:', error);
        }
    },

    /**
     * Obtener todos los programas de formación
     * @returns {Promise<Array>}
     */
    obtenerTodosProgramas: async () => {
        const url = `${API_BASE_URL}/programas_formacion/listar`;
        const token = localStorage.getItem('access_token');

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'accept': 'application/json'
                }
            });

            // Manejo de errores HTTP
            if (response.status === 401) {
                console.error('No tiene permisos para realizar esta acción');
                throw new Error('No autorizado');
            }

            if (response.status === 403) {
                console.error('Token inválido');
                throw new Error('Token inválido');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ 
                    detail: 'Ocurrió un error al obtener los programas.' 
                }));
                throw new Error(errorData.detail || 'Error al obtener los programas');
            }

            const data = await response.json();
            return Array.isArray(data) ? data : (data.data || []);

        } catch (error) {
            console.error('Error en obtenerTodosProgramas:', error);
            throw error;
        }
    }
};