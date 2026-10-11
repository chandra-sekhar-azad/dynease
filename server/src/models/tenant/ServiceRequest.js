const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  restaurantId: {
    type: String,
    required: true,
    index: true
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true,
    index: true
  },
  tableNumber: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['CALL_WAITER', 'WATER', 'CUTLERY', 'BILL', 'CLEANING', 'OTHER'],
    required: true,
    default: 'CALL_WAITER'
  },
  note: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['OPEN', 'ASSIGNED', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'],
    default: 'OPEN',
    index: true
  },
  assignedWaiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

serviceRequestSchema.index({ restaurantId: 1, status: 1 });
serviceRequestSchema.index({ restaurantId: 1, assignedWaiterId: 1, status: 1 });

module.exports = serviceRequestSchema;
