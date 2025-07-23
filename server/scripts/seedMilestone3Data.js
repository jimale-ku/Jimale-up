const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Import models
const Product = require('../models/Product');
const User = require('../models/User');
const Group = require('../models/Group');
const PurchaseHistory = require('../models/PurchaseHistory');

// MongoDB connection string - your Atlas connection string
const MONGODB_URI = 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';

// Household data for realistic simulation
const householdNames = [
  'Smith Family', 'Johnson Household', 'Williams Clan', 'Brown Family', 'Jones Household',
  'Garcia Family', 'Miller Clan', 'Davis Household', 'Rodriguez Family', 'Martinez Clan',
  'Hernandez Family', 'Lopez Household', 'Gonzalez Clan', 'Wilson Family', 'Anderson Household',
  'Thomas Family', 'Taylor Clan', 'Moore Household', 'Jackson Family', 'Martin Clan',
  'Lee Family', 'Perez Household', 'Thompson Clan', 'White Family', 'Harris Household',
  'Sanchez Family', 'Clark Clan', 'Ramirez Household', 'Lewis Family', 'Robinson Clan',
  'Walker Family', 'Young Household', 'Allen Clan', 'King Family', 'Wright Household',
  'Scott Family', 'Torres Clan', 'Nguyen Household', 'Hill Family', 'Flores Clan',
  'Green Family', 'Adams Household', 'Nelson Clan', 'Baker Family', 'Hall Household',
  'Rivera Family', 'Campbell Clan', 'Mitchell Household', 'Carter Family', 'Roberts Clan'
];

// Common household member names
const memberNames = [
  'John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Chris', 'Emma', 'Alex', 'Maria',
  'Tom', 'Anna', 'James', 'Sophie', 'Robert', 'Olivia', 'Michael', 'Ava', 'William', 'Isabella',
  'Daniel', 'Mia', 'Matthew', 'Charlotte', 'Joseph', 'Amelia', 'Christopher', 'Harper', 'Andrew', 'Evelyn',
  'Joshua', 'Abigail', 'Ryan', 'Emily', 'Nicholas', 'Elizabeth', 'Tyler', 'Sofia', 'Sean', 'Avery',
  'Nathan', 'Ella', 'Adam', 'Madison', 'Henry', 'Scarlett', 'Owen', 'Victoria', 'Landon', 'Luna',
  'Isaac', 'Grace', 'Caleb', 'Chloe', 'Isaiah', 'Penelope', 'Hunter', 'Layla', 'Christian', 'Riley',
  'Jack', 'Zoey', 'Julian', 'Nora', 'Aaron', 'Lily', 'Evan', 'Eleanor', 'Gavin', 'Hannah',
  'Connor', 'Lillian', 'Aiden', 'Addison', 'Miles', 'Aubrey', 'Jordan', 'Ellie', 'Carson', 'Stella',
  'Mason', 'Natalie', 'Blake', 'Zoe', 'Cameron', 'Leah', 'Hayden', 'Hazel', 'Jeremiah', 'Violet',
  'Eli', 'Aurora', 'Colton', 'Savannah', 'Angel', 'Audrey', 'Jonathan', 'Brooklyn', 'Isaiah', 'Bella'
];

// Product categories for realistic shopping patterns
const productCategories = {
  'Dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'eggs'],
  'Produce': ['apple', 'banana', 'tomato', 'lettuce', 'carrot', 'onion', 'potato'],
  'Meat': ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb'],
  'Pantry': ['rice', 'pasta', 'bread', 'cereal', 'flour', 'sugar', 'oil'],
  'Beverages': ['water', 'juice', 'soda', 'coffee', 'tea', 'beer', 'wine'],
  'Snacks': ['chips', 'cookies', 'crackers', 'nuts', 'candy', 'popcorn'],
  'Frozen': ['ice cream', 'frozen pizza', 'frozen vegetables', 'frozen meat'],
  'Household': ['soap', 'detergent', 'paper towels', 'toilet paper', 'cleaning supplies'],
  'Personal Care': ['shampoo', 'toothpaste', 'deodorant', 'razors', 'makeup'],
  'Baby': ['diapers', 'baby food', 'baby wipes', 'formula']
};

// Seasonal shopping patterns
const seasonalProducts = {
  'summer': ['ice cream', 'water', 'juice', 'fruits', 'grill meat', 'soda'],
  'winter': ['hot chocolate', 'soup', 'tea', 'comfort food', 'warm beverages'],
  'holiday': ['turkey', 'ham', 'candy', 'baking supplies', 'wine', 'champagne'],
  'back-to-school': ['cereal', 'snacks', 'lunch items', 'school supplies'],
  'spring': ['fresh produce', 'cleaning supplies', 'gardening items']
};

// Generate realistic household data
async function generateHouseholdData() {
  const households = [];
  
  for (let i = 0; i < 100; i++) {
    const householdName = householdNames[i % householdNames.length];
    const memberCount = Math.floor(Math.random() * 4) + 1; // 1-4 members
    const members = [];
    
    for (let j = 0; j < memberCount; j++) {
      const memberName = memberNames[Math.floor(Math.random() * memberNames.length)];
      const phone = `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
      const username = `${memberName.toLowerCase()}${i}${j}`;
      
      // Hash the password properly
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      members.push({
        username,
        phone,
        password: hashedPassword, // Now properly hashed
        profilePicUrl: ''
      });
    }
    
    households.push({
      name: householdName,
      members
    });
  }
  
  return households;
}

// Generate realistic purchase history
function generatePurchaseHistory(users, products) {
  const purchaseHistory = [];
  const now = new Date();
  
  users.forEach(user => {
    // Generate 50+ shopping trips per user
    const shoppingTrips = Math.floor(Math.random() * 30) + 50; // 50-80 trips
    
    for (let trip = 0; trip < shoppingTrips; trip++) {
      // Random date within last 2 years
      const tripDate = new Date(now.getTime() - Math.random() * 2 * 365 * 24 * 60 * 60 * 1000);
      
      // 3-15 items per shopping trip
      const itemsInTrip = Math.floor(Math.random() * 13) + 3;
      const tripProducts = [];
      
      // Select products for this trip
      for (let item = 0; item < itemsInTrip; item++) {
        const product = products[Math.floor(Math.random() * products.length)];
        const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 items
        const price = (Math.random() * 20 + 1).toFixed(2); // $1-$21
        
        tripProducts.push({
          name: product.name,
          product: product._id,
          quantity,
          user: user._id,
          boughtAt: tripDate,
          price: parseFloat(price),
          supermarket: null // We'll add supermarket data later if needed
        });
      }
      
      purchaseHistory.push(...tripProducts);
    }
  });
  
  return purchaseHistory;
}

// Add seasonal and trending patterns
function addSeasonalPatterns(purchaseHistory, products) {
  const now = new Date();
  const currentMonth = now.getMonth();
  
  // Add seasonal shopping patterns
  purchaseHistory.forEach(purchase => {
    const purchaseDate = new Date(purchase.boughtAt);
    const purchaseMonth = purchaseDate.getMonth();
    
    // Summer months (June-August)
    if (purchaseMonth >= 5 && purchaseMonth <= 7) {
      if (Math.random() < 0.3) { // 30% chance to add summer items
        const summerProducts = products.filter(p => 
          seasonalProducts.summer.some(sp => p.name.toLowerCase().includes(sp))
        );
        if (summerProducts.length > 0) {
          const summerProduct = summerProducts[Math.floor(Math.random() * summerProducts.length)];
          purchaseHistory.push({
            ...purchase,
            name: summerProduct.name,
            product: summerProduct._id,
            quantity: Math.floor(Math.random() * 2) + 1
          });
        }
      }
    }
    
    // Winter months (December-February)
    if (purchaseMonth === 11 || purchaseMonth <= 1) {
      if (Math.random() < 0.3) { // 30% chance to add winter items
        const winterProducts = products.filter(p => 
          seasonalProducts.winter.some(sp => p.name.toLowerCase().includes(sp))
        );
        if (winterProducts.length > 0) {
          const winterProduct = winterProducts[Math.floor(Math.random() * winterProducts.length)];
          purchaseHistory.push({
            ...purchase,
            name: winterProduct.name,
            product: winterProduct._id,
            quantity: Math.floor(Math.random() * 2) + 1
          });
        }
      }
    }
  });
}

// Main seeding function
async function seedMilestone3Data() {
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas successfully!');
    
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await Product.deleteMany({});
    await User.deleteMany({});
    await Group.deleteMany({});
    await PurchaseHistory.deleteMany({});
    console.log('✅ Existing data cleared!');
    
    // 1. Seed Products from products.json
    console.log('📦 Seeding products...');
    const productsPath = path.join(__dirname, 'products.json');
    const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    
    // Use all products from products.json
    const productsToSeed = productsData;
    const products = await Product.insertMany(productsToSeed);
    console.log(`✅ Seeded ${products.length} products!`);
    
    // 2. Generate and seed household data
    console.log('🏠 Generating household data...');
    const householdData = await generateHouseholdData();
    const allUsers = [];
    
    for (const household of householdData) {
      const householdUsers = await User.insertMany(household.members);
      allUsers.push(...householdUsers);
      
      // Create group for household
      await Group.create({
        name: household.name,
        members: householdUsers.map(user => ({
          user: user._id,
          role: 'member'
        })),
        waitingList: [],
        list: null
      });
    }
    
    console.log(`✅ Seeded ${allUsers.length} users in ${householdData.length} households!`);
    
    // 3. Generate purchase history
    console.log('🛒 Generating purchase history...');
    let purchaseHistory = generatePurchaseHistory(allUsers, products);
    
    // Add seasonal patterns
    console.log('🌤️ Adding seasonal patterns...');
    addSeasonalPatterns(purchaseHistory, products);
    
    // Insert purchase history in batches
    const batchSize = 1000;
    for (let i = 0; i < purchaseHistory.length; i += batchSize) {
      const batch = purchaseHistory.slice(i, i + batchSize);
      await PurchaseHistory.insertMany(batch);
      console.log(`📊 Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(purchaseHistory.length / batchSize)}`);
    }
    
    console.log(`✅ Seeded ${purchaseHistory.length} purchase records!`);
    
    // 4. Generate summary statistics
    const totalProducts = await Product.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalGroups = await Group.countDocuments();
    const totalPurchases = await PurchaseHistory.countDocuments();
    
    console.log('\n🎉 MILESTONE 3 DATA SEEDING COMPLETE!');
    console.log('=====================================');
    console.log(`📦 Products: ${totalProducts}`);
    console.log(`👥 Users: ${totalUsers}`);
    console.log(`🏠 Households/Groups: ${totalGroups}`);
    console.log(`🛒 Purchase Records: ${totalPurchases}`);
    console.log(`📊 Average purchases per user: ${Math.round(totalPurchases / totalUsers)}`);
    console.log('\n🚀 Your smart predictions engine is now ready!');
    console.log('💡 The ML system can now analyze:');
    console.log('   • Household shopping patterns');
    console.log('   • Global purchase trends');
    console.log('   • Seasonal shopping behavior');
    console.log('   • Product associations');
    console.log('\n🔑 Test Accounts:');
    console.log('   Username: john0, Password: password123');
    console.log('   Username: jane1, Password: password123');
    console.log('   Username: mike2, Password: password123');
    
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed!');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

// Run the seeding
if (require.main === module) {
  seedMilestone3Data();
}

module.exports = { seedMilestone3Data };  