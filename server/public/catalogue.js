const messageEl = document.getElementById('catalogue-message');
const medicineRows = document.getElementById('medicine-rows');
const medicineEmpty = document.getElementById('medicine-empty');
const stockRows = document.getElementById('stock-rows');
const stockEmpty = document.getElementById('stock-empty');
const stockMedicine = document.getElementById('stock-medicine');
const stockQuantity = document.getElementById('stock-quantity');
const stockPrice = document.getElementById('stock-price');
const stockForm = document.getElementById('add-stock-form');
const stockSection = document.getElementById('stock-section');
const stockPharmacyLabel = document.getElementById('stock-pharmacy-label');
const pharmacyPanel = document.getElementById('pharmacy-panel');
const pharmacyName = document.getElementById('pharmacy-name');
const pharmacyMeta = document.getElementById('pharmacy-meta');
const pharmacyEmpty = document.getElementById('pharmacy-empty');
const pharmacyLogin = document.getElementById('pharmacy-login');
const pharmacyLoginLink = document.getElementById('pharmacy-login-link');

let myPharmacy = null;

function showMessage(text, kind) {
  messageEl.textContent = text;
  messageEl.className = 'state state-' + kind;
  messageEl.hidden = false;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function formatPrice(paise) {
  return '₹' + (paise / 100).toFixed(2);
}

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

async function loadMedicines() {
  const response = await fetch('/medicines');
  const medicines = await readJson(response);

  if (!response.ok) {
    showMessage(medicines.error || 'Could not load medicines.', 'error');
    return;
  }

  medicineRows.replaceChildren();
  medicineEmpty.hidden = medicines.length !== 0;

  medicines.forEach((medicine) => {
    const tr = document.createElement('tr');

    const id = document.createElement('td');
    id.textContent = String(medicine.id);
    tr.appendChild(id);

    const name = document.createElement('td');
    name.textContent = medicine.name;
    tr.appendChild(name);

    const form = document.createElement('td');
    form.textContent = medicine.form;
    tr.appendChild(form);

    medicineRows.appendChild(tr);
  });

  setOptions(stockMedicine, medicines, 'id', (medicine) => {
    return medicine.name + ' (' + medicine.form + ')';
  });
}

function showPharmacyState(state) {
  stockRows.replaceChildren();
  stockEmpty.hidden = true;

  if (state === 'ready') {
    pharmacyPanel.hidden = false;
    pharmacyEmpty.hidden = true;
    pharmacyLogin.hidden = true;
    stockForm.hidden = false;
    stockSection.hidden = false;
    return;
  }

  pharmacyPanel.hidden = true;
  stockForm.hidden = true;
  stockSection.hidden = true;

  if (state === 'login') {
    pharmacyEmpty.hidden = true;
    pharmacyLoginLink.textContent = 'Log in or create an account';
    pharmacyLogin.hidden = false;
    return;
  }

  pharmacyEmpty.textContent = 'No pharmacy registered for this account. Register one in your account to add stock.';
  pharmacyEmpty.hidden = false;
  pharmacyLoginLink.textContent = 'Open your account';
  pharmacyLogin.hidden = false;
}

async function loadMyPharmacy() {
  const response = await fetch('/pharmacies/mine');

  if (response.status === 401) {
    myPharmacy = null;
    showPharmacyState('login');
    return;
  }

  if (response.status === 404) {
    myPharmacy = null;
    showPharmacyState('none');
    return;
  }

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not load your pharmacy.', 'error');
    return;
  }

  myPharmacy = body;
  pharmacyName.textContent = body.name;
  pharmacyMeta.textContent = body.area + ' · ' + body.status + ' · licence ' + body.licenceNumber;
  stockPharmacyLabel.textContent = 'Adding stock to ' + body.name + '.';
  showPharmacyState('ready');
  await loadStock();
}

async function loadStock() {
  if (!myPharmacy) {
    return;
  }

  const response = await fetch('/stock?pharmacyId=' + encodeURIComponent(myPharmacy.id));
  const rows = await readJson(response);

  if (!response.ok) {
    showMessage(rows.error || 'Could not load stock.', 'error');
    return;
  }

  stockRows.replaceChildren();
  stockEmpty.hidden = rows.length !== 0;

  rows.forEach((row) => {
    const tr = document.createElement('tr');

    const medicine = document.createElement('td');
    medicine.textContent = row.medicine ? row.medicine.name : 'Unknown';
    tr.appendChild(medicine);

    const form = document.createElement('td');
    form.textContent = row.medicine ? row.medicine.form : '—';
    tr.appendChild(form);

    const quantity = document.createElement('td');
    quantity.textContent = String(row.quantity);
    tr.appendChild(quantity);

    const price = document.createElement('td');
    price.textContent = formatPrice(row.pricePaise);
    tr.appendChild(price);

    stockRows.appendChild(tr);
  });
}

document.getElementById('add-medicine-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('medicine-name').value.trim();
  const dosageForm = document.getElementById('medicine-form-type').value.trim();

  const response = await fetch('/medicines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, form: dosageForm }),
  });

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not add the medicine.', 'error');
    return;
  }

  event.target.reset();
  showMessage('Medicine #' + body.id + ' added.', 'success');
  await loadMedicines();
});

stockForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!myPharmacy) {
    showMessage('Register a pharmacy before adding stock.', 'error');
    return;
  }

  const medicineId = Number(stockMedicine.value);
  const quantity = Number(stockQuantity.value);
  const price = Number(stockPrice.value);
  const pricePaise = Math.round(price * 100);

  if (!Number.isInteger(medicineId) || !Number.isInteger(quantity) || quantity < 0 ||
      !Number.isFinite(price) || pricePaise <= 0) {
    showMessage('Choose a medicine, then enter a quantity and a price.', 'error');
    return;
  }

  const response = await fetch('/stock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pharmacyId: myPharmacy.id,
      medicineId: medicineId,
      quantity: quantity,
      pricePaise: pricePaise,
    }),
  });

  if (response.status === 401) {
    myPharmacy = null;
    showPharmacyState('login');
    showMessage('Your session expired. Log in again.', 'error');
    return;
  }

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not add the stock.', 'error');
    return;
  }

  showMessage('Stock added: ' + body.medicine.name + ' at ' + myPharmacy.name + '.', 'success');
  await loadStock();
});

async function loadAll() {
  await loadMedicines();
  await loadMyPharmacy();
}

loadAll();
