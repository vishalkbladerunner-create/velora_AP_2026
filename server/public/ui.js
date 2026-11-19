(function () {
  const region = document.getElementById('toast-region');

  function toast(message, kind) {
    if (!region) return;
    const element = document.createElement('div');
    element.className = 'toast toast-' + (kind || 'info');
    element.setAttribute('role', 'status');
    element.textContent = message;
    region.appendChild(element);
    requestAnimationFrame(() => element.classList.add('is-visible'));
    setTimeout(() => {
      element.classList.remove('is-visible');
      setTimeout(() => element.remove(), 240);
    }, 4200);
  }

  function formatPrice(paise) {
    return '₹' + (paise / 100).toFixed(2);
  }

  function initials(name) {
    return String(name || 'V')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  const path = window.location.pathname;
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === path || (path === '/index.html' && href === '/')) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });

  const authLink = document.querySelector('[data-auth-link]');
  const pharmacyLinks = document.querySelectorAll('[data-pharmacy-only]');

  if (authLink || pharmacyLinks.length > 0) {
    fetch('/auth/me')
      .then(async (response) => {
        const user = response.ok ? await response.json() : null;
        if (authLink) authLink.textContent = user ? 'Account' : 'Sign in';
        const isPharmacy = user && user.accountType === 'PHARMACY';
        pharmacyLinks.forEach((link) => {
          link.hidden = !isPharmacy;
        });
      })
      .catch(() => {
        pharmacyLinks.forEach((link) => {
          link.hidden = true;
        });
      });
  }

  window.Velora = { toast, formatPrice, initials };
})();
