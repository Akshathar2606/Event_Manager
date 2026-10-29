const mongoose = require('mongoose');

const passwordRecoveryAttemptSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true }
  },
  { versionKey: false }
);

passwordRecoveryAttemptSchema.index({ key: 1, windowStart: 1 }, { unique: true });
passwordRecoveryAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordRecoveryAttempt', passwordRecoveryAttemptSchema);
