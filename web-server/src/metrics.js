// Prometheus metrics for use-case-relevant autoscaling (e.g. HTTP request rate)
const promClient = require('prom-client');

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Request counter for KEDA/Prometheus scaling on request rate (relevant to customer-facing traffic)
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests received',
  labelNames: ['method', 'path'],
  registers: [register],
});

function countRequest(req, res, next) {
  httpRequestsTotal.inc({ method: req.method, path: req.path || req.url || 'unknown' });
  next();
}

async function metricsHandler(req, res) {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = { register, httpRequestsTotal, countRequest, metricsHandler };
