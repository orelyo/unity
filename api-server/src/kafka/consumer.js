const { Kafka } = require('kafkajs');
const Purchase = require('../models/Purchase');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const TOPIC = process.env.KAFKA_TOPIC || 'purchases';

const kafka = new Kafka({
  clientId: 'api-server-customer-management',
  brokers: KAFKA_BROKERS,
});

// Consumer group config: assignment requires heartbeat 4242, session 4343. Override via env in K8s if broker drops member.
const HEARTBEAT_MS = process.env.KAFKA_CONSUMER_HEARTBEAT_MS != null ? Number(process.env.KAFKA_CONSUMER_HEARTBEAT_MS) : 4242;
const SESSION_TIMEOUT_MS = process.env.KAFKA_CONSUMER_SESSION_TIMEOUT_MS != null ? Number(process.env.KAFKA_CONSUMER_SESSION_TIMEOUT_MS) : 4343;
const consumer = kafka.consumer({
  groupId: process.env.KAFKA_CONSUMER_GROUP_ID || 'customer-management-consumer',
  heartbeatInterval: HEARTBEAT_MS,
  sessionTimeout: SESSION_TIMEOUT_MS,
});

async function runConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        const username = payload.username;
        const userId = payload.userId ?? payload.userid;
        const price = payload.price != null ? Number(payload.price) : null;
        const timestamp = payload.timestamp;
        if (username != null && userId != null && price != null && !Number.isNaN(price) && timestamp != null) {
          await Purchase.create({
            username,
            userId: String(userId),
            price,
            purchasedAt: new Date(timestamp),
          });
          console.log(`Consumed: userId=${userId}, username=${username}, price=${price}`);
        } else {
          console.warn('Skipped message - missing or invalid fields:', { username, userId, price, timestamp });
        }
      } catch (err) {
        console.error('Error processing Kafka message:', err);
      }
    },
  });
  console.log('Kafka consumer running on topic:', TOPIC);
}

async function disconnect() {
  await consumer.disconnect();
}

module.exports = { runConsumer, disconnect };
