const form = document.getElementById('oauth-form');
const clientIdInput = document.getElementById('client-id');
const clientSecretInput = document.getElementById('client-secret');
const scopesInput = document.getElementById('scopes');
const redirectInput = document.getElementById('redirect-uri');
const resultPanel = document.getElementById('result-panel');
const resultStatus = document.getElementById('result-status');
const tokenOutput = document.getElementById('token-output');
const userinfoOutput = document.getElementById('userinfo-output');
const resetButton = document.getElementById('reset-button');

const STORAGE_KEY = 'velora_oauth_request';
const redirectUri = window.location.origin + '/developers.html';

redirectInput.value = redirectUri;

function base64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier() {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function showResult(title, text) {
  resultPanel.hidden = false;
  resultStatus.textContent = title;
  tokenOutput.textContent = text;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const clientId = clientIdInput.value.trim();
  const clientSecret = clientSecretInput.value;
  const scopes = scopesInput.value.trim();

  if (!clientId || !clientSecret || !scopes) {
    Velora.toast('Fill in the client ID, secret and scopes.', 'error');
    return;
  }

  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);
  const state = randomVerifier().slice(0, 16);

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    clientId: clientId,
    clientSecret: clientSecret,
    redirectUri: redirectUri,
    verifier: verifier,
  }));

  const url = new URL('/oauth/authorize', window.location.origin);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  window.location.href = url.toString();
});

async function exchangeCode(code) {
  const stored = sessionStorage.getItem(STORAGE_KEY);

  if (!stored) {
    showResult('Missing request', 'The PKCE verifier is gone. Start the authorization again.');
    return;
  }

  const request = JSON.parse(stored);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: request.redirectUri,
    code_verifier: request.verifier,
  });

  const response = await fetch('/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(request.clientId + ':' + request.clientSecret),
    },
    body: body.toString(),
  });

  const payload = await response.json();

  if (!response.ok) {
    showResult('Token error', JSON.stringify(payload, null, 2));
    return;
  }

  showResult('Tokens issued', JSON.stringify(payload, null, 2));

  if (payload.access_token) {
    const userinfo = await fetch('/oauth/userinfo', {
      headers: { Authorization: 'Bearer ' + payload.access_token },
    });
    const claims = await userinfo.json();
    userinfoOutput.textContent = JSON.stringify(claims, null, 2);
  }
}

resetButton.addEventListener('click', () => {
  resultPanel.hidden = true;
  tokenOutput.textContent = '';
  userinfoOutput.textContent = 'Not requested yet.';
  sessionStorage.removeItem(STORAGE_KEY);
});

(function start() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('error')) {
    showResult('Authorization denied', 'error=' + params.get('error') + (params.get('state') ? '\nstate=' + params.get('state') : ''));
    window.history.replaceState(null, '', '/developers.html');
    return;
  }

  const code = params.get('code');

  if (code) {
    exchangeCode(code);
    window.history.replaceState(null, '', '/developers.html');
  }
})();
