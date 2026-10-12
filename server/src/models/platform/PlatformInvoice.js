const mongoose = require('mongoose');

/**
 * Immutable Invoice / Payment Snapshot Record
 * Never deleted upon subscription expiration or cancellation.
 */
const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  restaurantId: {
    type: String,
    required: true,
    index: true
  },
  subdomain: {
    type: String,
    required: true
  },
  planId: {
    type: String,
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  amountPaise: {
    type: Number,
    required: true
  },
  amountRupees: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
    default: 'PENDING',
    index: true
  },
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  paymentMethod: {
    type: String,
    default: 'MANUAL_OFFLINE' // 'MANUAL_OFFLINE' | 'RAZORPAY' | 'STRIPE' | 'UPI'
  },
  transactionId: {
    type: String,
    default: null
  },
  paidAt: {
    type: Date
  },
  notes: {
    type: String
  },
  recordedBy: {
    type: String // 'SYSTEM', 'SUPER_ADMIN', or admin user ID
  }
}, {
  timestamps: true,
  collection: 'platform_invoices'
});

invoiceSchema.index({ restaurantId: 1, createdAt: -1 });

module.exports = mongoose.model('PlatformInvoice', invoiceSchema);
