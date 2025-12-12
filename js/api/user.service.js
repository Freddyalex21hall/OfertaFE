function getLoginUrl() {
  return location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
}
export function ensureAuthGuard() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    window.location.replace(getLoginUrl());
  }
}
export function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('senaOfertaData');
  sessionStorage.removeItem('senaOfertaLastUpdate');
  sessionStorage.removeItem('senaCatalogoData');
  sessionStorage.removeItem('senaCatalogoLastUpdate');
  sessionStorage.removeItem('senaEstadoNormasData');
  sessionStorage.removeItem('senaEstadoNormasLastUpdate');
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => { history.go(1); });
  window.location.replace(getLoginUrl());
}
export function bindLogoutButton() {
  const btn = document.getElementById('logout-button');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
}
document.addEventListener('DOMContentLoaded', () => {
  ensureAuthGuard();
  bindLogoutButton();
});
