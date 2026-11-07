const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data.json');
const salesPath = path.join(__dirname, 'sales.csv');

// A user-created module: read the small JSON and open the large CSV as a stream.
function readAll() {
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

function readStream() {
  return fs.createReadStream(salesPath);
}

module.exports = {
  readAll,
  readStream,
  dataPath,
  salesPath,
};
