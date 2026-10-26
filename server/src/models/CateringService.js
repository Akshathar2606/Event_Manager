const mongoose = require('mongoose');

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Halal',
  'Kosher',
  'Nut-Free',
  'Dairy-Free'
];

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Package name is required'],
      trim: true,
      minlength: [2, 'Package name must be at least 2 characters long'],
      maxlength: [100, 'Package name cannot exceed 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: ''
    },
    pricePerPlate: {
      type: Number,
      required: [true, 'Price per plate is required'],
      min: [0, 'Price per plate cannot be negative']
    },
    minOrder: {
      type: Number,
      default: 10,
      min: [1, 'Minimum order size must be at least 1 person'],
      validate: {
        validator: Number.isInteger,
        message: 'Minimum order size must be a whole number'
      }
    },
    menuItems: {
      type: [String],
      default: []
    },
    dietaryOptions: {
      type: [String],
      default: []
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

const cateringServiceSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vendor ID is required'],
      unique: true // One catering service profile per vendor user
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      minlength: [2, 'Business name must be at least 2 characters long'],
      maxlength: [120, 'Business name cannot exceed 120 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: ''
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    contactPhone: {
      type: String,
      trim: true,
      default: ''
    },
    serviceArea: {
      type: String,
      required: [true, 'Service area or campus location is required'],
      trim: true,
      maxlength: [200, 'Service area cannot exceed 200 characters']
    },
    cuisineTypes: {
      type: [String],
      default: []
    },
    packages: {
      type: [packageSchema],
      default: []
    },
    isAvailable: {
      type: Boolean,
      default: true
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

// Indexes
cateringServiceSchema.index({ businessName: 'text', description: 'text', serviceArea: 'text' });
cateringServiceSchema.index({ isAvailable: 1, isArchived: 1 });

const CateringService = mongoose.model('CateringService', cateringServiceSchema);

module.exports = {
  CateringService,
  DIETARY_OPTIONS
};
