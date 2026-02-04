const express = require('express');
const Purchase = require('../models/Purchase');

const router = express.Router();

// GET route - Return all customer purchases (optionally filtered by userId)
router.get('/buyList', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter is required' });
    }
    const purchases = await Purchase.find({ userId }).sort({ purchasedAt: -1 });
    const items = purchases.map((p) => ({
      username: p.username,
      userId: p.userId,
      price: p.price,
      purchasedAt: p.purchasedAt,
    }));
    res.json({ userId, items });
  } catch (err) {
    console.error('GET buyList error:', err);
    res.status(500).json({ error: 'Failed to fetch buy list' });
  }
});

module.exports = router;
