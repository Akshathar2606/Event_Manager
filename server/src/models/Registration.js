const mongoose = require('mongoose');
const { STUDENT_YEARS } = require('./Event');

const REGISTRATION_STATUS = ['registered', 'cancelled'];

const registrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event reference is required']
    },
    participant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Participant reference is required']
    },
    academicYear: {
      type: String,
      enum: {
        values: STUDENT_YEARS,
        message: '{VALUE} is not a valid academic year. Allowed years: ' + STUDENT_YEARS.join(', ')
      }
    },
    status: {
      type: String,
      enum: {
        values: REGISTRATION_STATUS,
        message: '{VALUE} is not a valid registration status. Allowed values: ' + REGISTRATION_STATUS.join(', ')
      },
      default: 'registered'
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
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

// Compound unique index ensuring at most one registration document per participant per event
registrationSchema.index({ event: 1, participant: 1 }, { unique: true });
registrationSchema.index({ participant: 1, status: 1 });
registrationSchema.index({ event: 1, status: 1 });

const Registration = mongoose.model('Registration', registrationSchema);

module.exports = {
  Registration,
  REGISTRATION_STATUS
};
