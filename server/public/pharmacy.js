const params = new URLSearchParams(window.location.search);
const id = params.get('id');
const nextPath = '/account.html?next=' + encodeURIComponent(window.location.pathname + window.location.search);

const message = document.getElementById('state-message');
const detail = document.getElementById('pharmacy-detail');
const nameEl = document.getElementById('pharmacy-name');
const metaEl = document.getElementById('pharmacy-meta');
const areaEl = document.getElementById('pharmacy-area');
const addressEl = document.getElementById('pharmacy-address');
const phoneEl = document.getElementById('pharmacy-phone');
const phoneLink = document.getElementById('pharmacy-phone-link');
const distanceEl = document.getElementById('pharmacy-distance');
const licenceEl = document.getElementById('pharmacy-licence');
const stockTable = document.getElementById('stock-table');
const stockRows = document.getElementById('stock-rows');
const stockEmpty = document.getElementById('stock-empty');
const stockSummary = document.getElementById('stock-summary');
const accountLink = document.getElementById('account-link');

let currentUser = null;

function showError(text) {
  message.textContent = text;
  message.className = 'state state-error';
  message.hidden = false;
  detail.hidden = true;
}

function setAccountLink() {
  if (currentUser) {
    accountLink.textContent = 'Manage your account';
    accountLink.href = '/account.html';
  } else {
    accountLink.textContent = 'Log in to reserve';
    accountLink.href = nextPath;
  }
}

Velora.api('/api/v1/auth/me')
  .then((response) => (response.ok ? response.json() : null))
  .then((user) => {
    currentUser = user;
    setAccountLink();
  })
  .catch(() => setAccountLink());

function makeStepper(max) {
  const wrap = document.createElement('div');
  wrap.className = 'stepper';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'stepper-btn';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Decrease quantity');

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'stepper-input';
  input.min = '0';
  input.max = String(max);
  input.value = '0';
  input.setAttribute('aria-label', 'Quantity to reserve');

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'stepper-btn';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Increase quantity');

  minus.addEventListener('click', () => {
    input.value = String(Math.max(0, Number(input.value) - 1));
    input.dispatchEvent(new Event('input'));
  });
  plus.addEventListener('click', () => {
    input.value = String(Math.min(max, Number(input.value) + 1));
    input.dispatchEvent(new Event('input'));
  });
  input.addEventListener('input', () => {
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < 0) {
      input.value = '0';
    } else if (value > max) {
      input.value = String(max);
    }
  });

  wrap.append(minus, input, plus);
  return { wrap, input };
}

async function reserve(stockItemId, quantityValue, button) {
  if (!currentUser) {
    window.location.href = nextPath;
    return;
  }

  const quantity = Number(quantityValue);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    Velora.toast('Choose a positive quantity.', 'error');
    return;
  }

  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Reserving…';

  try {
    const response = await Velora.api('/api/v1/holds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockItemId: stockItemId, quantity: quantity }),
    });

    if (response.status === 401) {
      window.location.href = nextPath;
      return;
    }

    let body = {};
    try {
      body = await response.json();
    } catch (error) {
      body = {};
    }

    if (!response.ok) {
      Velora.toast(body.error || 'Could not reserve the stock.', 'error');
      button.disabled = false;
      button.textContent = original;
      return;
    }

    Velora.toast('Reserved ' + quantity + '. Pick it up within 30 minutes.', 'success');
    await load();
  } catch (error) {
    Velora.toast('Could not reach the API.', 'error');
    button.disabled = false;
    button.textContent = original;
  }
}

function appendCell(row, label, content) {
  const cell = document.createElement('td');
  cell.setAttribute('data-label', label);
  if (content instanceof Node) {
    cell.appendChild(content);
  } else {
    cell.textContent = content;
  }
  row.appendChild(cell);
  return cell;
}

function render(pharmacy) {
  nameEl.textContent = pharmacy.name;
  metaEl.textContent = pharmacy.area + ' · ' + pharmacy.address;
  areaEl.textContent = pharmacy.area;
  addressEl.textContent = pharmacy.address;
  phoneEl.textContent = pharmacy.phone;
  phoneLink.href = 'tel:' + pharmacy.phone;
  distanceEl.textContent = Number(pharmacy.distanceKm || 0).toFixed(1) + ' km';
  distanceEl.title = 'Sample distance from the stored account address';
  licenceEl.textContent = pharmacy.licenceNumber;
  stockSummary.textContent = pharmacy.stock.length + (pharmacy.stock.length === 1 ? ' item' : ' items');

  stockRows.replaceChildren();

  if (!pharmacy.stock || pharmacy.stock.length === 0) {
    stockEmpty.hidden = false;
    stockTable.hidden = true;
  } else {
    stockEmpty.hidden = true;
    stockTable.hidden = false;

    pharmacy.stock.forEach((row) => {
      const tr = document.createElement('tr');

      const medicine = document.createElement('td');
      medicine.setAttribute('data-label', 'Medicine');
      medicine.className = 'med-name';
      medicine.textContent = row.medicine ? row.medicine.name : 'Unknown';
      tr.appendChild(medicine);

      const form = document.createElement('td');
      form.setAttribute('data-label', 'Form');
      form.className = 'med-form';
      form.textContent = row.medicine ? row.medicine.form : '—';
      tr.appendChild(form);

      const quantityWrap = document.createElement('div');
      quantityWrap.textContent = String(row.quantity);
      if (row.quantity > 0 && row.quantity <= 5) {
        const low = document.createElement('span');
        low.className = 'badge-low';
        low.textContent = 'Only ' + row.quantity + ' left';
        quantityWrap.textContent = '';
        quantityWrap.appendChild(low);
      }
      appendCell(tr, 'Available', quantityWrap);

      appendCell(tr, 'Price', Velora.formatPrice(row.pricePaise));

      const reserveCell = document.createElement('td');
      reserveCell.setAttribute('data-label', 'Reserve');
      reserveCell.className = 'reserve-cell';

      if (row.quantity > 0) {
        const controls = document.createElement('div');
        controls.className = 'reserve-controls';
        const stepper = makeStepper(row.quantity);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-small btn-primary';
        button.textContent = 'Reserve';
        button.disabled = true;

        const syncButton = () => {
          const value = Number(stepper.input.value);
          button.disabled = !Number.isInteger(value) || value < 1;
        };
        stepper.input.addEventListener('input', syncButton);
        syncButton();

        button.addEventListener('click', () => reserve(row.id, stepper.input.value, button));
        controls.append(stepper.wrap, button);
        reserveCell.appendChild(controls);
      } else {
        const out = document.createElement('span');
        out.className = 'out-of-stock';
        out.textContent = 'Out of stock';
        reserveCell.appendChild(out);
      }

      tr.appendChild(reserveCell);
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
    const response = await Velora.api('/api/v1/pharmacies/' + encodeURIComponent(id));
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
