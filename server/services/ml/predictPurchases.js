const Weights = require('../../models/Weights');
const TrainingExample = require('../../models/TrainingExample');

// Sigmoid function for logistic regression
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

// Calculate prediction probability using weights
function predictProbability(X, weights) {
  const z = X.reduce((sum, x_i, i) => sum + x_i * weights[i], 0);
  return sigmoid(z);
}

// Gradient descent for logistic regression training
function trainLogisticRegression(data, labels, learningRate = 0.01, iterations = 1000) {
  const numSamples = data.length;
  const numFeatures = data[0].length;

  // Initialize weights to 0
  let weights = new Array(numFeatures).fill(0);

  for (let k = 0; k < iterations; k++) {
    const gradients = new Array(numFeatures).fill(0);

    for (let i = 0; i < numSamples; i++) {
      const prediction = predictProbability(data[i], weights);
      const error = prediction - labels[i];

      // Update gradients
      for (let j = 0; j < numFeatures; j++) {
        gradients[j] += error * data[i][j];
      }
    }

    // Update weights
    for (let j = 0; j < numFeatures; j++) {
      weights[j] -= (learningRate / numSamples) * gradients[j];
    }
  }

  return weights;
}

// Train the ML model
async function trainModel() {
  try {
    const examples = await TrainingExample.find().lean();
    
    if (examples.length === 0) {
      console.log('No training examples found. Using default weights.');
      return await initializeDefaultWeights();
    }

    const X = examples.map(e => [
      e.features.bias,
      e.features.isFavorite,
      e.features.purchasedBefore,
      e.features.timesPurchased,
      e.features.recentlyPurchased,
      e.features.storeCount,
      e.features.timesWasRejectedByUser,
      e.features.timesWasRejectedByCart
    ]);
    
    const y = examples.map(e => e.label);

    // Train the model
    const trainedWeights = trainLogisticRegression(X, y);

    const featureNames = [
      'bias',
      'isFavorite',
      'purchasedBefore',
      'timesPurchased',
      'recentlyPurchased',
      'storeCount',
      'timesWasRejectedByUser',
      'timesWasRejectedByCart'
    ];

    // Update weights in database
    await Promise.all(
      featureNames.map(async (name, i) => {
        await Weights.findOneAndUpdate(
          { featureName: name },
          { weight: trainedWeights[i], updatedAt: new Date() },
          { upsert: true }
        );
      })
    );

    console.log('ML model training completed successfully');
    return trainedWeights;
  } catch (error) {
    console.error('Error training ML model:', error);
    throw error;
  }
}

// Initialize default weights if no training data exists
async function initializeDefaultWeights() {
  const defaultWeights = {
    bias: 0,
    isFavorite: 0.5,
    purchasedBefore: 0.3,
    timesPurchased: 0.2,
    recentlyPurchased: 0.4,
    storeCount: 0.1,
    timesWasRejectedByUser: -0.3,
    timesWasRejectedByCart: -0.2
  };

  await Promise.all(
    Object.entries(defaultWeights).map(async ([name, weight]) => {
      await Weights.findOneAndUpdate(
        { featureName: name },
        { weight, updatedAt: new Date() },
        { upsert: true }
      );
    })
  );

  return Object.values(defaultWeights);
}

// Update weights with a single example (online learning)
async function updateWeights(x, y, learningRate = 0.01) {
  try {
    const weights = await Weights.find().sort({ featureName: 1 }).lean();
    const w = weights.map(wi => wi.weight);
    const featureNames = weights.map(wi => wi.featureName);

    const p = predictProbability(x, w);

    // Calculate gradient
    const error = p - y;
    const newW = w.map((wi, i) => wi - learningRate * error * x[i]);
    const now = new Date();

    const updates = featureNames.map((name, i) => ({
      featureName: name,
      weight: newW[i],
      updatedAt: now,
    }));

    await Weights.deleteMany({});
    await Weights.insertMany(updates);

    console.log('Weights updated with new example');
  } catch (error) {
    console.error('Error updating weights:', error);
    throw error;
  }
}

// Rank products by purchase probability
async function rankProducts(productFeatureMap) {
  try {
    const weights = await Weights.find().lean();
    
    if (weights.length === 0) {
      console.log('No weights found. Using default ranking.');
      return Array.from(productFeatureMap.entries()).map(([productId, data]) => ({
        productId,
        probability: 0.5 // Default probability
      }));
    }

    const featureNames = weights.map(wi => wi.featureName);
    const w = weights.map(wi => wi.weight);

    const ranked = [];

    for (const [productId, data] of productFeatureMap.entries()) {
      const featureVector = [1]; // bias
      for (const featureName of featureNames.slice(1)) {
        featureVector.push(data[featureName] ?? 0);
      }

      // Predict purchase probability
      const prob = predictProbability(featureVector, w);
      ranked.push({ productId, probability: prob });
    }

    // Sort by probability (highest first)
    ranked.sort((a, b) => b.probability - a.probability);
    return ranked;
  } catch (error) {
    console.error('Error ranking products:', error);
    throw error;
  }
}

// Create training example from user interaction
async function createTrainingExample(userId, productId, features, label, listId = null) {
  try {
    const trainingExample = new TrainingExample({
      userId,
      productId,
      features,
      label,
      context: {
        listId,
        timestamp: new Date()
      }
    });

    await trainingExample.save();
    console.log('Training example created');
    return trainingExample;
  } catch (error) {
    console.error('Error creating training example:', error);
    throw error;
  }
}

module.exports = {
  trainModel,
  rankProducts,
  updateWeights,
  createTrainingExample,
  predictProbability
}; 