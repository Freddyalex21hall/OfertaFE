import { request } from './apiClient.js';

const API_BASE_URL = 'https://oferta-production-44e9.up.railway.app';

export const estadoNormasService = {
    getAll: () => request('/estado_normas/listar'),
    
    create: (data) => request('/estado_normas/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    
    createBulk: (dataArray) => request('/estado_normas/crear-multiples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataArray)
    }),
    
    uploadExcel: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return request('/cargar_archivos/cargar-archivos', {
            method: 'POST',
            body: fd
        });
    },

    uploadExcelWithProgress: (file, onProgress) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const url = `${API_BASE_URL}/cargar_archivos/cargar-archivos`;
            const token = localStorage.getItem('access_token');
            xhr.open('POST', url);
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && typeof onProgress === 'function') {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent, e.loaded, e.total);
                }
            };
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
                    } else {
                        let msg = xhr.statusText || 'Error al subir archivo';
                        try {
                            const j = JSON.parse(xhr.responseText);
                            msg = j.detail || j.message || msg;
                        } catch {}
                        
                        if (xhr.status === 404) {
                            msg = `Recurso no encontrado (404). Verifique la ruta: ${url}`;
                        }
                        
                        reject(new Error(msg));
                    }
                }
            };
            const fd = new FormData();
            fd.append('file', file);
            xhr.send(fd);
        });
    }
};
