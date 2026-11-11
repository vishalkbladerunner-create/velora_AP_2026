const fs = require('fs');
const path = require('path');
const helper = require('./helper');

const section = process.argv[2] || 'all';

function readSync() {
  const start = Date.now();
  const data = helper.readAll();
  console.log('readFileSync: ' + (Date.now() - start) + 'ms, ' + data.medicines.length + ' medicines');
}

function readCallback() {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    fs.readFile(helper.dataPath, 'utf8', (error, raw) => {
      if (error) {
        reject(error);
        return;
      }

      const data = JSON.parse(raw);
      console.log('readFile callback: ' + (Date.now() - start) + 'ms, ' + data.medicines.length + ' medicines');
      resolve();
    });
  });
}

async function readPromise() {
  const start = Date.now();
  const raw = await fs.promises.readFile(helper.dataPath, 'utf8');
  const data = JSON.parse(raw);
  console.log('fs.promises.readFile: ' + (Date.now() - start) + 'ms, ' + data.medicines.length + ' medicines');
}

function streamCount() {
  return new Promise((resolve, reject) => {
    const stream = helper.readStream();
    let chunks = 0;
    let bytes = 0;
    let rows = 0;
    let carry = '';

    stream.on('data', (chunk) => {
      chunks++;
      bytes += chunk.length;
      carry += chunk.toString();

      // Keep the last partial line for the next chunk.
      const lines = carry.split('\n');
      carry = lines.pop();
      rows += lines.length;

      console.log('chunk ' + chunks + ': ' + chunk.length + ' bytes');
    });

    stream.on('end', () => {
      if (carry.length > 0) {
        rows++;
      }
      console.log('stream total: ' + chunks + ' chunks, ' + bytes + ' bytes, ' + rows + ' rows');
      resolve();
    });

    stream.on('error', reject);
  });
}

function pipeCopy() {
  return new Promise((resolve, reject) => {
    const copyPath = path.join(__dirname, 'sales-copy.csv');
    const source = helper.readStream();
    const target = fs.createWriteStream(copyPath);

    source.pipe(target);

    target.on('finish', () => {
      const size = fs.statSync(copyPath).size;
      console.log('pipe copy: ' + size + ' bytes written to sales-copy.csv');
      fs.unlinkSync(copyPath);
      resolve();
    });

    source.on('error', reject);
    target.on('error', reject);
  });
}

async function main() {
  console.log('section: ' + section);

  // "summary" is an alias for the synchronous read.
  if (section === 'all' || section === 'sync' || section === 'summary') {
    readSync();
  }
  if (section === 'all' || section === 'callback') {
    await readCallback();
  }
  if (section === 'all' || section === 'promise') {
    await readPromise();
  }
  if (section === 'all' || section === 'stream') {
    await streamCount();
  }
  if (section === 'all' || section === 'pipe') {
    await pipeCopy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
