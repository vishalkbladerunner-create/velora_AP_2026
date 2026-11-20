(function () {
  const region = document.getElementById('toast-region');
  let accessToken = null;
  let refreshing = null;

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

  function setToken(token) {
    accessToken = token || null;
  }

  function clearToken() {
    accessToken = null;
  }

  // Exchange the HttpOnly refresh cookie for a short-lived access token. Only
  // one refresh runs at a time, even when several requests receive a 401.
  function refreshAccessToken() {
    if (!refreshing) {
      refreshing = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
        .then(async (response) => {
          if (!response.ok) {
            accessToken = null;
            return false;
          }

          const body = await response.json();
          accessToken = body.accessToken;
          return true;
        })
        .catch(() => {
          accessToken = null;
          return false;
        })
        .finally(() => {
          refreshing = null;
        });
    }

    return refreshing;
  }

  function isAuthEndpoint(url) {
    return url.indexOf('/auth/login') !== -1 ||
      url.indexOf('/auth/register') !== -1 ||
      url.indexOf('/auth/refresh') !== -1;
  }

  // Fetch wrapper: adds the Bearer token, refreshes once on 401, retries.
  async function api(input, options) {
    const url = typeof input === 'string' ? input : input.url;
    const opts = Object.assign({ credentials: 'include' }, options || {});
    const headers = new Headers(opts.headers || {});

    if (accessToken) {
      headers.set('Authorization', 'Bearer ' + accessToken);
    }

    opts.headers = headers;
    let response = await fetch(input, opts);

    if (response.status === 401 && !isAuthEndpoint(url)) {
      const ok = await refreshAccessToken();

      if (ok) {
        headers.set('Authorization', 'Bearer ' + accessToken);
        response = await fetch(input, opts);
      }
    }

    return response;
  }

  async function currentUser() {
    const response = await api('/api/v1/auth/me');

    if (!response.ok) {
      return null;
    }

    return response.json();
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
  const adminLinks = document.querySelectorAll('[data-admin-only]');

  if (authLink || pharmacyLinks.length > 0 || adminLinks.length > 0) {
    currentUser()
      .then((user) => {
        if (authLink) authLink.textContent = user ? 'Account' : 'Sign in';

        const isPharmacy = Boolean(user) && user.role === 'PHARMACY';
        const isAdmin = Boolean(user) && user.role === 'ADMIN';

        pharmacyLinks.forEach((link) => {
          link.hidden = !isPharmacy;
        });

        adminLinks.forEach((link) => {
          link.hidden = !isAdmin;
        });
      })
      .catch(() => {
        pharmacyLinks.forEach((link) => {
          link.hidden = true;
        });
        adminLinks.forEach((link) => {
          link.hidden = true;
        });
      });
  }

  window.Velora = {
    toast,
    formatPrice,
    initials,
    api,
    setToken,
    clearToken,
    refresh: refreshAccessToken,
    currentUser,
  };
})();
