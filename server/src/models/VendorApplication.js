const mongoose = require('mongoose');

const vendorApplicationSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      immutable: true
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'Business name must be at least 2 characters long'],
      maxlength: [120, 'Business name cannot exceed 120 characters']
    },
    businessCategory: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'Business category must be at least 2 characters long'],
      maxlength: [80, 'Business category cannot exceed 80 characters']
    },
    businessDescription: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, 'Business description must be at least 10 characters long'],
      maxlength: [1000, 'Business description cannot exceed 1000 characters']
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: [30, 'Contact number cannot exceed 30 characters']
    },
    city: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'City must be at least 2 characters long'],
      maxlength: [100, 'City cannot exceed 100 characters']
    },
    locality: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'Locality must be at least 2 characters long'],
      maxlength: [120, 'Locality cannot exceed 120 characters']
    },
    servicesOffered: {
      type: [{
        type: String,
        trim: true,
        minlength: [2, 'Each service must be at least 2 characters long'],
        maxlength: [80, 'Each service cannot exceed 80 characters']
      }],
      required: true,
      validate: {
        validator(services) {
          return Array.isArray(services) && services.length > 0 && services.length <= 20;
        },
        message: 'Provide between 1 and 20 services.'
      }
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
      default: ''
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

const VendorApplication = mongoose.model('VendorApplication', vendorApplicationSchema);

module.exports = {
  VendorApplication
};
