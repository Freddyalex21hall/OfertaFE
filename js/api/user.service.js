
import { request } from './apiClient.js';

export const userService = {
    getUsers: () => {
        const userString = localStorage.getItem('user');
        if (!userString) {
            return Promise.reject(new Error('Información de usuario no encontrada.'));
        }
        const user = JSON.parse(userString);
        
        console.log("Usuario en userService:", user);
        
        const endpoint = `/usuario/obtener-todos-secure`;
        
        // La lógica es mucho más simple ahora, solo llamamos a nuestro cliente central.
        let respuesta = request(endpoint);

        return respuesta;
    },
    
    /**
     * Obtener un usuario por su email.
     * @param {string} correo - El correo del usuario a buscar.
     * @returns {Promise<object>}
    */
    getUserByEmail: (correo) => {
        // Construimos la URL con el parámetro ?id_usuario=
        const endpoint = `/usuario/obtener-por-correo/${correo}`;
        return request(endpoint);
    },

    /**
     * Actualizar un usuario.
     * @param {string | number} userId - El ID del usuario a actualizar.
     * @param {object} userData - Los nuevos datos del usuario.
     * @returns {Promise<object>}
    */
    updateUser: (userId, userData) => {
        return request(`/users/by-id/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
        });
    },

    // Desactivar / Activar un usuario
    /**
     * Modifica el estado de un usuario (generalmente para desactivarlo).
     * @param {string | number} userId - El ID del usuario a modificar.
     * @returns {Promise<object>}
     */
    changueEstatusUser: (userId, newStatus) => {
        // Nuestro apiClient se encargará de añadir el token de autorización.
        return request(`/users/cambiar-estado/${userId}?nuevo_estado=${newStatus}`, {
        method: 'PUT',
        });
    },

    /**
     * Crear un usuario.
     * @param {object} userData - Los nuevos datos del usuario.
     * @returns {Promise<object>}
    */
    createUser: (userData) => {
        return request(`/usuario/registrar`, {
        method: 'POST',
        body: JSON.stringify(userData),
        });
    },

    /**
     * Actualizar un usuario.
     * @param {string | number} userId - El ID del usuario a actualizar.
     * @param {object} userData - Los nuevos datos del usuario.
     * @returns {Promise<object>}
    */
    updateUser: (userId, userData) => {
        return request(`/usuario/editar/${userId}`,{
        method: 'PUT',
        body: JSON.stringify(userData),
        });
    },
    // Aquí podrías añadir más servicios
};