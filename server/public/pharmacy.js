const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const message = document.getElementById('state-message');
const detail = document.getElementById('pharmacy-detail');
const nameEl = document.getElementById('pharmacy-name');
const metaEl = document.getElementById('pharmacy-meta');
const areaEl = document.getElementById('pharmacy-area');
const addressEl = document.getElementById('pharmacy-address');
const phoneEl = document.getElementById('pharmacy-phone');
const licenceEl = document.getElementById('pharmacy-licence');
const stockEmptyEl = document.getElementById('stock-empty');
const stockTable = document.getElementById('stock-table');
const stockRows = document.getElementById('stock-rows');
const reserveMessage = document.getElementById('reserve-message');

let currentUser = null;

fetch('/auth/me')
  .then((response) => (response.ok ? response.json() : null))
  .then((user) => {
    currentUser = user;
  })
  .catch(() => {});

function showError(text) {
  message.textContent = text;
  message.className = 'state state-error';
  message.hidden = false;
  detail.hidden = true;
}

function formatPrice(paise) {
  return '₹' + (paise / 100).toFixed(2);
}

function showReserve(text, kind) {
  reserveMessage.textContent = text;
  reserveMessage.className = 'state state-' + kind;
  reserveMessage.hidden = false;
}

async function reserve(stockItemId, quantityValue) {
  if (!currentUser) {
    window.location.href = '/account.html';
    return;
  }

  const quantity = Number(quantityValue);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    showReserve('Choose a positive quantity.', 'error');
    return;
  }

  const response = await fetch('/holds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stockItemId: stockItemId, quantity: quantity }),
  });

  if (response.status === 401) {
    window.location.href = '/account.html';
    return;
  }

  let body = {};

  try {
    body = await response.json();
  } catch (error) {
    body = {};
  }

  if (!response.ok) {
    showReserve(body.error || 'Could not reserve the stock.', 'error');
    return;
  }

  showReserve('Reserved ' + quantity + '. Pick it up within 30 minutes.', 'success');
  await load();
}

function render(pharmacy) {
  nameEl.textContent = pharmacy.name;
  metaEl.textContent = pharmacy.area + ' · ' + pharmacy.address;
  areaEl.textContent = pharmacy.area;
  addressEl.textContent = pharmacy.address;
  phoneEl.textContent = pharmacy.phone;
  licenceEl.textContent = pharmacy.licenceNumber;

  stockRows.replaceChildren();

  if (!pharmacy.stock || pharmacy.stock.length === 0) {
    stockEmptyEl.hidden = false;
    stockTable.hidden = true;
  } else {
    stockEmptyEl.hidden = true;
    stockTable.hidden = false;

    pharmacy.stock.forEach((row) => {
      const tr = document.createElement('tr');

      const tdMedicine = document.createElement('td');
      tdMedicine.textContent = row.medicine ? row.medicine.name : 'Unknown';
      tr.appendChild(tdMedicine);

      const tdForm = document.createElement('td');
      tdForm.textContent = row.medicine ? row.medicine.form : '—';
      tr.appendChild(tdForm);

      const tdQty = document.createElement('td');
      tdQty.textContent = String(row.quantity);
      tr.appendChild(tdQty);

      const tdPrice = document.createElement('td');
      tdPrice.textContent = formatPrice(row.pricePaise);
      tr.appendChild(tdPrice);

      const tdReserve = document.createElement('td');
      tdReserve.className = 'reserve-cell';

      if (row.quantity > 0) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = String(row.quantity);
        input.value = '1';
        input.className = 'reserve-qty';
        input.setAttribute('aria-label', 'Quantity to reserve of ' + (row.medicine ? row.medicine.name : 'medicine'));

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'reserve-btn';
        button.textContent = 'Reserve';
        button.addEventListener('click', () => reserve(row.id, input.value));

        tdReserve.appendChild(input);
        tdReserve.appendChild(button);
      } else {
        tdReserve.textContent = '—';
      }

      tr.appendChild(tdReserve);

      stockRows.appendChild(tr);
    });
  }

  message.hidden = true;
  detail.hidden = false;
}

async function load() {
  if (!id) {
    showError('No pharmacy id in the address.');
    return;
  }

  try {
    const response = await fetch('/pharmacies/' + encodeURIComponent(id));
    const body = await response.json();

    if (response.status === 404) {
      showError('Pharmacy not found.');
      return;
    }

    if (!response.ok) {
      showError(body.error || 'Could not load the pharmacy.');
      return;
    }

    render(body);
  } catch (error) {
    showError('Could not reach the API. Check that the server is running.');
  }
}

load();
