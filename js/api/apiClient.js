// Este archivo tendrá una única función request que se encargará de todo el trabajo estandar: 
// añadir la URL base, poner el token, y manejar los errores 401. Esto evita repetir código en cada servicio.

// La única función que necesitamos importar es la de logout.
// La importamos para usarla en caso de un error 401.

import { logout } from './user.service.js';
const API_BASE_URL = 'https://oferta-production-44e9.up.railway.app';

async function readBody(response) {
    if (response.status === 204) return {};
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();

    // Priorizar JSON si el servidor lo indica o si es parseable
    if (contentType.includes('application/json')) {
        try { return JSON.parse(text); } catch (_) { /* fall back to other strategies */ }
    }
    try { return JSON.parse(text); } catch (_) { /* ignore */ }
    return text;
}

/**
 * Cliente central para realizar todas las peticiones a la API.
 * @param {string} endpoint - El endpoint al que se llamará (ej. '/users/get-by-centro').
 * @param {object} [options={}] - Opciones para la petición fetch (method, headers, body).
 * @returns {Promise<any>} - La respuesta de la API en formato JSON.
 */                          
export async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('access_token');

    // Configuramos las cabeceras por defecto
    const headers = {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        ...options.headers, // Permite sobrescribir o añadir cabeceras
    };

    // Si hay un token, lo añadimos a la cabecera de Authorization
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        // Si el body es FormData, dejamos que el navegador ponga el boundary y no forzamos Content-Type
        const opts = { ...options, headers: { ...headers } };
        if (opts.body instanceof FormData) {
            delete opts.headers['Content-Type'];
        }
        const response = await fetch(url, opts);

        // Manejo centralizado del error 401 (Token inválido/expirado)
        if (response.status === 401) {
            logout();
            throw new Error('Sesión expirada.');
        }
        if (response.status === 403){
            logout();
            throw new Error('Token inválido.');
        }

        if (!response.ok) {
            const errorData = await readBody(response);
            const detail = typeof errorData === 'string'
                ? errorData
                : (errorData?.detail || errorData?.message || 'Ocurrió un error en la petición.');
            throw new Error(detail);
        }
        
        // Devuelve el cuerpo parseado (JSON o texto) o un objeto vacío si no hay contenido.
        return await readBody(response);

    } catch (error) {
        console.error(`Error en la petición a ${endpoint}:`, error);
        throw error;
    }
}
