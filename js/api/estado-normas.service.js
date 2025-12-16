import { request } from './apiClient.js';

export const estadoNormasService = {
    getAll: () => request('/estado_normas/estado_normas/listar'),
    
    create: (data) => request('/estado_normas/estado_normas/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }),
    
    createBulk: (dataArray) => request('/estado_normas/estado_normas/crear-multiples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataArray)
    }),
    
    uploadExcel: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return request('/estado_normas/upload-excel-estado-normas/', {
            method: 'POST',
            body: fd
        });
    },
    
    porEstado: (estado) => request(`/estado_normas/por-estado/${estado}`),
    porTipo: (tipo) => request(`/estado_normas/por-tipo/${tipo}`),
    porFecha: (fecha) => request(`/estado_normas/por-fecha/${fecha}`)
};
