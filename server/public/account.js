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
const pharmacyDetailsEl = document.getElementById('pharmacy-details');
const pharmacyNameLineEl = document.getElementById('pharmacy-name-line');
const pharmacyMetaLineEl = document.getElementById('pharmacy-meta-line');
const registerPharmacyForm = document.getElementById('register-pharmacy-form');

let pendingPharmacy = null;

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
  pharmacyDetailsEl.hidden = true;
  registerPharmacyForm.hidden = true;
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

function readPharmacy(prefix) {
  return {
    name: document.getElementById(prefix + 'pharmacy-name').value.trim(),
    area: document.getElementById(prefix + 'pharmacy-area').value.trim(),
    address: document.getElementById(prefix + 'pharmacy-address').value.trim(),
    phone: document.getElementById(prefix + 'pharmacy-phone').value.trim(),
    licenceNumber: document.getElementById(prefix + 'pharmacy-licence').value.trim(),
  };
}

function fillPharmacy(prefix, pharmacy) {
  document.getElementById(prefix + 'pharmacy-name').value = pharmacy.name;
  document.getElementById(prefix + 'pharmacy-area').value = pharmacy.area;
  document.getElementById(prefix + 'pharmacy-address').value = pharmacy.address;
  document.getElementById(prefix + 'pharmacy-phone').value = pharmacy.phone;
  document.getElementById(prefix + 'pharmacy-licence').value = pharmacy.licenceNumber;
}

function isBlankPharmacy(pharmacy) {
  return !pharmacy.name && !pharmacy.area && !pharmacy.address &&
    !pharmacy.phone && !pharmacy.licenceNumber;
}

function isCompletePharmacy(pharmacy) {
  return pharmacy.name && pharmacy.area && pharmacy.address &&
    pharmacy.phone && pharmacy.licenceNumber;
}

async function registerPharmacy(pharmacy) {
  const response = await fetch('/pharmacies/mine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pharmacy),
  });

  const body = await readJson(response);
  return { ok: response.ok, body: body };
}

function showPharmacy(pharmacy) {
  pharmacyDetailsEl.hidden = false;
  registerPharmacyForm.hidden = true;
  pharmacyNameLineEl.textContent = pharmacy.name;
  pharmacyMetaLineEl.textContent =
    pharmacy.area + ' · ' + pharmacy.status + ' · licence ' + pharmacy.licenceNumber;
}

function showPharmacyForm() {
  pharmacyDetailsEl.hidden = true;
  registerPharmacyForm.hidden = false;

  if (pendingPharmacy) {
    fillPharmacy('account-', pendingPharmacy);
    pendingPharmacy = null;
  }
}

async function loadPharmacy() {
  const response = await fetch('/pharmacies/mine');

  if (response.status === 401) {
    showLoggedOut();
    return;
  }

  if (response.status === 404) {
    showPharmacyForm();
    return;
  }

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not load your pharmacy.', 'error');
    return;
  }

  showPharmacy(body);
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
  await loadPharmacy();
  await loadHolds();
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('register-name').value.trim();
  const phone = document.getElementById('register-phone').value.trim();
  const password = document.getElementById('register-password').value;
  const pharmacy = readPharmacy('signup-');
  const hasPharmacy = !isBlankPharmacy(pharmacy);

  if (hasPharmacy && !isCompletePharmacy(pharmacy)) {
    showMessage('Complete every pharmacy field, or leave them all blank.', 'error');
    return;
  }

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

  if (hasPharmacy) {
    const result = await registerPharmacy(pharmacy);

    if (!result.ok) {
      pendingPharmacy = pharmacy;
      showMessage(
        'Account created, but the pharmacy was not registered: ' +
        (result.body.error || 'unknown error') + ' You can try again below.',
        'error'
      );
      await loadMe();
      return;
    }
  }

  showMessage(hasPharmacy ? 'Account and pharmacy created.' : 'Account created.', 'success');
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

  pendingPharmacy = null;
  hideMessage();
  showLoggedOut();
});

registerPharmacyForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const pharmacy = readPharmacy('account-');

  if (!isCompletePharmacy(pharmacy)) {
    showMessage('Complete every pharmacy field.', 'error');
    return;
  }

  const result = await registerPharmacy(pharmacy);

  if (!result.ok) {
    showMessage(result.body.error || 'Could not register the pharmacy.', 'error');
    return;
  }

  registerPharmacyForm.reset();
  showMessage('Pharmacy registered.', 'success');
  await loadPharmacy();
});

loadMe();
