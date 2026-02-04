// Customer-facing Web Server: handle buy (publish to Kafka), getAllUserBuys (GET from API), X-Region-Affinity on all responses
const express = require('express');
const path = require('path');
const axios = require('axios');
const { connect: connectKafka, disconnect: disconnectKafka } = require('./kafka/producer');
const buyRouter = require('./routes/buy');
const { countRequest, metricsHandler } = require('./metrics');

const app = express();
const PORT = process.env.PORT || 3000;
const API_SERVER_URL = process.env.API_SERVER_URL || 'http://localhost:3001';

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Every response includes X-Region-Affinity: local
app.use((req, res, next) => {
  res.setHeader('X-Region-Affinity', 'local');
  next();
});

// Prometheus /metrics for request-rate-based autoscaling (no auth; internal only)
app.get('/metrics', metricsHandler);

app.use(countRequest);
app.use('/', buyRouter);

// Handle getAllUserBuys: GET to Customer Management API and present response (counted by countRequest)
app.get('/getAllUserBuys', async (req, res) => {
  try {
    const { data } = await axios.get(`${API_SERVER_URL}/buyList`, { params: req.query });
    res.json(data);
  } catch (err) {
    const status = err.response?.status ?? 500;
    res.status(status).json(err.response?.data ?? { error: 'Failed to fetch buy list' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({ apiServerUrl: API_SERVER_URL });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

async function start() {
  await connectKafka();
  app.listen(PORT, () => {
    console.log(`Customer-facing Web Server on http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await disconnectKafka();
  process.exit(0);
});

start().catch((err) => {
  console.error('Failed to start Web server:', err);
  process.exit(1);
});
