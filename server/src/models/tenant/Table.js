const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  restaurantId: {
    type: String,
    required: true
  },
  tableNumber: {
    type: String,
    required: true
  },
  tableName: {
    type: String
  },
  capacity: {
    type: Number,
    required: true,
    default: 4
  },
  qrToken: {
    type: String,
    unique: true,
    sparse: true
  },
  qrCodeUrl: {
    type: String, 
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  isOccupied: {
    type: Boolean,
    default: false
  },
  section: {
    type: String,
    trim: true,
    default: 'Main Area'
  },
  primaryWaiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignmentMode: {
    type: String,
    enum: ['MANUAL', 'AUTOMATIC', 'HYBRID'],
    default: 'HYBRID'
  },
  assignedAt: {
    type: Date,
    default: null
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignmentStatus: {
    type: String,
    enum: ['ASSIGNED', 'UNASSIGNED', 'REASSIGNED'],
    default: 'UNASSIGNED'
  }
}, { timestamps: true });

// Ensure table numbers are unique per restaurant
tableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

module.exports = tableSchema;


