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
    maxGuests: {
      type: Number,
      min: [1, 'Maximum guest capacity must be at least 1 person'],
      validate: [
        {
          validator: Number.isInteger,
          message: 'Maximum guest capacity must be a whole number'
        },
        {
          validator(value) {
            return value == null || value >= (this.minOrder || 10);
          },
          message: 'Maximum guest capacity must be greater than or equal to the minimum order'
        }
      ]
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

const cateringLocationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator(coordinates) {
          return Array.isArray(coordinates) &&
            coordinates.length === 2 &&
            Number.isFinite(coordinates[0]) &&
            Number.isFinite(coordinates[1]) &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90;
        },
        message: 'Location coordinates must be [longitude, latitude] within valid ranges'
      }
    }
  },
  { _id: false }
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
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters'],
      default: ''
    },
    locality: {
      type: String,
      trim: true,
      maxlength: [120, 'Locality cannot exceed 120 characters'],
      default: ''
    },
    fullAddress: {
      type: String,
      trim: true,
      maxlength: [250, 'Full address cannot exceed 250 characters'],
      default: ''
    },
    location: {
      type: cateringLocationSchema,
      default: undefined
    },
    isDemoListing: {
      type: Boolean,
      default: false
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
cateringServiceSchema.index({ location: '2dsphere' });

const CateringService = mongoose.model('CateringService', cateringServiceSchema);

module.exports = {
  CateringService,
  DIETARY_OPTIONS
};
