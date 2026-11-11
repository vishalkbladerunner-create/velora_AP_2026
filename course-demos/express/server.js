const express = require('express');

const app = express();
const PORT = 3002;

let nextId = 3;
const medicines = [
  { id: 1, name: 'Paracetamol', form: 'tablet' },
  { id: 2, name: 'Ibuprofen', form: 'tablet' },
];

app.use(express.json());

function findMedicine(id) {
  return medicines.find((medicine) => medicine.id === id);
}

// GET /medicines?name=par
app.get('/medicines', (req, res) => {
  const name = req.query.name;

  if (!name) {
    res.json(medicines);
    return;
  }

  const matches = medicines.filter((medicine) => {
    return medicine.name.toLowerCase().includes(name.toLowerCase());
  });

  res.json(matches);
});

app.get('/medicines/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid medicine id' });
    return;
  }

  const medicine = findMedicine(id);

  if (!medicine) {
    res.status(404).json({ error: 'Medicine not found' });
    return;
  }

  res.json(medicine);
});

app.post('/medicines', (req, res) => {
  if (!req.body.name || !req.body.form) {
    res.status(400).json({ error: 'Missing medicine name or form' });
    return;
  }

  const medicine = {
    id: nextId,
    name: req.body.name,
    form: req.body.form,
  };

  nextId++;
  medicines.push(medicine);
  res.status(201).json(medicine);
});

app.put('/medicines/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid medicine id' });
    return;
  }

  const medicine = findMedicine(id);

  if (!medicine) {
    res.status(404).json({ error: 'Medicine not found' });
    return;
  }

  if (!req.body.name || !req.body.form) {
    res.status(400).json({ error: 'Missing medicine name or form' });
    return;
  }

  medicine.name = req.body.name;
  medicine.form = req.body.form;
  res.json(medicine);
});

app.patch('/medicines/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid medicine id' });
    return;
  }

  const medicine = findMedicine(id);

  if (!medicine) {
    res.status(404).json({ error: 'Medicine not found' });
    return;
  }

  if (req.body.name) {
    medicine.name = req.body.name;
  }

  if (req.body.form) {
    medicine.form = req.body.form;
  }

  res.json(medicine);
});

app.delete('/medicines/:id', (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid medicine id' });
    return;
  }

  const medicine = findMedicine(id);

  if (!medicine) {
    res.status(404).json({ error: 'Medicine not found' });
    return;
  }

  medicines.splice(medicines.indexOf(medicine), 1);
  res.status(204).end();
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log('Express routing demo listening on port ' + PORT);
});
