const mongoose = require('mongoose');

const CATERING_REQUEST_STATUS = ['pending', 'accepted', 'rejected', 'cancelled'];

/**
 * Package Snapshot Schema
 * Preserves historical package specifications, menu items, and pricing
 * at the moment the catering request was quoted.
 */
const packageSnapshotSchema = new mongoose.Schema(
  {
    packageId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Original package reference is required']
    },
    name: {
      type: String,
      required: [true, 'Package name is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    pricePerPlate: {
      type: Number,
      required: [true, 'Price per plate is required'],
      min: [0, 'Price per plate cannot be negative']
    },
    minOrder: {
      type: Number,
      required: [true, 'Minimum order size is required'],
      min: [1, 'Minimum order must be at least 1 person']
    },
    menuItems: {
      type: [String],
      default: []
    },
    dietaryOptions: {
      type: [String],
      default: []
    }
  },
  { _id: false }
);

const cateringRequestSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required']
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer reference is required']
    },
    cateringService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CateringService',
      required: [true, 'Catering service reference is required']
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor reference is required']
    },
    selectedPackage: {
      type: packageSnapshotSchema,
      required: [true, 'Selected package snapshot is required']
    },
    guestCount: {
      type: Number,
      required: [true, 'Guest count is required'],
      min: [1, 'Guest count must be at least 1 person'],
      validate: {
        validator: Number.isInteger,
        message: 'Guest count must be an integer'
      }
    },
    pricePerPlate: {
      type: Number,
      required: [true, 'Price per plate snapshot is required'],
      min: [0, 'Price per plate cannot be negative']
    },
    quotedPrice: {
      type: Number,
      required: [true, 'Quoted price estimate is required'],
      min: [0, 'Quoted price cannot be negative']
    },
    serviceDateTime: {
      type: Date,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Request notes cannot exceed 1000 characters'],
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: CATERING_REQUEST_STATUS,
        message: '{VALUE} is not a valid status. Allowed values: ' + CATERING_REQUEST_STATUS.join(', ')
      },
      default: 'pending'
    },
    respondedAt: {
      type: Date,
      default: null
    },
    vendorNotes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Vendor notes cannot exceed 1000 characters'],
      default: ''
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Rejection reason cannot exceed 1000 characters'],
      default: ''
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Cancellation reason cannot exceed 1000 characters'],
      default: ''
    },
    isArchived: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Query optimization indexes
cateringRequestSchema.index({ organizer: 1, status: 1, createdAt: -1 });
cateringRequestSchema.index({ vendor: 1, status: 1, createdAt: -1 });
cateringRequestSchema.index({ cateringService: 1, status: 1 });
cateringRequestSchema.index({ event: 1, isArchived: 1 });
cateringRequestSchema.index({ status: 1, isArchived: 1 });

const CateringRequest = mongoose.model('CateringRequest', cateringRequestSchema);

module.exports = {
  CateringRequest,
  CATERING_REQUEST_STATUS
};
