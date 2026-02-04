// Customer Management API: read/write MongoDB, consume Kafka, GET all customer purchases
const express = require('express');
const cors = require('cors');
const { connect } = require('./db');
const buyListRouter = require('./routes/buyList');
const { runConsumer, disconnect } = require('./kafka/consumer');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/', buyListRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

async function start() {
  await connect();
  await runConsumer();
  app.listen(PORT, () => {
    console.log(`API Server (Customer Management) listening on http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await disconnect();
  process.exit(0);
});

start().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});
