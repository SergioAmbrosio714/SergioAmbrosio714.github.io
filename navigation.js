/* Progressive navigation for static article pages. */
(() => {
  const button = document.getElementById('nav-toggle');
  const nav = document.getElementById('primary-nav');
  if (!button || !nav) return;
  const english = document.documentElement.lang === 'en';
  const set = (open, focus = false) => {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', english ? (open ? 'Close menu' : 'Open menu') : (open ? 'Cerrar menú' : 'Abrir menú'));
    if (focus) button.focus();
  };
  button.addEventListener('click', () => set(button.getAttribute('aria-expanded') !== 'true'));
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) set(false, true);
  });
})();
