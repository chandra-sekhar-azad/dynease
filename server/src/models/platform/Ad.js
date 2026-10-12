const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  badge: {
    type: String,
    default: "CHEF'S SPECIAL"
  },
  buttonText: {
    type: String,
    default: ''
  },
  rightBadge: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  targetUrl: {
    type: String,
    default: ''
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    default: null
  },
  clicks: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Ad', adSchema);
