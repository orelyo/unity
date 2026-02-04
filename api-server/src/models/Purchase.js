const mongoose = require('mongoose');

// Purchase document: username, userId, price, timestamp (from Kafka buy payload)
const purchaseSchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  price: { type: Number, required: true },
  purchasedAt: { type: Date, required: true },
});

module.exports = mongoose.model('Purchase', purchaseSchema);
