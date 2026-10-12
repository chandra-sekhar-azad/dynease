const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  restaurantId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  type: {
    type: String,
    enum: ['all', 'veg', 'non-veg', 'vegan', 'non-vegan'],
    default: 'all'
  },
  image: {
    public_id: String,
    secure_url: String
  }
}, { timestamps: true });

// Category names must be unique per restaurant
categorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });

module.exports = categorySchema;
