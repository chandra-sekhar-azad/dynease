const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false // Don't return password by default
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'RESTAURANT_OWNER', 'RESTAURANT_STAFF', 'KITCHEN_STAFF', 'CUSTOMER'],
    default: 'CUSTOMER'
  },
  phone: {
    type: String,
    trim: true
  },
  restaurantId: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  assignedTables: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table'
  }],
  shiftStatus: {
    type: String,
    enum: ['ON_SHIFT', 'OFF_SHIFT'],
    default: 'ON_SHIFT'
  },
  availabilityStatus: {
    type: String,
    enum: ['AVAILABLE', 'BUSY', 'PAUSED'],
    default: 'AVAILABLE'
  },
  acceptingOrders: {
    type: Boolean,
    default: true
  },
  workloadCapacity: {
    type: Number,
    default: 5,
    min: 1
  },
  lastAssignedAt: {
    type: Date,
    default: null
  },
  sections: [{
    type: String,
    trim: true
  }]
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Method to check password
userSchema.methods.comparePassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = userSchema;


