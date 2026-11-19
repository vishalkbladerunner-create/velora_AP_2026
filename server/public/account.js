const messageEl = document.getElementById('account-message');
const loggedOutEl = document.getElementById('logged-out');
const loggedInEl = document.getElementById('logged-in');
const avatarEl = document.getElementById('avatar');
const userNameEl = document.getElementById('user-name');
const userPhoneEl = document.getElementById('user-phone');
const accountTypeBadgeEl = document.getElementById('account-type-badge');
const holdsListEl = document.getElementById('holds-list');
const holdsEmptyEl = document.getElementById('holds-empty');
const holdsCountEl = document.getElementById('holds-count');
const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const logoutButton = document.getElementById('logout-button');
const tabs = document.querySelectorAll('[data-tab]');
const accountTypeInputs = document.querySelectorAll('input[name="accountType"]');
const pharmacyFields = document.getElementById('pharmacy-fields');
const pharmacyPanel = document.getElementById('pharmacy-panel');
const customerPanel = document.getElementById('customer-panel');
const profileForm = document.getElementById('profile-form');
const profileName = document.getElementById('profile-name');
const profilePhone = document.getElementById('profile-phone');
const profileAddress = document.getElementById('profile-address');
const pharmacyDetailsEl = document.getElementById('pharmacy-details');
const pharmacyNameLineEl = document.getElementById('pharmacy-name-line');
const pharmacyStatusEl = document.getElementById('pharmacy-status');
const pharmacyMetaLineEl = document.getElementById('pharmacy-meta-line');
const pharmacyAddressLineEl = document.getElementById('pharmacy-address-line');
const pharmacyLicenceLineEl = document.getElementById('pharmacy-licence-line');
const editPharmacyButton = document.getElementById('edit-pharmacy-button');
const registerPharmacyForm = document.getElementById('register-pharmacy-form');
const editPharmacyForm = document.getElementById('edit-pharmacy-form');
const cancelPharmacyEdit = document.getElementById('cancel-pharmacy-edit');
const authLink = document.querySelector('[data-auth-link]');

let currentUser = null;
let currentPharmacy = null;
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

function redirectNext() {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    window.location.href = next;
    return true;
  }
  return false;
}

function selectedAccountType() {
  const checked = document.querySelector('input[name="accountType"]:checked');
  return checked ? checked.value : 'CUSTOMER';
}

function togglePharmacyFields() {
  pharmacyFields.hidden = selectedAccountType() !== 'PHARMACY';
}

function setPharmacyLinks(visible) {
  document.querySelectorAll('[data-pharmacy-only]').forEach((element) => {
    element.hidden = !visible;
  });
}

function showLoggedOut() {
  currentUser = null;
  currentPharmacy = null;
  loggedOutEl.hidden = false;
  loggedInEl.hidden = true;
  holdsListEl.replaceChildren();
  holdsEmptyEl.hidden = true;
  holdsCountEl.textContent = '';
  pharmacyPanel.hidden = true;
  customerPanel.hidden = true;
  setPharmacyLinks(false);
  if (authLink) authLink.textContent = 'Sign in';
}

function showLoggedIn(user) {
  currentUser = user;
  loggedOutEl.hidden = true;
  loggedInEl.hidden = false;
  avatarEl.textContent = Velora.initials(user.name);
  userNameEl.textContent = user.name;
  userPhoneEl.textContent = user.phone;
  profileName.value = user.name;
  profilePhone.value = user.phone;
  profileAddress.value = user.address || '';

  const isPharmacy = user.accountType === 'PHARMACY';
  accountTypeBadgeEl.textContent = isPharmacy ? 'Pharmacy owner' : 'Customer';
  accountTypeBadgeEl.className = isPharmacy ? 'pill-verified' : 'pill-soft';
  pharmacyPanel.hidden = !isPharmacy;
  customerPanel.hidden = isPharmacy;
  setPharmacyLinks(isPharmacy);
  if (authLink) authLink.textContent = 'Account';
}

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function renderHolds(holds) {
  holdsListEl.replaceChildren();

  const active = holds.filter((hold) => hold.status === 'ACTIVE').length;
  holdsCountEl.textContent = active + ' active';

  if (holds.length === 0) {
    holdsEmptyEl.hidden = false;
    return;
  }

  holdsEmptyEl.hidden = true;

  holds.forEach((hold) => {
    const item = document.createElement('li');
    item.className = 'hold';

    const main = document.createElement('div');
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
    timing.textContent = (hold.status === 'ACTIVE' ? 'Expires ' : 'Ended ') + formatDate(hold.expiresAt);

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
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', async () => {
        cancel.disabled = true;
        const response = await fetch('/holds/' + encodeURIComponent(hold.id), { method: 'DELETE' });

        if (response.status === 401) {
          showLoggedOut();
          return;
        }

        if (response.status === 204) {
          Velora.toast('Hold cancelled. The stock is back on the shelf.', 'success');
          await loadHolds();
          return;
        }

        const body = await readJson(response);
        Velora.toast(body.error || 'Could not cancel the hold.', 'error');
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
    Velora.toast(body.error || 'Could not load your holds.', 'error');
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
    licenceNumber: document.getElementById(prefix + 'pharmacy-licence') ? document.getElementById(prefix + 'pharmacy-licence').value.trim() : '',
  };
}

function fillPharmacy(prefix, pharmacy) {
  document.getElementById(prefix + 'pharmacy-name').value = pharmacy.name;
  document.getElementById(prefix + 'pharmacy-area').value = pharmacy.area;
  document.getElementById(prefix + 'pharmacy-address').value = pharmacy.address;
  document.getElementById(prefix + 'pharmacy-phone').value = pharmacy.phone;
  if (document.getElementById(prefix + 'pharmacy-licence') && pharmacy.licenceNumber) {
    document.getElementById(prefix + 'pharmacy-licence').value = pharmacy.licenceNumber;
  }
}

function isCompletePharmacy(pharmacy) {
  return pharmacy.name && pharmacy.area && pharmacy.address && pharmacy.phone;
}

async function registerPharmacy(pharmacy) {
  const response = await fetch('/pharmacies/mine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pharmacy),
  });

  const body = await readJson(response);
  return { ok: response.ok, status: response.status, body: body };
}

async function updatePharmacy(pharmacy) {
  const response = await fetch('/pharmacies/mine', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: pharmacy.name,
      area: pharmacy.area,
      address: pharmacy.address,
      phone: pharmacy.phone,
    }),
  });

  const body = await readJson(response);
  return { ok: response.ok, body: body };
}

function showPharmacy(pharmacy) {
  currentPharmacy = pharmacy;
  pharmacyDetailsEl.hidden = false;
  registerPharmacyForm.hidden = true;
  editPharmacyForm.hidden = true;
  pharmacyNameLineEl.textContent = pharmacy.name;
  pharmacyStatusEl.textContent = pharmacy.status;
  pharmacyStatusEl.className = pharmacy.status === 'VERIFIED' ? 'pill-verified' : 'pill-pending';
  pharmacyMetaLineEl.textContent = pharmacy.area + ' · ' + pharmacy.phone;
  pharmacyAddressLineEl.textContent = pharmacy.address;
  pharmacyLicenceLineEl.textContent = 'Licence ' + pharmacy.licenceNumber;
}

function showPharmacyCreate() {
  currentPharmacy = null;
  pharmacyDetailsEl.hidden = true;
  editPharmacyForm.hidden = true;
  registerPharmacyForm.hidden = false;

  if (pendingPharmacy) {
    fillPharmacy('account-', pendingPharmacy);
    pendingPharmacy = null;
  }
}

function showPharmacyEdit() {
  if (!currentPharmacy) return;
  pharmacyDetailsEl.hidden = true;
  registerPharmacyForm.hidden = true;
  editPharmacyForm.hidden = false;
  fillPharmacy('edit-', currentPharmacy);
}

async function loadPharmacy() {
  if (!currentUser || currentUser.accountType !== 'PHARMACY') {
    pharmacyPanel.hidden = true;
    return;
  }

  const response = await fetch('/pharmacies/mine');

  if (response.status === 403) {
    pharmacyPanel.hidden = true;
    return;
  }

  if (response.status === 404) {
    showPharmacyCreate();
    return;
  }

  const body = await readJson(response);

  if (!response.ok) {
    Velora.toast(body.error || 'Could not load your pharmacy.', 'error');
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
    Velora.toast(body.error || 'Could not load the account.', 'error');
    return;
  }

  showLoggedIn(body);
  await loadPharmacy();
  await loadHolds();
}

function selectTab(name) {
  tabs.forEach((tab) => {
    const active = tab.getAttribute('data-tab') === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  registerForm.hidden = name !== 'register';
  loginForm.hidden = name !== 'login';
  hideMessage();
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => selectTab(tab.getAttribute('data-tab')));
});

accountTypeInputs.forEach((input) => {
  input.addEventListener('change', togglePharmacyFields);
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('register-name').value.trim();
  const phone = document.getElementById('register-phone').value.trim();
  const address = document.getElementById('register-address').value.trim();
  const password = document.getElementById('register-password').value;
  const accountType = selectedAccountType();
  const pharmacy = readPharmacy('signup-');

  if (name.length < 2 || phone.length !== 10 || address.length < 5) {
    showMessage('Provide a name, a 10-digit mobile number and your address.', 'error');
    return;
  }

  if (accountType === 'PHARMACY' && !isCompletePharmacy(pharmacy)) {
    showMessage('Complete every pharmacy field for a pharmacy account.', 'error');
    return;
  }

  const response = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name,
      phone: phone,
      address: address,
      password: password,
      accountType: accountType,
    }),
  });

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not create the account.', 'error');
    return;
  }

  registerForm.reset();
  togglePharmacyFields();

  if (accountType === 'PHARMACY') {
    const result = await registerPharmacy(pharmacy);

    if (!result.ok) {
      pendingPharmacy = pharmacy;
      showMessage('Account created, but the pharmacy was not registered: ' + (result.body.error || 'unknown error'), 'error');
      await loadMe();
      return;
    }
  }

  Velora.toast(accountType === 'PHARMACY' ? 'Pharmacy account created.' : 'Customer account created.', 'success');

  if (redirectNext()) return;
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
  Velora.toast('Welcome back.', 'success');

  if (redirectNext()) return;
  await loadMe();
});

logoutButton.addEventListener('click', async () => {
  const response = await fetch('/auth/logout', { method: 'POST' });

  if (!response.ok) {
    const body = await readJson(response);
    Velora.toast(body.error || 'Could not log out.', 'error');
    return;
  }

  showLoggedOut();
  Velora.toast('Logged out.', 'info');
});

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = profileName.value.trim();
  const phone = profilePhone.value.trim();
  const address = profileAddress.value.trim();

  if (name.length < 2 || phone.length !== 10 || address.length < 5) {
    Velora.toast('Provide a name, a 10-digit mobile number and your address.', 'error');
    return;
  }

  const response = await fetch('/auth/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, phone: phone, address: address }),
  });

  const body = await readJson(response);

  if (!response.ok) {
    Velora.toast(body.error || 'Could not save your details.', 'error');
    return;
  }

  Velora.toast('Your details were saved.', 'success');
  await loadMe();
});

registerPharmacyForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const pharmacy = readPharmacy('account-');

  if (!isCompletePharmacy(pharmacy) || !pharmacy.licenceNumber) {
    Velora.toast('Complete every pharmacy field.', 'error');
    return;
  }

  const result = await registerPharmacy(pharmacy);

  if (!result.ok) {
    Velora.toast(result.body.error || 'Could not register the pharmacy.', 'error');
    return;
  }

  registerPharmacyForm.reset();
  Velora.toast('Pharmacy registered.', 'success');
  await loadPharmacy();
});

editPharmacyButton.addEventListener('click', showPharmacyEdit);

cancelPharmacyEdit.addEventListener('click', () => {
  if (currentPharmacy) {
    showPharmacy(currentPharmacy);
  } else {
    showPharmacyCreate();
  }
});

editPharmacyForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const pharmacy = readPharmacy('edit-');

  if (!isCompletePharmacy(pharmacy)) {
    Velora.toast('Complete every pharmacy field.', 'error');
    return;
  }

  const result = await updatePharmacy(pharmacy);

  if (!result.ok) {
    Velora.toast(result.body.error || 'Could not update the pharmacy.', 'error');
    return;
  }

  Velora.toast('Pharmacy details updated.', 'success');
  await loadPharmacy();
});

togglePharmacyFields();
loadMe();
