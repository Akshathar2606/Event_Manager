const mongoose = require('mongoose');

const BOOKING_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];

const bookingSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required']
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      required: [true, 'Venue reference is required']
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Organizer reference is required']
    },
    startDateTime: {
      type: Date,
      required: [true, 'Booking start date and time is required']
    },
    endDateTime: {
      type: Date,
      required: [true, 'Booking end date and time is required'],
      validate: {
        validator: function (value) {
          if (!this.startDateTime || !value) return true;
          return value > this.startDateTime;
        },
        message: 'Booking end date and time must be after the start date and time'
      }
    },
    purpose: {
      type: String,
      trim: true,
      maxlength: [1000, 'Purpose cannot exceed 1000 characters'],
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: ''
    },
    status: {
      type: String,
      enum: {
        values: BOOKING_STATUS,
        message: '{VALUE} is not a valid booking status. Allowed values: ' + BOOKING_STATUS.join(', ')
      },
      default: 'pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Rejection reason cannot exceed 1000 characters'],
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

// Indexes
bookingSchema.index({ venue: 1, status: 1, startDateTime: 1, endDateTime: 1, isArchived: 1 });
bookingSchema.index({ event: 1, isArchived: 1 });
bookingSchema.index({ organizer: 1, isArchived: 1, status: 1 });
bookingSchema.index({ status: 1, isArchived: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = {
  Booking,
  BOOKING_STATUS
};
