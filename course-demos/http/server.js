const http = require('http');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);

  if (req.method === 'GET' && url.pathname === '/hello') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello from the raw http server' }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/echo') {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString();
      let body;

      try {
        body = JSON.parse(rawBody);
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: body }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(3001, () => {
  console.log('Raw http server listening on port 3001');
});
