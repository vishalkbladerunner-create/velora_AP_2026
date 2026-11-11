const crypto = require('crypto');

const CALLS = 5;
const ITERATIONS = 150000;
const KEY_LENGTH = 32;

function startTimer(label, delay) {
  const start = Date.now();

  setTimeout(() => {
    console.log(label + ' fires after ' + (Date.now() - start) + 'ms');
  }, delay);
}

function syncWork(index) {
  const start = Date.now();
  crypto.pbkdf2Sync('velora', 'salt', ITERATIONS, KEY_LENGTH, 'sha256');
  console.log('blocking call ' + index + ': ' + (Date.now() - start) + 'ms');
}

function asyncWork(index) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    crypto.pbkdf2('velora', 'salt', ITERATIONS, KEY_LENGTH, 'sha256', (error) => {
      if (error) {
        reject(error);
        return;
      }

      console.log('async call ' + index + ': ' + (Date.now() - start) + 'ms');
      resolve();
    });
  });
}

async function main() {
  const poolSize = process.env.UV_THREADPOOL_SIZE ? process.env.UV_THREADPOOL_SIZE : '4 (default)';
  console.log('thread pool size: ' + poolSize);
  console.log('');

  console.log('--- blocking: pbkdf2Sync, one after another ---');
  startTimer('sync timer', 10);
  const syncStart = Date.now();

  for (let i = 1; i <= CALLS; i++) {
    syncWork(i);
  }

  const syncTotal = Date.now() - syncStart;
  console.log('sync total: ' + syncTotal + 'ms');
  console.log('');

  // Let the sync timer print before the next section starts.
  await new Promise((resolve) => setTimeout(resolve, 20));

  console.log('--- non-blocking: pbkdf2 on the thread pool ---');
  startTimer('async timer', 10);
  const asyncStart = Date.now();
  const jobs = [];

  for (let i = 1; i <= CALLS; i++) {
    jobs.push(asyncWork(i));
  }

  await Promise.all(jobs);
  const asyncTotal = Date.now() - asyncStart;
  console.log('async total: ' + asyncTotal + 'ms');
  console.log('');

  console.log('--- summary ---');
  console.log('blocking: ' + syncTotal + 'ms for ' + CALLS + ' calls');
  console.log('async   : ' + asyncTotal + 'ms for ' + CALLS + ' calls');
  console.log('ratio   : ' + (syncTotal / asyncTotal).toFixed(1) + 'x');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
