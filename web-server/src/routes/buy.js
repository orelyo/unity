const express = require('express');
const { sendPurchase } = require('../kafka/producer');

const router = express.Router();

// Handle "buy" request: publish data object (username, userid, price, timestamp) to Kafka
router.post('/buy', async (req, res) => {
  try {
    const username = req.body.username ?? req.query.username;
    const userId = req.body.userId ?? req.body.userid ?? req.query.userId ?? req.query.userid;
    if (!username || !userId) {
      return res.status(400).json({ error: 'username and userId are required' });
    }
    const price = req.body.price != null ? Number(req.body.price) : (Math.random() * 100 + 1).toFixed(2);
    const timestamp = req.body.timestamp ?? new Date().toISOString();
    const payload = { username, userid: userId, price: Number(price), timestamp };
    await sendPurchase(payload);
    res.json({ ...payload, message: 'Purchase event sent' });
  } catch (err) {
    console.error('POST /buy error:', err);
    res.status(500).json({ error: 'Failed to record purchase' });
  }
});

module.exports = router;
