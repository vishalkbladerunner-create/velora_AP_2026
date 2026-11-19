const form = document.getElementById('search-form');
const gate = document.getElementById('search-gate');
const input = document.getElementById('medicine');
const button = document.getElementById('search-button');
const list = document.getElementById('result-list');
const message = document.getElementById('state-message');
const count = document.getElementById('result-count');
const resultsSection = document.getElementById('results');

let signedIn = false;

function setLocked() {
  signedIn = false;
  form.hidden = true;
  gate.hidden = false;
  resultsSection.hidden = true;
  count.textContent = '';
}

function setState(text, kind) {
  message.textContent = text;
  message.className = 'state state-' + kind;
  message.hidden = false;
  list.hidden = true;
  list.replaceChildren();
  count.textContent = '';
}

function createCard(pharmacy, index) {
  const item = document.createElement('li');
  item.className = 'result-card';

  const head = document.createElement('div');
  head.className = 'result-head';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'result-title';

  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = '/pharmacy.html?id=' + encodeURIComponent(pharmacy.id);
  link.textContent = pharmacy.name;
  heading.appendChild(link);
  titleWrap.appendChild(heading);

  const area = document.createElement('p');
  area.className = 'result-area';
  area.textContent = pharmacy.area + ' · ' + pharmacy.address;
  titleWrap.appendChild(area);

  const badges = document.createElement('div');
  badges.className = 'result-badges';

  const verified = document.createElement('span');
  verified.className = 'pill-verified';
  verified.textContent = 'Verified';
  badges.appendChild(verified);

  if (index === 0) {
    const cheapest = document.createElement('span');
    cheapest.className = 'badge-cheapest';
    cheapest.textContent = 'Cheapest';
    badges.appendChild(cheapest);
  }

  const distance = document.createElement('span');
  distance.className = 'distance-pill';
  distance.textContent = Number(pharmacy.distanceKm || 0).toFixed(1) + ' km';
  distance.title = 'Sample distance from the stored account address';
  badges.appendChild(distance);

  head.appendChild(titleWrap);
  head.appendChild(badges);
  item.appendChild(head);

  const stock = document.createElement('ul');
  stock.className = 'stock-list';

  pharmacy.stock.forEach((row) => {
    const line = document.createElement('li');
    line.className = 'stock-row';

    const medicine = document.createElement('span');
    medicine.className = 'stock-med';
    medicine.textContent = row.medicine ? row.medicine.name : 'Medicine';
    line.appendChild(medicine);

    const quantity = document.createElement('span');
    quantity.className = 'qty-pill' + (row.quantity <= 5 ? ' qty-low' : '');
    quantity.textContent = row.quantity + ' in stock';
    line.appendChild(quantity);

    const price = document.createElement('strong');
    price.className = 'price';
    price.textContent = Velora.formatPrice(row.pricePaise);
    line.appendChild(price);

    stock.appendChild(line);
  });

  item.appendChild(stock);

  const foot = document.createElement('div');
  foot.className = 'result-foot';

  const phone = document.createElement('a');
  phone.className = 'phone-link';
  phone.href = 'tel:' + pharmacy.phone;
  phone.textContent = pharmacy.phone;
  foot.appendChild(phone);

  const view = document.createElement('a');
  view.className = 'text-link';
  view.href = '/pharmacy.html?id=' + encodeURIComponent(pharmacy.id);
  view.textContent = 'View pharmacy →';
  foot.appendChild(view);

  item.appendChild(foot);
  return item;
}

function revealResults() {
  resultsSection.hidden = false;
  resultsSection.classList.remove('is-live');
  void resultsSection.offsetWidth;
  resultsSection.classList.add('is-live');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderResults(pharmacies) {
  list.replaceChildren();
  pharmacies.forEach((pharmacy, index) => {
    list.appendChild(createCard(pharmacy, index));
  });

  count.textContent = pharmacies.length + (pharmacies.length === 1 ? ' pharmacy' : ' pharmacies') + ' · cheapest first';
  message.hidden = true;
  list.hidden = false;
  revealResults();
}

async function search(term) {
  if (!signedIn) {
    setLocked();
    return;
  }

  button.disabled = true;
  button.classList.add('is-loading');
  setState('Searching for “' + term + '”…', 'loading');

  const url = new URL(window.location.href);
  url.searchParams.set('q', term);
  window.history.replaceState(null, '', url);

  try {
    const response = await fetch('/pharmacies?medicine=' + encodeURIComponent(term));
    if (response.status === 401) {
      setLocked();
      return;
    }

    const body = await response.json();

    if (!response.ok) {
      setState(body.error || 'The search failed. Try again.', 'error');
      return;
    }

    if (!Array.isArray(body) || body.length === 0) {
      setState('No verified pharmacy currently stocks “' + term + '”. Try another spelling or ask the pharmacy.', 'empty');
      return;
    }

    renderResults(body);
  } catch (error) {
    setState('Could not reach the API. Check that the server is running.', 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('is-loading');
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

document.querySelectorAll('[data-term]').forEach((chip) => {
  chip.addEventListener('click', () => {
    const term = chip.getAttribute('data-term');
    input.value = term;
    search(term);
  });
});

async function init() {
  try {
    const response = await fetch('/auth/me');
    if (!response.ok) {
      setLocked();
      return;
    }

    signedIn = true;
    form.hidden = false;
    gate.hidden = true;
    resultsSection.hidden = false;

    const initialTerm = new URLSearchParams(window.location.search).get('q');
    if (initialTerm) {
      input.value = initialTerm;
      search(initialTerm);
    }
  } catch (error) {
    setLocked();
  }
}

init();
