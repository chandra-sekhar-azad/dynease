const mongoose = require('mongoose');

const assignmentEventSchema = new mongoose.Schema({
  restaurantId: {
    type: String,
    required: true,
    index: true
  },
  targetType: {
    type: String,
    enum: ['TABLE', 'ORDER', 'SERVICE_REQUEST'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  },
  tableNumber: {
    type: String
  },
  previousWaiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  newWaiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignmentMode: {
    type: String,
    enum: ['MANUAL', 'AUTOMATIC', 'HYBRID', 'OVERFLOW', 'ESCALATION'],
    default: 'MANUAL'
  },
  action: {
    type: String,
    enum: [
      'ASSIGNED',
      'REASSIGNED',
      'UNASSIGNED',
      'ACCEPTED',
      'REJECTED',
      'TIMEOUT',
      'OVERFLOW_ASSIGNED',
      'MANUAL_OVERRIDE'
    ],
    required: true
  },
  score: {
    type: Number,
    default: null
  },
  scoreDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  reason: {
    type: String,
    default: ''
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  actorRole: {
    type: String,
    default: 'SYSTEM'
  }
}, { timestamps: true });

assignmentEventSchema.index({ restaurantId: 1, createdAt: -1 });
assignmentEventSchema.index({ restaurantId: 1, targetType: 1, targetId: 1 });

module.exports = assignmentEventSchema;
