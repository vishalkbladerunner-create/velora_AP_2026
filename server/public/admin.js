const denied = document.getElementById('admin-denied');
const workspace = document.getElementById('admin-workspace');
const exportButton = document.getElementById('export-button');
const pharmacyFilter = document.getElementById('pharmacy-filter');

const statPharmacies = document.getElementById('stat-pharmacies');
const statPending = document.getElementById('stat-pending');
const statUsers = document.getElementById('stat-users');
const statHolds = document.getElementById('stat-holds');

const pharmacyRows = document.getElementById('pharmacy-rows');
const pharmacyEmpty = document.getElementById('pharmacy-empty');
const userRows = document.getElementById('user-rows');
const userCount = document.getElementById('user-count');
const auditRows = document.getElementById('audit-rows');
const auditCount = document.getElementById('audit-count');

const clientForm = document.getElementById('client-form');
const clientRows = document.getElementById('client-rows');
const clientSecret = document.getElementById('client-secret');

const runtimeP99 = document.getElementById('runtime-p99');
const runtimeHeap = document.getElementById('runtime-heap');
const runtimeUptime = document.getElementById('runtime-uptime');

function cell(label, content) {
  const td = document.createElement('td');
  td.setAttribute('data-label', label);

  if (content instanceof Node) {
    td.appendChild(content);
  } else {
    td.textContent = content;
  }

  return td;
}

function badge(status) {
  const span = document.createElement('span');
  span.className = status === 'VERIFIED' ? 'pill-verified' : (status === 'PENDING' ? 'pill-pending' : 'pill-soft');
  span.textContent = status;
  return span;
}

function actionButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-small btn-ghost';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

async function setStatus(id, status) {
  const response = await Velora.api('/api/v1/admin/pharmacies/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: status }),
  });

  if (!response.ok) {
    const body = await response.json();
    Velora.toast(body.error || 'Could not update the pharmacy.', 'error');
    return;
  }

  Velora.toast('Pharmacy set to ' + status + '.', 'success');
  await Promise.all([loadOverview(), loadPharmacies(), loadAudit()]);
}

function renderPharmacies(pharmacies) {
  pharmacyRows.replaceChildren();
  pharmacyEmpty.hidden = pharmacies.length > 0;

  pharmacies.forEach((pharmacy) => {
    const row = document.createElement('tr');
    row.appendChild(cell('Pharmacy', pharmacy.name));
    row.appendChild(cell('Area', pharmacy.area));
    row.appendChild(cell('Status', badge(pharmacy.status)));
    row.appendChild(cell('Owner', pharmacy.owner ? pharmacy.owner.name : 'Unclaimed'));

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    if (pharmacy.status !== 'VERIFIED') {
      actions.appendChild(actionButton('Verify', () => setStatus(pharmacy.id, 'VERIFIED')));
    }

    if (pharmacy.status !== 'SUSPENDED') {
      actions.appendChild(actionButton('Suspend', () => setStatus(pharmacy.id, 'SUSPENDED')));
    }

    if (pharmacy.status !== 'REJECTED') {
      actions.appendChild(actionButton('Reject', () => setStatus(pharmacy.id, 'REJECTED')));
    }

    row.appendChild(cell('Actions', actions));
    pharmacyRows.appendChild(row);
  });
}

function renderUsers(users) {
  userRows.replaceChildren();

  users.forEach((user) => {
    const row = document.createElement('tr');
    row.appendChild(cell('Name', user.name));
    row.appendChild(cell('Phone', user.phone));
    row.appendChild(cell('Role', user.role));
    row.appendChild(cell('Pharmacy', user.pharmacy ? user.pharmacy.name + ' (' + user.pharmacy.status + ')' : '—'));
    row.appendChild(cell('Created', new Date(user.createdAt).toLocaleDateString()));
    userRows.appendChild(row);
  });
}

function renderAudit(entries) {
  auditRows.replaceChildren();

  entries.forEach((entry) => {
    const row = document.createElement('tr');
    row.appendChild(cell('Action', entry.action));
    row.appendChild(cell('Entity', entry.entity + (entry.entityId ? ' #' + entry.entityId : '')));
    row.appendChild(cell('Actor', entry.actor ? entry.actor.name : 'system'));
    row.appendChild(cell('When', new Date(entry.createdAt).toLocaleString()));
    auditRows.appendChild(row);
  });
}

function renderClients(clients) {
  clientRows.replaceChildren();

  clients.forEach((client) => {
    const row = document.createElement('tr');
    row.appendChild(cell('Client', client.name));
    row.appendChild(cell('Client ID', client.clientId));
    row.appendChild(cell('Scopes', client.scopes.join(' ')));
    row.appendChild(cell('Created', new Date(client.createdAt).toLocaleDateString()));
    clientRows.appendChild(row);
  });
}

async function loadOverview() {
  const response = await Velora.api('/api/v1/admin/overview');

  if (!response.ok) {
    Velora.toast('Could not load the overview.', 'error');
    return;
  }

  const body = await response.json();
  statPharmacies.textContent = body.counts.pharmacies;
  statPending.textContent = body.counts.pendingPharmacies;
  statUsers.textContent = body.counts.users;
  statHolds.textContent = body.counts.activeHolds;
}

async function loadPharmacies() {
  const status = pharmacyFilter.value;
  const url = '/api/v1/admin/pharmacies?limit=50' + (status === 'ALL' ? '' : '&status=' + encodeURIComponent(status));
  const response = await Velora.api(url);

  if (!response.ok) {
    Velora.toast('Could not load pharmacies.', 'error');
    return;
  }

  const body = await response.json();
  renderPharmacies(body.data);
}

async function loadUsers() {
  const response = await Velora.api('/api/v1/admin/users?limit=50');

  if (!response.ok) {
    return;
  }

  const body = await response.json();
  userCount.textContent = body.pagination.total + ' total';
  renderUsers(body.data);
}

async function loadAudit() {
  const response = await Velora.api('/api/v1/admin/audit?limit=25');

  if (!response.ok) {
    return;
  }

  const body = await response.json();
  auditCount.textContent = body.pagination.total + ' events';
  renderAudit(body.data);
}

async function loadClients() {
  const response = await Velora.api('/api/v1/admin/oauth-clients');

  if (!response.ok) {
    return;
  }

  renderClients(await response.json());
}

async function loadRuntime() {
  const response = await Velora.api('/api/v1/admin/runtime');

  if (!response.ok) {
    return;
  }

  const body = await response.json();
  runtimeP99.textContent = body.eventLoop.p99Ms.toFixed(1);
  runtimeHeap.textContent = (body.memory.heapUsedBytes / (1024 * 1024)).toFixed(1);
  runtimeUptime.textContent = Math.round(body.process.uptimeSeconds / 60);
}

pharmacyFilter.addEventListener('change', loadPharmacies);

clientForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('client-name').value.trim();
  const redirectUri = document.getElementById('client-redirect').value.trim();
  const scopes = document.getElementById('client-scopes').value.trim().split(/[\s,]+/).filter(Boolean);

  if (name.length < 2 || redirectUri.length === 0 || scopes.length === 0) {
    Velora.toast('Provide a name, a redirect URI and at least one scope.', 'error');
    return;
  }

  const response = await Velora.api('/api/v1/admin/oauth-clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, redirectUris: [redirectUri], scopes: scopes }),
  });

  const body = await response.json();

  if (!response.ok) {
    Velora.toast(body.error || 'Could not create the client.', 'error');
    return;
  }

  clientSecret.hidden = false;
  clientSecret.textContent = 'client_id: ' + body.clientId + '\nclient_secret: ' + body.clientSecret +
    '\n\nStore the secret now; it is not shown again.';
  clientForm.reset();
  await loadClients();
  Velora.toast('API client created.', 'success');
});

exportButton.addEventListener('click', async () => {
  const response = await Velora.api('/api/v1/admin/export/stock.csv');

  if (!response.ok) {
    Velora.toast('Could not export the stock file.', 'error');
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'velora-stock.csv';
  link.click();
  URL.revokeObjectURL(url);
});

async function start() {
  const user = await Velora.currentUser();

  if (!user || user.role !== 'ADMIN') {
    denied.hidden = false;
    workspace.hidden = true;
    return;
  }

  denied.hidden = true;
  workspace.hidden = false;
  await Promise.all([loadOverview(), loadPharmacies(), loadUsers(), loadAudit(), loadClients(), loadRuntime()]);
}

start();
