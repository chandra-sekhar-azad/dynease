const mongoose = require('mongoose');

const restaurantProfileSchema = new mongoose.Schema({
  restaurantId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  subtitle: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Restaurant', 'Cafe', 'Fast Food', 'Bakery', 'Food Court', 'Cloud Kitchen', 'Other'],
    default: 'Restaurant'
  },
  description: String,
  logo: {
    public_id: String,
    secure_url: String
  },
  coverImage: {
    public_id: String,
    secure_url: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  phone: String,
  email: String,
  openingHours: {
    type: Map,
    of: String
  },
  cuisineType: [String],
  taxInfo: {
    gstNumber: String,
    taxPercentage: { type: Number, default: 0 }
  },
  currency: {
    type: String,
    default: 'INR'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  googleReviewLink: {
    type: String,
    default: ''
  },
  assignmentSettings: {
    mode: {
      type: String,
      enum: ['MANUAL', 'AUTOMATIC', 'HYBRID'],
      default: 'HYBRID'
    },
    defaultCapacity: {
      type: Number,
      default: 5,
      min: 1
    },
    weightWorkload: {
      type: Number,
      default: 0.60
    },
    weightRecentAssignment: {
      type: Number,
      default: 0.25
    },
    weightSectionMismatch: {
      type: Number,
      default: 0.15
    },
    allowOverflow: {
      type: Boolean,
      default: true
    },
    acceptanceTimeoutMinutes: {
      type: Number,
      default: 3
    },
    reassignmentPolicy: {
      type: String,
      enum: ['AUTO_REASSIGN', 'ESCALATE_TO_MANAGER'],
      default: 'AUTO_REASSIGN'
    }
  }
}, { timestamps: true });

module.exports = restaurantProfileSchema;
