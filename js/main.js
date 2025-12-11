const mainContent = document.getElementById('contenido');
const navLinks = document.querySelector('.sidebar-nav');

navLinks.addEventListener('click', (event) => {
    console.log(event);
    const link = event.target.closest('a[data-page]');
    
    if (link) {
        event.preventDefault();
        const pageToLoad = link.dataset.page;
        console.log(`Paso 1: Clic detectado. Se va a cargar la página: '${pageToLoad}'`);
        loadContent(pageToLoad);
    }

});

const loadContent = async (page) => {
console.log(`Paso 2: Se llamó a loadContent con el parámetro: '${page}'`);
try {
    const response = await fetch(`pages/${page}.html`);
    console.log("Paso 3: Se intentó hacer fetch. Respuesta recibida:", response);

    if (!response.ok) {
    // Si la respuesta no es OK, lanzamos un error para que lo capture el catch.
    throw new Error(`Error de red: ${response.status} - ${response.statusText}`);
    }
    const html = await response.text();
    mainContent.innerHTML = html;
    console.log("Paso 4: El contenido HTML se ha inyectado en #main-content.");
    
    // cuando se carga la página users
    if (page === 'usuarios') {
    import('./pages/usuarios.js')
        .then(usersModule => usersModule.Init());  // llama la función modulo en users.js
    }

    // cuando se carga la página catalogo
    if (page === 'catalogo') {
    import('./pages/catalogo.js')
        .then(catalogoModule => catalogoModule.Init());  
    }

    // cuando se carga la página panel
    if (page === 'panel') {
    import('./pages/panel.js')
        .then(panelModule => panelModule.Init());  
    }



} catch (error) {
    console.error("¡ERROR! Algo falló dentro de loadContent:", error);
    mainContent.innerHTML = `<h3 class="text-center text-danger p-5">No se pudo cargar el contenido. Revisa la consola (F12).</h3>`;
}
};

// SELECCIONAMOS EL BOTÓN DE LOGOUT POR SU ID
const logoutButton = document.getElementById('logout-button');

/**
 * Llamamos LA FUNCIÓN PARA MANEJAR EL LOGOUT
 * Limpia los datos de sesión y redirige al login.
 */
if (logoutButton) {
  logoutButton.addEventListener('click', (event) => {
    event.preventDefault();
    console.log('Cerrando sesión...');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.log('No se encontró token. Redirigiendo al login...');
        window.location.href = '/index.html';
    }

    loadContent("panel");
});
