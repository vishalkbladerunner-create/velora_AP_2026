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

function showError(text) {
  message.textContent = text;
  message.className = 'state state-error';
  message.hidden = false;
  detail.hidden = true;
}

function formatPrice(paise) {
  return '₹' + (paise / 100).toFixed(2);
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
