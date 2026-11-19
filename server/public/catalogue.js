const statMedicines = document.getElementById('stat-medicines');
const statStock = document.getElementById('stat-stock');
const statLow = document.getElementById('stat-low');
const pharmacyPanel = document.getElementById('pharmacy-panel');
const pharmacyName = document.getElementById('pharmacy-name');
const pharmacyMeta = document.getElementById('pharmacy-meta');
const publicPharmacyLink = document.getElementById('public-pharmacy-link');
const pharmacyEmpty = document.getElementById('pharmacy-empty');
const workspace = document.getElementById('catalogue-workspace');
const denied = document.getElementById('catalogue-denied');
const deniedText = document.getElementById('catalogue-denied-text');
const catalogueGrid = document.getElementById('catalogue-grid');
const stockFormPanel = document.getElementById('stock-form-panel');
const stockPharmacyLabel = document.getElementById('stock-pharmacy-label');
const stockSection = document.getElementById('stock-section');
const stockRows = document.getElementById('stock-rows');
const stockEmpty = document.getElementById('stock-empty');
const stockCount = document.getElementById('stock-count');
const stockMedicine = document.getElementById('stock-medicine');
const stockQuantity = document.getElementById('stock-quantity');
const stockPrice = document.getElementById('stock-price');
const stockSubmit = document.getElementById('stock-submit');
const stockFormTitle = document.getElementById('stock-form-title');
const cancelStockEdit = document.getElementById('cancel-stock-edit');
const medicineRows = document.getElementById('medicine-rows');
const medicineEmpty = document.getElementById('medicine-empty');
const medicineFilter = document.getElementById('medicine-filter');
const medicineSubmit = document.getElementById('medicine-submit');
const medicineFormTitle = document.getElementById('medicine-form-title');
const cancelMedicineEdit = document.getElementById('cancel-medicine-edit');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmText = document.getElementById('confirm-text');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

let medicines = [];
let myPharmacy = null;
let editingMedicineId = null;
let editingStockId = null;

function setOptions(select, items, valueKey, labelFor) {
  const previous = select.value;
  select.replaceChildren();

  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = String(item[valueKey]);
    option.textContent = labelFor(item);
    select.appendChild(option);
  });

  if (previous && items.some((item) => String(item[valueKey]) === previous)) {
    select.value = previous;
  }
}

function updateStats(stockRowCount, lowRowCount) {
  statMedicines.textContent = String(medicines.length);
  statStock.textContent = String(stockRowCount);
  statLow.textContent = String(lowRowCount);
}

function actionButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-btn ' + (className || '');
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function confirmDelete(text) {
  return new Promise((resolve) => {
    confirmText.textContent = text;
    const finish = (value) => {
      confirmDialog.close();
      resolve(value);
    };
    confirmOk.onclick = () => finish(true);
    confirmCancel.onclick = () => finish(false);
    confirmDialog.addEventListener('cancel', () => finish(false), { once: true });
    confirmDialog.showModal();
  });
}

function applyFilter() {
  const term = medicineFilter.value.trim().toLowerCase();
  let visible = 0;

  Array.from(medicineRows.children).forEach((row) => {
    const match = row.textContent.toLowerCase().includes(term);
    row.hidden = !match;
    if (match) visible += 1;
  });

  medicineEmpty.textContent = term ? 'No medicines match that filter.' : 'No medicines yet.';
  medicineEmpty.hidden = visible !== 0;
}

function startMedicineEdit(medicine) {
  editingMedicineId = medicine.id;
  document.getElementById('medicine-name').value = medicine.name;
  document.getElementById('medicine-form-type').value = medicine.form;
  medicineFormTitle.textContent = 'Edit medicine';
  medicineSubmit.textContent = 'Save changes';
  cancelMedicineEdit.hidden = false;
  document.getElementById('add-medicine-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelMedicineEditing() {
  editingMedicineId = null;
  document.getElementById('add-medicine-form').reset();
  medicineFormTitle.textContent = 'Add a medicine';
  medicineSubmit.textContent = 'Add medicine';
  cancelMedicineEdit.hidden = true;
}

async function loadMedicines() {
  const response = await fetch('/medicines');
  const body = await response.json();

  if (!response.ok) {
    Velora.toast(body.error || 'Could not load medicines.', 'error');
    return;
  }

  medicines = body;
  medicineRows.replaceChildren();

  medicines.forEach((medicine) => {
    const tr = document.createElement('tr');

    const id = document.createElement('td');
    id.setAttribute('data-label', 'ID');
    id.textContent = String(medicine.id);
    tr.appendChild(id);

    const name = document.createElement('td');
    name.setAttribute('data-label', 'Name');
    name.textContent = medicine.name;
    tr.appendChild(name);

    const form = document.createElement('td');
    form.setAttribute('data-label', 'Form');
    form.textContent = medicine.form;
    tr.appendChild(form);

    const actions = document.createElement('td');
    actions.setAttribute('data-label', 'Actions');
    const actionWrap = document.createElement('div');
    actionWrap.className = 'table-actions';
    actionWrap.appendChild(actionButton('Edit', '', () => startMedicineEdit(medicine)));
    actionWrap.appendChild(actionButton('Delete', 'danger', async () => {
      const confirmed = await confirmDelete('Delete ' + medicine.name + '? This is blocked if any pharmacy still stocks it.');
      if (!confirmed) return;

      const deleteResponse = await fetch('/medicines/' + encodeURIComponent(medicine.id), { method: 'DELETE' });
      if (deleteResponse.status === 204) {
        Velora.toast('Medicine deleted.', 'success');
        cancelMedicineEditing();
        await loadMedicines();
        return;
      }

      const deleteBody = await deleteResponse.json().catch(() => ({}));
      Velora.toast(deleteBody.error || 'Could not delete the medicine.', 'error');
    }));
    actions.appendChild(actionWrap);
    tr.appendChild(actions);

    medicineRows.appendChild(tr);
  });

  medicineEmpty.hidden = medicines.length !== 0;
  setOptions(stockMedicine, medicines, 'id', (medicine) => medicine.name + ' (' + medicine.form + ')');
  applyFilter();
  updateStats(stockRows.children.length, Array.from(stockRows.children).filter((row) => row.classList.contains('low-row')).length);
}

function setPharmacyState(state) {
  if (state === 'ready') {
    pharmacyPanel.hidden = false;
    pharmacyEmpty.hidden = true;
    stockFormPanel.hidden = false;
    stockSection.hidden = false;
    catalogueGrid.classList.remove('single');
    return;
  }

  pharmacyPanel.hidden = true;
  pharmacyEmpty.hidden = false;
  catalogueGrid.classList.add('single');
  stockFormPanel.hidden = true;
  stockSection.hidden = true;
  stockRows.replaceChildren();
  stockEmpty.hidden = true;
  stockCount.textContent = '0 rows';
  updateStats(0, 0);
}

async function loadPharmacy() {
  const response = await fetch('/pharmacies/mine');

  if (response.status === 403) {
    setDenied('This workspace is for pharmacy owners. Your account can still search and reserve medicine.');
    return;
  }

  if (response.status === 404) {
    myPharmacy = null;
    setPharmacyState('none');
    return;
  }

  const body = await response.json();

  if (!response.ok) {
    Velora.toast(body.error || 'Could not load your pharmacy.', 'error');
    return;
  }

  myPharmacy = body;
  pharmacyName.textContent = body.name;
  pharmacyMeta.textContent = body.area + ' · ' + body.status + ' · licence ' + body.licenceNumber;
  publicPharmacyLink.href = '/pharmacy.html?id=' + encodeURIComponent(body.id);
  stockPharmacyLabel.textContent = 'Adding stock to ' + body.name + '.';
  setPharmacyState('ready');
  await loadStock();
}

function startStockEdit(row) {
  editingStockId = row.id;
  stockMedicine.value = String(row.medicineId);
  stockMedicine.disabled = true;
  stockQuantity.value = String(row.quantity);
  stockPrice.value = (row.pricePaise / 100).toFixed(2);
  stockFormTitle.textContent = 'Edit stock';
  stockSubmit.textContent = 'Save changes';
  cancelStockEdit.hidden = false;
  document.getElementById('add-stock-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelStockEditing() {
  editingStockId = null;
  document.getElementById('add-stock-form').reset();
  stockMedicine.disabled = false;
  stockFormTitle.textContent = 'Add stock';
  stockSubmit.textContent = 'Add stock';
  cancelStockEdit.hidden = true;
}

async function loadStock() {
  if (!myPharmacy) return;

  const response = await fetch('/stock?pharmacyId=' + encodeURIComponent(myPharmacy.id));
  const body = await response.json();

  if (!response.ok) {
    Velora.toast(body.error || 'Could not load stock.', 'error');
    return;
  }

  stockRows.replaceChildren();
  let low = 0;

  body.forEach((row) => {
    const tr = document.createElement('tr');
    if (row.quantity <= 5) {
      tr.classList.add('low-row');
      low += 1;
    }

    const medicine = document.createElement('td');
    medicine.setAttribute('data-label', 'Medicine');
    medicine.textContent = row.medicine ? row.medicine.name : 'Unknown';
    tr.appendChild(medicine);

    const form = document.createElement('td');
    form.setAttribute('data-label', 'Form');
    form.textContent = row.medicine ? row.medicine.form : '—';
    tr.appendChild(form);

    const quantity = document.createElement('td');
    quantity.setAttribute('data-label', 'Quantity');
    quantity.textContent = String(row.quantity);
    if (row.quantity <= 5) {
      const badge = document.createElement('span');
      badge.className = 'low-pill';
      badge.textContent = row.quantity === 0 ? 'Out' : 'Low';
      quantity.appendChild(document.createTextNode(' '));
      quantity.appendChild(badge);
    }
    tr.appendChild(quantity);

    const price = document.createElement('td');
    price.setAttribute('data-label', 'Price');
    price.textContent = Velora.formatPrice(row.pricePaise);
    tr.appendChild(price);

    const actions = document.createElement('td');
    actions.setAttribute('data-label', 'Actions');
    const actionWrap = document.createElement('div');
    actionWrap.className = 'table-actions';
    actionWrap.appendChild(actionButton('Edit', '', () => startStockEdit(row)));
    actionWrap.appendChild(actionButton('Delete', 'danger', async () => {
      const name = row.medicine ? row.medicine.name : 'this stock row';
      const confirmed = await confirmDelete('Remove ' + name + ' from your stock?');
      if (!confirmed) return;

      const deleteResponse = await fetch('/stock/' + encodeURIComponent(row.id), { method: 'DELETE' });
      if (deleteResponse.status === 204) {
        Velora.toast('Stock row deleted.', 'success');
        cancelStockEditing();
        await loadStock();
        return;
      }

      const deleteBody = await deleteResponse.json().catch(() => ({}));
      Velora.toast(deleteBody.error || 'Could not delete the stock row.', 'error');
    }));
    actions.appendChild(actionWrap);
    tr.appendChild(actions);

    stockRows.appendChild(tr);
  });

  stockEmpty.hidden = body.length !== 0;
  stockCount.textContent = body.length + (body.length === 1 ? ' row' : ' rows');
  updateStats(body.length, low);
}

document.getElementById('add-medicine-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('medicine-name').value.trim();
  const dosageForm = document.getElementById('medicine-form-type').value.trim();
  const editing = editingMedicineId !== null;
  const url = editing ? '/medicines/' + encodeURIComponent(editingMedicineId) : '/medicines';

  const response = await fetch(url, {
    method: editing ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, form: dosageForm }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    Velora.toast(body.error || 'Could not save the medicine.', 'error');
    return;
  }

  Velora.toast(editing ? 'Medicine updated.' : 'Medicine #' + body.id + ' added.', 'success');
  cancelMedicineEditing();
  await loadMedicines();
});

cancelMedicineEdit.addEventListener('click', cancelMedicineEditing);

document.getElementById('add-stock-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!myPharmacy) {
    Velora.toast('Register a pharmacy before adding stock.', 'error');
    return;
  }

  const medicineId = Number(stockMedicine.value);
  const quantity = Number(stockQuantity.value);
  const price = Number(stockPrice.value);
  const pricePaise = Math.round(price * 100);
  const editing = editingStockId !== null;

  if (!Number.isInteger(medicineId) || !Number.isInteger(quantity) || quantity < 0 ||
      !Number.isFinite(price) || pricePaise <= 0) {
    Velora.toast('Choose a medicine, then enter a quantity and a price.', 'error');
    return;
  }

  const url = editing ? '/stock/' + encodeURIComponent(editingStockId) : '/stock';
  const payload = editing
    ? { quantity: quantity, pricePaise: pricePaise }
    : { pharmacyId: myPharmacy.id, medicineId: medicineId, quantity: quantity, pricePaise: pricePaise };

  const response = await fetch(url, {
    method: editing ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    setDenied('Your session expired. Log in again.');
    return;
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    Velora.toast(body.error || 'Could not save the stock row.', 'error');
    return;
  }

  Velora.toast(editing ? 'Stock updated.' : 'Stock added: ' + body.medicine.name + '.', 'success');
  cancelStockEditing();
  await loadStock();
});

cancelStockEdit.addEventListener('click', cancelStockEditing);
medicineFilter.addEventListener('input', applyFilter);

function setDenied(text) {
  deniedText.textContent = text;
  denied.hidden = false;
  workspace.hidden = true;
}

async function loadRole() {
  const response = await fetch('/auth/me');

  if (!response.ok) {
    setDenied('Log in with a pharmacy account to manage stock.');
    return false;
  }

  const user = await response.json();

  if (user.accountType !== 'PHARMACY') {
    setDenied('This workspace is for pharmacy owners. Your customer account can search and reserve medicine.');
    return false;
  }

  denied.hidden = true;
  workspace.hidden = false;
  return true;
}

async function loadAll() {
  const allowed = await loadRole();
  if (!allowed) return;

  await loadMedicines();
  await loadPharmacy();
}

loadAll();
