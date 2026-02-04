const { Kafka } = require('kafkajs');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'purchases';

const kafka = new Kafka({
  clientId: 'customer-facing-web-server',
  brokers: KAFKA_BROKERS,
});

const producer = kafka.producer();

async function connect() {
  await producer.connect();
  console.log('Kafka producer connected');
}

// Publish buy data object: username, userid, price, timestamp
async function sendPurchase(payload) {
  await producer.send({
    topic: TOPIC,
    messages: [{ value: JSON.stringify(payload) }],
  });
}

async function disconnect() {
  await producer.disconnect();
}

module.exports = { connect, sendPurchase, disconnect };
