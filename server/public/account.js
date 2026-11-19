const messageEl = document.getElementById('account-message');
const loggedOutEl = document.getElementById('logged-out');
const loggedInEl = document.getElementById('logged-in');
const userNameEl = document.getElementById('user-name');
const userPhoneEl = document.getElementById('user-phone');
const holdsListEl = document.getElementById('holds-list');
const holdsEmptyEl = document.getElementById('holds-empty');
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const logoutButton = document.getElementById('logout-button');

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = 'state state-' + kind;
  messageEl.hidden = false;
}

function hideMessage() {
  messageEl.hidden = true;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function showLoggedOut() {
  loggedOutEl.hidden = false;
  loggedInEl.hidden = true;
  holdsListEl.replaceChildren();
  holdsEmptyEl.hidden = true;
}

function showLoggedIn(user) {
  loggedOutEl.hidden = true;
  loggedInEl.hidden = false;
  userNameEl.textContent = user.name;
  userPhoneEl.textContent = user.phone;
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function renderHolds(holds) {
  holdsListEl.replaceChildren();

  if (holds.length === 0) {
    holdsEmptyEl.hidden = false;
    return;
  }

  holdsEmptyEl.hidden = true;

  holds.forEach((hold) => {
    const item = document.createElement('li');
    item.className = 'hold';

    const main = document.createElement('div');
    main.className = 'hold-main';

    const stock = hold.stockItem || {};
    const medicine = stock.medicine ? stock.medicine.name : 'Medicine';
    const pharmacy = stock.pharmacy ? stock.pharmacy.name : 'Pharmacy';

    const title = document.createElement('p');
    title.className = 'hold-title';
    title.textContent = hold.quantity + ' × ' + medicine;
    main.appendChild(title);

    const place = document.createElement('p');
    place.className = 'hold-meta';
    place.textContent = pharmacy + (stock.pharmacy ? ', ' + stock.pharmacy.area : '');
    main.appendChild(place);

    const timing = document.createElement('p');
    timing.className = 'hold-meta';

    if (hold.status === 'ACTIVE') {
      timing.textContent = 'Expires ' + formatDate(hold.expiresAt) + ' · ';
    } else {
      timing.textContent = 'Ended ' + formatDate(hold.expiresAt) + ' · ';
    }

    const status = document.createElement('span');
    status.className = 'hold-status hold-status-' + hold.status.toLowerCase();
    status.textContent = hold.status;
    timing.appendChild(status);
    main.appendChild(timing);

    item.appendChild(main);

    if (hold.status === 'ACTIVE') {
      const actions = document.createElement('div');
      actions.className = 'hold-actions';

      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel hold';

      cancel.addEventListener('click', async () => {
        cancel.disabled = true;

        const response = await fetch('/holds/' + encodeURIComponent(hold.id), {
          method: 'DELETE',
        });

        if (response.status === 401) {
          showLoggedOut();
          return;
        }

        if (response.status === 204) {
          showMessage('Hold cancelled. The stock is back on the shelf.', 'success');
          await loadHolds();
          return;
        }

        const body = await readJson(response);
        showMessage(body.error || 'Could not cancel the hold.', 'error');
        cancel.disabled = false;
      });

      actions.appendChild(cancel);
      item.appendChild(actions);
    }

    holdsListEl.appendChild(item);
  });
}

async function loadHolds() {
  const response = await fetch('/holds');

  if (response.status === 401) {
    showLoggedOut();
    return;
  }

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not load your holds.', 'error');
    return;
  }

  renderHolds(body);
}

async function loadMe() {
  const response = await fetch('/auth/me');

  if (response.status === 401) {
    showLoggedOut();
    return;
  }

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not load the account.', 'error');
    return;
  }

  showLoggedIn(body);
  await loadHolds();
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('register-name').value.trim();
  const phone = document.getElementById('register-phone').value.trim();
  const password = document.getElementById('register-password').value;

  const response = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, phone: phone, password: password }),
  });

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not create the account.', 'error');
    return;
  }

  registerForm.reset();
  hideMessage();
  await loadMe();
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const phone = document.getElementById('login-phone').value.trim();
  const password = document.getElementById('login-password').value;

  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone, password: password }),
  });

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not log in.', 'error');
    return;
  }

  loginForm.reset();
  hideMessage();
  await loadMe();
});

logoutButton.addEventListener('click', async () => {
  const response = await fetch('/auth/logout', { method: 'POST' });

  if (!response.ok) {
    const body = await readJson(response);
    showMessage(body.error || 'Could not log out.', 'error');
    return;
  }

  hideMessage();
  showLoggedOut();
});

loadMe();
