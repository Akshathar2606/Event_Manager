const mongoose = require('mongoose');

const EVENT_CATEGORIES = [
  'academic',
  'cultural',
  'sports',
  'technical',
  'workshop',
  'seminar',
  'social',
  'conference',
  'other'
];

const EVENT_STATUS = ['draft', 'published', 'cancelled'];

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      minlength: [3, 'Event title must be at least 3 characters long'],
      maxlength: [150, 'Event title cannot exceed 150 characters']
    },
    description: {
      type: String,
      required: [true, 'Event description is required'],
      trim: true,
      maxlength: [3000, 'Event description cannot exceed 3000 characters']
    },
    category: {
      type: String,
      required: [true, 'Event category is required'],
      enum: {
        values: EVENT_CATEGORIES,
        message: '{VALUE} is not a valid event category. Allowed categories: ' + EVENT_CATEGORIES.join(', ')
      },
      lowercase: true,
      trim: true
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Event organizer reference is required']
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venue',
      default: null
    },
    startDateTime: {
      type: Date,
      required: [true, 'Event start date and time is required']
    },
    endDateTime: {
      type: Date,
      required: [true, 'Event end date and time is required'],
      validate: {
        validator: function (value) {
          if (!this.startDateTime || !value) return true;
          return value > this.startDateTime;
        },
        message: 'Event end date and time must be after the start date and time'
      }
    },
    registrationDeadline: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value || !this.startDateTime) return true;
          return value <= this.startDateTime;
        },
        message: 'Registration deadline cannot be after the event start date and time'
      }
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
    registeredCount: {
      type: Number,
      default: 0,
      min: [0, 'Registered count cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Registered count must be an integer'
      }
    },
    status: {
      type: String,
      enum: {
        values: EVENT_STATUS,
        message: '{VALUE} is not a valid status. Allowed values: ' + EVENT_STATUS.join(', ')
      },
      default: 'draft'
    },
    bannerUrl: {
      type: String,
      trim: true,
      default: ''
    },
    budget: {
      type: Number,
      min: [0, 'Budget cannot be negative'],
      default: 0
    },
    tags: {
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

// Search and compound indexes
eventSchema.index({ title: 'text', description: 'text', tags: 'text' });
eventSchema.index({ isArchived: 1, status: 1, startDateTime: 1 });
eventSchema.index({ organizer: 1, isArchived: 1 });
eventSchema.index({ venue: 1, isArchived: 1 });
eventSchema.index({ category: 1, status: 1 });

const Event = mongoose.model('Event', eventSchema);

module.exports = {
  Event,
  EVENT_CATEGORIES,
  EVENT_STATUS
};
