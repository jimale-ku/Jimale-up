// server/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name:     { type: String },
  barcode:      { type: String },
  img:  { type: String },
  count:    { type: Number,  }  
});

// Indexes for faster queries
productSchema.index({ name: 1 });
productSchema.index({ img: 1 });

module.exports = mongoose.model('Product', productSchema);