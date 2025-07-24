// Main server file for SmartBuy application
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');

require('dotenv').config();


console.log('GOOGLE_MAPS_API_KEY:', process.env.GOOGLE_MAPS_API_KEY); // Debug: check if key is loaded

const app = express();
const server = http.createServer(app); // HTTP server for socket support
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development
  },
});

// Make socket.io available to controllers
app.set('io', io);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// API routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/supermarkets', require('./routes/supermarketRoutes'));
app.use('/api/offers', require('./routes/offerRoutes'));
app.use('/api/list', require('./routes/listRoutes'));
app.use('/api/lists', require('./routes/listRoutes'));
app.use('/api/suggestions', require('./routes/suggestionRoutes'));
app.use('/api/compare', require('./routes/compareRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/favorites', require('./routes/favoriteRoutes'));
app.use('/api/rejections', require('./routes/rejectionRoutes'));

// Mock endpoint for groups (temporary for testing)
app.get('/api/groups/my', (req, res) => {
  res.json([
    {
      _id: 'dummy-group-id',
      name: 'Sample Group',
      list: { _id: 'dummy-list-id' }
    }
  ]);
});

// TEMPORARY: Debug route to check req.body
app.post('/test-body', (req, res) => {
  console.log('BODY:', req.body);
  res.json({ body: req.body });
});

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://ibrahimkhalif22031:Allah22031@ibrahim.cfpeif6.mongodb.net/smartbuy?retryWrites=true&w=majority';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-for-smart-buy-app-2024';

// Set JWT_SECRET globally so authController can access it
process.env.JWT_SECRET = JWT_SECRET;

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Initialize ML model on server startup
const initializeMLModel = async () => {
  try {
    const Weights = require('./models/Weights');
    const latest = await Weights.findOne().sort({ updatedAt: -1 }).lean();

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (latest && now - new Date(latest.updatedAt).getTime() < oneDay) {
      console.log('ML model is up to date');
      return;
    }

    console.time('ML model training duration');
    const { trainModel } = require('./services/ml/predictPurchases');
    await trainModel();
    console.timeEnd('ML model training duration');

    if (latest) {
      console.log('ML model retraining complete');
    } else {
      console.log('ML model initial training complete');
    }
  } catch (err) {
    console.error('Error initializing ML model:', err);
  }
};

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Handle group joining
  socket.on('joinGroup', (groupId) => {
    socket.join(groupId);
    console.log(`Socket ${socket.id} joined group: ${groupId}`);
  });

  // Handle list joining
  socket.on('joinList', (listId) => {
    socket.join(listId);
    console.log(`Socket ${socket.id} joined list: ${listId}`);
  });

  // Handle list updates
  socket.on('listUpdate', ({ listId }) => {
    console.log(`Broadcasting update to list ${listId}`);
    io.to(listId).emit('listUpdate', { listId });
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 5000;

// Test route to check if server is running
app.get('/', (req, res) => {
  res.send('Backend is working');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize ML model after server starts
  setTimeout(initializeMLModel, 2000); // Wait 2 seconds for MongoDB connection
});
