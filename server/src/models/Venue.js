const mongoose = require('mongoose');

const VENUE_STATUS = ['available', 'maintenance'];

const venueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Venue name is required'],
      trim: true,
      minlength: [2, 'Venue name must be at least 2 characters long'],
      maxlength: [120, 'Venue name cannot exceed 120 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: ''
    },
    location: {
      type: String,
      required: [true, 'Venue location is required'],
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters']
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1 person'],
      validate: {
        validator: Number.isInteger,
        message: 'Capacity must be an integer'
      }
    },
    facilities: {
      type: [String],
      default: []
    },
    images: {
      type: [String],
      default: []
    },
    hourlyRate: {
      type: Number,
      default: 0,
      min: [0, 'Hourly rate cannot be negative']
    },
    status: {
      type: String,
      enum: {
        values: VENUE_STATUS,
        message: '{VALUE} is not a valid status. Allowed values: ' + VENUE_STATUS.join(', ')
      },
      default: 'available'
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator administrator reference is required']
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
venueSchema.index({ name: 'text', location: 'text', description: 'text' });
venueSchema.index({ isArchived: 1, status: 1, capacity: 1 });
venueSchema.index({ createdBy: 1 });

const Venue = mongoose.model('Venue', venueSchema);

module.exports = {
  Venue,
  VENUE_STATUS
};
