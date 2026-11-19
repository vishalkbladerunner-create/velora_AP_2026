const messageEl = document.getElementById('catalogue-message');
const medicineRows = document.getElementById('medicine-rows');
const medicineEmpty = document.getElementById('medicine-empty');
const pharmacyRows = document.getElementById('pharmacy-rows');
const pharmacyEmpty = document.getElementById('pharmacy-empty');
const stockRows = document.getElementById('stock-rows');
const stockEmpty = document.getElementById('stock-empty');
const stockPharmacy = document.getElementById('stock-pharmacy');
const stockMedicine = document.getElementById('stock-medicine');
const stockQuantity = document.getElementById('stock-quantity');
const stockPrice = document.getElementById('stock-price');

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

async function loadPharmacies() {
  const response = await fetch('/pharmacies');
  const pharmacies = await readJson(response);

  if (!response.ok) {
    showMessage(pharmacies.error || 'Could not load pharmacies.', 'error');
    return;
  }

  pharmacyRows.replaceChildren();
  pharmacyEmpty.hidden = pharmacies.length !== 0;

  pharmacies.forEach((pharmacy) => {
    const tr = document.createElement('tr');

    const id = document.createElement('td');
    id.textContent = String(pharmacy.id);
    tr.appendChild(id);

    const name = document.createElement('td');
    name.textContent = pharmacy.name;
    tr.appendChild(name);

    const area = document.createElement('td');
    area.textContent = pharmacy.area;
    tr.appendChild(area);

    pharmacyRows.appendChild(tr);
  });

  setOptions(stockPharmacy, pharmacies, 'id', (pharmacy) => {
    return pharmacy.name + ' · ' + pharmacy.area;
  });
}

async function loadStock() {
  const pharmacyId = stockPharmacy.value;

  stockRows.replaceChildren();

  if (!pharmacyId) {
    stockEmpty.textContent = 'Add a verified pharmacy first.';
    stockEmpty.hidden = false;
    return;
  }

  const response = await fetch('/stock?pharmacyId=' + encodeURIComponent(pharmacyId));
  const rows = await readJson(response);

  if (!response.ok) {
    showMessage(rows.error || 'Could not load stock.', 'error');
    return;
  }

  stockEmpty.textContent = 'No stock at this pharmacy.';
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

document.getElementById('add-pharmacy-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const body = {
    name: document.getElementById('pharmacy-name').value.trim(),
    area: document.getElementById('pharmacy-area').value.trim(),
    address: document.getElementById('pharmacy-address').value.trim(),
    phone: document.getElementById('pharmacy-phone').value.trim(),
    licenceNumber: document.getElementById('pharmacy-licence').value.trim(),
  };

  const response = await fetch('/catalogue/pharmacies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const created = await readJson(response);

  if (!response.ok) {
    showMessage(created.error || 'Could not add the pharmacy.', 'error');
    return;
  }

  event.target.reset();
  showMessage('Pharmacy #' + created.id + ' added and verified.', 'success');
  await loadPharmacies();
});

document.getElementById('add-stock-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const pharmacyId = Number(stockPharmacy.value);
  const medicineId = Number(stockMedicine.value);
  const quantity = Number(stockQuantity.value);
  const price = Number(stockPrice.value);
  const pricePaise = Math.round(price * 100);

  if (!Number.isInteger(pharmacyId) || !Number.isInteger(medicineId) ||
      !Number.isInteger(quantity) || quantity < 0 ||
      !Number.isFinite(price) || pricePaise <= 0) {
    showMessage('Choose a pharmacy and medicine, then enter a quantity and a price.', 'error');
    return;
  }

  const response = await fetch('/stock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pharmacyId: pharmacyId,
      medicineId: medicineId,
      quantity: quantity,
      pricePaise: pricePaise,
    }),
  });

  const body = await readJson(response);

  if (!response.ok) {
    showMessage(body.error || 'Could not add the stock.', 'error');
    return;
  }

  const pharmacyName = stockPharmacy.options[stockPharmacy.selectedIndex].textContent;
  showMessage('Stock added: ' + body.medicine.name + ' at ' + pharmacyName + '.', 'success');
  await loadStock();
});

stockPharmacy.addEventListener('change', loadStock);

async function loadAll() {
  await Promise.all([loadMedicines(), loadPharmacies()]);
  await loadStock();
}

loadAll();
