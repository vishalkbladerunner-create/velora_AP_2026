const crypto = require('crypto');

// RFC 4648 base32, used by authenticator apps.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DIGITS = 6;
const PERIOD_SECONDS = 30;

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(value) {
  const clean = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let current = 0;
  const bytes = [];

  for (const character of clean) {
    const index = ALPHABET.indexOf(character);

    if (index === -1) {
      continue;
    }

    current = (current << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const digest = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1000000).padStart(DIGITS, '0');
}

// Accept the previous and next 30-second window to allow for clock drift.
function verify(secret, token) {
  if (!secret || !/^[0-9]{6}$/.test(String(token || ''))) {
    return false;
  }

  const counter = Math.floor(Date.now() / (PERIOD_SECONDS * 1000));

  for (let offset = -1; offset <= 1; offset += 1) {
    if (hotp(secret, counter + offset) === String(token)) {
      return true;
    }
  }

  return false;
}

function otpauthUrl(secret, accountName) {
  const label = encodeURIComponent('Velora:' + accountName);

  return 'otpauth://totp/' + label +
    '?secret=' + secret +
    '&issuer=Velora' +
    '&algorithm=SHA1' +
    '&digits=' + DIGITS +
    '&period=' + PERIOD_SECONDS;
}

module.exports = {
  generateSecret,
  verify,
  otpauthUrl,
  hotp,
};
