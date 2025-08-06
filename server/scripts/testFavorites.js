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

// Test favorite functionality
async function testFavorites() {
  try {
    await connectToDatabase();
    
    console.log('🧪 Testing Favorite Functionality...');
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
    
    // Test 1: Add to favorites
    console.log('🔍 Test 1: Adding product to favorites...');
    try {
      const favorite = await UserFavorites.create({
        userId: testUserId,
        groupId: testGroupId,
        productId: testProductId
      });
      console.log('✅ Successfully added to favorites:', favorite._id);
    } catch (error) {
      if (error.code === 11000) {
        console.log('⚠️  Product already in favorites (duplicate key)');
      } else {
        console.error('❌ Error adding to favorites:', error.message);
      }
    }
    
    // Test 2: Check if favorited
    console.log('\n🔍 Test 2: Checking if product is favorited...');
    try {
      const existingFavorite = await UserFavorites.findOne({
        userId: testUserId,
        groupId: testGroupId,
        productId: testProductId
      });
      
      if (existingFavorite) {
        console.log('✅ Product is favorited');
      } else {
        console.log('❌ Product is not favorited');
      }
    } catch (error) {
      console.error('❌ Error checking favorite status:', error.message);
    }
    
    // Test 3: Remove from favorites
    console.log('\n🔍 Test 3: Removing product from favorites...');
    try {
      const result = await UserFavorites.deleteOne({
        userId: testUserId,
        groupId: testGroupId,
        productId: testProductId
      });
      
      if (result.deletedCount > 0) {
        console.log('✅ Successfully removed from favorites');
      } else {
        console.log('⚠️  Product was not in favorites');
      }
    } catch (error) {
      console.error('❌ Error removing from favorites:', error.message);
    }
    
    // Test 4: Check again after removal
    console.log('\n🔍 Test 4: Checking favorite status after removal...');
    try {
      const existingFavorite = await UserFavorites.findOne({
        userId: testUserId,
        groupId: testGroupId,
        productId: testProductId
      });
      
      if (!existingFavorite) {
        console.log('✅ Product successfully removed from favorites');
      } else {
        console.log('❌ Product still in favorites');
      }
    } catch (error) {
      console.error('❌ Error checking favorite status:', error.message);
    }
    
    console.log('\n🎉 Favorite functionality test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
testFavorites(); 