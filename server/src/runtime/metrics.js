const http = require('http');
const v8 = require('v8');
const os = require('os');
const { monitorEventLoopDelay } = require('perf_hooks');

// Event-loop delay is sampled by libuv; the histogram exposes the lag that a
// blocked thread would create.
const delay = monitorEventLoopDelay({ resolution: 20 });
delay.enable();

function snapshot() {
  const memory = process.memoryUsage();
  const heap = v8.getHeapStatistics();
  const cpu = process.cpuUsage();

  return {
    process: {
      pid: process.pid,
      node: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      cpuUserSeconds: Math.round(cpu.user / 1000) / 1000,
      cpuSystemSeconds: Math.round(cpu.system / 1000) / 1000,
    },
    memory: {
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      heapSizeLimitBytes: heap.heap_size_limit,
    },
    eventLoop: {
      minMs: Math.round(delay.min / 1e4) / 100,
      maxMs: Math.round(delay.max / 1e4) / 100,
      meanMs: Math.round(delay.mean / 1e4) / 100,
      p99Ms: Math.round(delay.percentile(99) / 1e4) / 100,
      samples: delay.count,
    },
    system: {
      platform: os.platform(),
      release: os.release(),
      cpus: os.cpus().length,
      loadAverage: os.loadavg(),
      freeMemoryBytes: os.freemem(),
      totalMemoryBytes: os.totalmem(),
    },
  };
}

function prometheus() {
  const data = snapshot();
  const lines = [
    '# HELP velora_uptime_seconds Process uptime in seconds.',
    '# TYPE velora_uptime_seconds gauge',
    'velora_uptime_seconds ' + data.process.uptimeSeconds,
    '# HELP velora_memory_rss_bytes Resident set size.',
    '# TYPE velora_memory_rss_bytes gauge',
    'velora_memory_rss_bytes ' + data.memory.rssBytes,
    '# HELP velora_memory_heap_used_bytes V8 heap used.',
    '# TYPE velora_memory_heap_used_bytes gauge',
    'velora_memory_heap_used_bytes ' + data.memory.heapUsedBytes,
    '# HELP velora_v8_heap_size_limit_bytes V8 heap limit.',
    '# TYPE velora_v8_heap_size_limit_bytes gauge',
    'velora_v8_heap_size_limit_bytes ' + data.memory.heapSizeLimitBytes,
    '# HELP velora_event_loop_delay_p99_ms Event loop p99 delay.',
    '# TYPE velora_event_loop_delay_p99_ms gauge',
    'velora_event_loop_delay_p99_ms ' + data.eventLoop.p99Ms,
    '# HELP velora_process_cpu_user_seconds_total User CPU time.',
    '# TYPE velora_process_cpu_user_seconds_total counter',
    'velora_process_cpu_user_seconds_total ' + data.process.cpuUserSeconds,
  ];

  return lines.join('\n') + '\n';
}

// A small raw HTTP server, separate from Express, for scrapers and probes.
function start(port) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(Buffer.from(JSON.stringify({ error: 'Method not allowed' })));
      return;
    }

    if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.end(Buffer.from(prometheus()));
      return;
    }

    if (req.url === '/runtime') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(Buffer.from(JSON.stringify(snapshot())));
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(Buffer.from(JSON.stringify({ ok: true })));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(Buffer.from(JSON.stringify({ error: 'Not found' })));
  });

  server.listen(port);
  return server;
}

module.exports = {
  snapshot,
  prometheus,
  start,
};
