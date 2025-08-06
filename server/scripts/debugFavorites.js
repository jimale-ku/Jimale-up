const mongoose = require('mongoose');
const UserFavorites = require('../models/UserFavorites');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Debug favorite functionality
async function debugFavorites() {
  try {
    await connectToDatabase();
    
    console.log('🔍 Debugging Favorite Functionality...');
    console.log('=' .repeat(50));
    
    // Test data
    const testUserId = new mongoose.Types.ObjectId();
    const testGroupId = new mongoose.Types.ObjectId();
    const testProductId = 'test-product-123';
    
    console.log('📝 Test Data:');
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Group ID: ${testGroupId}`);
    console.log(`   Product ID: ${testProductId}`);
    console.log('');
    
    // Test 1: Check if UserFavorites model is working
    console.log('🔍 Test 1: Checking UserFavorites model...');
    try {
      console.log('   UserFavorites model:', typeof UserFavorites);
      console.log('   UserFavorites schema:', UserFavorites.schema ? '✅ Schema exists' : '❌ No schema');
      console.log('   UserFavorites collection:', UserFavorites.collection ? '✅ Collection exists' : '❌ No collection');
    } catch (error) {
      console.error('❌ Error checking UserFavorites model:', error.message);
    }
    
    // Test 2: Try to create a favorite
    console.log('\n🔍 Test 2: Creating a favorite...');
    try {
      const favorite = await UserFavorites.create({
        userId: testUserId,
        groupId: testGroupId,
        productId: testProductId
      });
      console.log('✅ Successfully created favorite:', favorite._id);
    } catch (error) {
      console.error('❌ Error creating favorite:', error.message);
      if (error.code === 11000) {
        console.log('⚠️  Duplicate key error (expected if already exists)');
      }
    }
    
    // Test 3: Try to find the favorite
    console.log('\n🔍 Test 3: Finding the favorite...');
    try {
      const foundFavorite = await UserFavorites.findOne({
        userId: testUserId,
        groupId: testGroupId,
        productId: testProductId
      });
      
      if (foundFavorite) {
        console.log('✅ Successfully found favorite:', foundFavorite._id);
      } else {
        console.log('⚠️  Favorite not found');
      }
    } catch (error) {
      console.error('❌ Error finding favorite:', error.message);
    }
    
    // Test 4: Check database connection
    console.log('\n🔍 Test 4: Checking database connection...');
    try {
      const dbState = mongoose.connection.readyState;
      const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };
      console.log(`   Database state: ${states[dbState]} (${dbState})`);
      
      if (dbState === 1) {
        console.log('✅ Database is connected');
      } else {
        console.log('❌ Database is not connected');
      }
    } catch (error) {
      console.error('❌ Error checking database state:', error.message);
    }
    
    // Test 5: Check if we can query the collection directly
    console.log('\n🔍 Test 5: Direct collection query...');
    try {
      const count = await UserFavorites.countDocuments();
      console.log(`   Total favorites in database: ${count}`);
    } catch (error) {
      console.error('❌ Error querying collection:', error.message);
    }
    
    console.log('\n🎉 Debug completed!');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the debug
debugFavorites(); 