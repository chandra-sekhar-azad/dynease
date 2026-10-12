const mongoose = require('mongoose');

/**
 * Platform Centralized Subscription Record
 * Tracks tenant subscription lifecycle, cycles, periods, and payment status.
 */
const subscriptionSchema = new mongoose.Schema({
  restaurantId: {
    type: String,
    required: true,
    index: true
  },
  restaurantGroupId: {
    type: String,
    index: true,
    default: null
  },
  subdomain: {
    type: String,
    required: true,
    index: true
  },
  planId: {
    type: String,
    enum: ['STARTER', 'GROWTH', 'BUSINESS', 'PRO'],
    required: true,
    default: 'STARTER'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  status: {
    type: String,
    enum: ['pending', 'trialing', 'active', 'past_due', 'cancelled', 'expired', 'suspended'],
    default: 'trialing',
    index: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  currentPeriodStart: {
    type: Date,
    default: Date.now
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  nextBillingDate: {
    type: Date
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  cancelledAt: {
    type: Date
  },
  trialEndsAt: {
    type: Date
  },
  // Immutable snapshots of plan prices at time of subscription/renewal
  pricePaise: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  // Payment provider references (abstracted)
  paymentProvider: {
    type: String,
    default: 'manual' // 'manual' | 'razorpay' | 'stripe'
  },
  providerSubscriptionId: {
    type: String,
    default: null
  },
  providerCustomerId: {
    type: String,
    default: null
  },
  lastPaymentAt: {
    type: Date
  },
  // Scheduled plan changes (e.g., downgrade at next billing cycle)
  scheduledChange: {
    planId: {
      type: String,
      enum: ['STARTER', 'GROWTH', 'BUSINESS', 'PRO']
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly']
    },
    effectiveDate: Date,
    requestedAt: Date,
    requestedBy: String,
    reason: String
  },
  // Audit trail
  history: [{
    action: {
      type: String, // 'CREATED', 'UPGRADED', 'DOWNGRADED', 'RENEWED', 'CANCELLED', 'SUSPENDED', 'REACTIVATED', 'EXTENDED'
      required: true
    },
    fromPlan: String,
    toPlan: String,
    fromStatus: String,
    toStatus: String,
    amountPaise: Number,
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: String, // admin ID, 'OWNER', 'SYSTEM_CRON', 'WEBHOOK'
    note: String
  }]
}, {
  timestamps: true,
  collection: 'platform_subscriptions'
});

subscriptionSchema.index({ restaurantId: 1, status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

module.exports = mongoose.model('PlatformSubscription', subscriptionSchema);
