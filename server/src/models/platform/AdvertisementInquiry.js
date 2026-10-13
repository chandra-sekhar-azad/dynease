const mongoose = require('mongoose');

const advertisementInquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true
  },
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    default: ''
  },
  city: {
    type: String,
    trim: true,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['NEW', 'CONTACTED', 'APPROVED', 'REJECTED'],
    default: 'NEW'
  }
}, { timestamps: true });

module.exports = mongoose.model('AdvertisementInquiry', advertisementInquirySchema);
