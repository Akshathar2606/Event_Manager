const mongoose = require('mongoose');

const EVENT_ACTIVITY_ACTIONS = [
  'event_created',
  'event_published',
  'event_updated',
  'event_cancelled',
  'event_completed',
  'participant_registered',
  'registration_cancelled',
  'attendance_marked',
  'venue_booking_requested',
  'venue_booking_approved',
  'venue_booking_rejected',
  'catering_request_created',
  'catering_request_accepted',
  'catering_request_rejected'
];

const eventActivitySchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    action: { type: String, enum: EVENT_ACTIVITY_ACTIONS, required: true },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    metadata: {
      type: new mongoose.Schema(
        {
          registrationId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
          bookingId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
          requestId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
          status: { type: String, maxlength: 30, default: undefined }
        },
        { _id: false, strict: 'throw' }
      ),
      default: () => ({})
    },
    dedupeKey: { type: String, required: true, unique: true, maxlength: 240 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

eventActivitySchema.index({ eventId:  1, createdAt: -1 });

const EventActivity = mongoose.model('EventActivity', eventActivitySchema);

module.exports = { EventActivity, EVENT_ACTIVITY_ACTIONS };
