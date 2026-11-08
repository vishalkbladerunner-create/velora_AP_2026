const form = document.getElementById('search-form');
const input = document.getElementById('medicine');
const button = document.getElementById('search-button');
const results = document.getElementById('result-list');
const message = document.getElementById('state-message');

function setState(text, kind) {
  message.textContent = text;
  message.className = 'state state-' + kind;
  message.hidden = false;
  results.hidden = true;
  results.innerHTML = '';
}

function formatPrice(paise) {
  return '₹' + (paise / 100).toFixed(2);
}

function renderResults(pharmacies) {
  results.innerHTML = '';

  pharmacies.forEach((pharmacy) => {
    const item = document.createElement('li');
    item.className = 'card';

    const heading = document.createElement('h2');
    heading.textContent = pharmacy.name;
    item.appendChild(heading);

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = pharmacy.area + ' · ' + pharmacy.address;
    item.appendChild(meta);

    const list = document.createElement('ul');
    list.className = 'stock';

    pharmacy.stock.forEach((row) => {
      const entry = document.createElement('li');

      const quantity = document.createElement('span');
      quantity.className = 'qty';
      quantity.textContent = row.medicine.name + ' · ' + row.quantity + ' in stock';

      const price = document.createElement('span');
      price.className = 'price';
      price.textContent = formatPrice(row.pricePaise);

      entry.appendChild(quantity);
      entry.appendChild(price);
      list.appendChild(entry);
    });

    item.appendChild(list);
    results.appendChild(item);
  });

  message.hidden = true;
  results.hidden = false;
}

async function search(term) {
  button.disabled = true;
  setState('Searching…', 'loading');

  try {
    const response = await fetch('/pharmacies?medicine=' + encodeURIComponent(term));
    const body = await response.json();

    if (!response.ok) {
      setState(body.error || 'The search failed. Try again.', 'error');
      return;
    }

    if (!Array.isArray(body) || body.length === 0) {
      setState('No verified pharmacy currently stocks that medicine.', 'empty');
      return;
    }

    renderResults(body);
  } catch (error) {
    setState('Could not reach the API. Check that the server is running.', 'error');
  } finally {
    button.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const term = input.value.trim();

  if (term === '') {
    setState('Type a medicine name first.', 'error');
    return;
  }

  search(term);
});
