const mongoose = require('mongoose');

// Database name as per assignment requirements
const DB_NAME = 'production_shadow_db_v9';
const MONGODB_URI = process.env.MONGODB_URI || `mongodb://localhost:27017/${DB_NAME}`;

async function connect() {
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected');
}

module.exports = { connect };
