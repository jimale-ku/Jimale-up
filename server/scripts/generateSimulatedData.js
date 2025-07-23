// server/scripts/generateSimulatedData.js
require('dotenv').config();
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Product = require('../models/Product');
const User = require('../models/User');
const PurchaseHistory = require('../models/PurchaseHistory');

// Helper to get random int in range
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🔗 Connected to MongoDB');

  // Load all products from DB
  const products = await Product.find({});
  if (!products.length) {
    console.error('No products found in DB. Please seed products first.');
    process.exit(1);
  }

  const NUM_USERS = 120;
  const users = [];

  // Generate fake users
  for (let i = 0; i < NUM_USERS; i++) {
    const username = faker.internet.username() + i;
    const phone = faker.phone.number('05########');
    const password = faker.internet.password();
    const profilePicUrl = faker.image.avatar();
    users.push({ username, phone, password, profilePicUrl });
  }

  // Insert users
  const createdUsers = await User.insertMany(users);
  console.log(`👤 Inserted ${createdUsers.length} users.`);

  // Generate purchase history for each user
  const purchaseHistories = [];
  for (const user of createdUsers) {
    const numPurchases = getRandomInt(10, 20);
    for (let j = 0; j < numPurchases; j++) {
      const product = products[getRandomInt(0, products.length - 1)];
      const quantity = getRandomInt(1, 5);
      const daysAgo = getRandomInt(1, 180);
      const boughtAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      purchaseHistories.push({
        name: product.name,
        product: product._id,
        quantity,
        user: user._id,
        boughtAt
      });
    }
  }

  await PurchaseHistory.insertMany(purchaseHistories);
  console.log(`🛒 Inserted ${purchaseHistories.length} purchase history records.`);

  console.log('✅ Simulated data generation complete.');
  process.exit();
})(); 