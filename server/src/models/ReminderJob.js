const mongoose = require('mongoose');

const REMINDER_JOB_TYPES = [
  'event_organizer_7_day',
  'event_organizer_24_hour',
  'event_participant_24_hour',
  'event_participant_1_hour',
  'booking_pending_24_hour',
  'catering_pending_24_hour',
  'vendor_application_pending_48_hour'
];

const REMINDER_JOB_STATUSES = ['pending', 'processing', 'retry', 'delivered', 'cancelled', 'missed', 'failed'];

const reminderJobSchema = new mongoose.Schema(
  {
    dedupeKey: { type: String, required: true, unique: true, maxlength: 300 },
    type: { type: String, required: true, enum: REMINDER_JOB_TYPES },
    entityType: {
      type: String,
      required: true,
      enum: ['event', 'booking', 'cateringRequest', 'vendorApplication']
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    scheduledAt: { type: Date, required: true, index: true },
    eventStartAt: { type: Date, default: null },
    intervalNumber: { type: Number, default: null, min: 1 },
    status: { type: String, enum: REMINDER_JOB_STATUSES, default: 'pending', index: true },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 5, min: 1, max: 10 },
    nextAttemptAt: { type: Date, required: true, index: true },
    lockToken: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
    lastErrorCode: { type: String, maxlength: 80, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null }
  },
  { timestamps: true }
);

reminderJobSchema.index({ status:  1, nextAttemptAt: 1, scheduledAt: 1 });
reminderJobSchema.index({ entityType: 1, entityId: 1, status: 1 });

const ReminderJob = mongoose.model('ReminderJob', reminderJobSchema);

module.exports = { ReminderJob, REMINDER_JOB_TYPES, REMINDER_JOB_STATUSES };
