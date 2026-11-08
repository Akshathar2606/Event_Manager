const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'event_published',
  'event_updated',
  'event_cancelled',
  'registration_created',
  'registration_cancelled',
  'booking_requested',
  'booking_approved',
  'booking_rejected',
  'catering_requested',
  'catering_accepted',
  'catering_rejected',
  'catering_cancelled',
  'vendor_application_submitted',
  'vendor_application_approved',
  'vendor_application_rejected',
  'event_reminder',
  'booking_pending_reminder',
  'catering_pending_reminder',
  'vendor_application_pending_reminder'
];

const ENTITY_TYPES = ['event', 'registration', 'booking', 'cateringRequest', 'vendorApplication'];

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 300 },
    entityType: { type: String, enum: ENTITY_TYPES, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    readAt: { type: Date, default: null },
    dedupeKey: { type: String, required: true, unique: true, maxlength: 240 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification, NOTIFICATION_TYPES, ENTITY_TYPES };
