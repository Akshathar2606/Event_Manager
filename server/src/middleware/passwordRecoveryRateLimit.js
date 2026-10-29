const crypto = require('crypto');
const mongoose = require('mongoose');
const PasswordRecoveryAttempt = require('../models/PasswordRecoveryAttempt');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;

const incrementMockCounter = (store, key, now) => {
  for (const [storedKey, entry] of store) {
    if (entry.expiresAt <= now) store.delete(storedKey);
  }

  const current = store.get(key);
  const count = current ? current.count + 1 : 1;
  store.set(key, { count, expiresAt: now + WINDOW_MS });
  return count;
};

const incrementMongoCounter = async (key, windowStart, expiresAt) => {
  const query = { key, windowStart: new Date(windowStart) };
  const update = {
    $inc: { count: 1 },
    $setOnInsert: { expiresAt: new Date(expiresAt) }
  };

  try {
    return await PasswordRecoveryAttempt.findOneAndUpdate(query, update, {
      upsert: true,
      new: true
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return PasswordRecoveryAttempt.findOneAndUpdate(query, { $inc: { count: 1 } }, { new: true });
  }
};

const passwordRecoveryRateLimit = async (req, res, next) => {
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const clientIp = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  const key = crypto.createHash('sha256').update(`${req.path}:${clientIp}`).digest('hex');
  const windowKey = `${key}:${windowStart}`;

  try {
    let count;
    if (req.app.locals.mockUserStore) {
      if (!req.app.locals.mockRecoveryRateLimitStore) {
        req.app.locals.mockRecoveryRateLimitStore = new Map();
      }
      count = incrementMockCounter(req.app.locals.mockRecoveryRateLimitStore, windowKey, now);
    } else {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          message: 'Password recovery is temporarily unavailable.'
        });
      }
      const attempt = await incrementMongoCounter(
        key,
        windowStart,
        windowStart + WINDOW_MS * 2
      );
      count = attempt.count;
    }

    if (count > MAX_REQUESTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many password recovery attempts. Please try again later.',
        code: 'RATE_LIMITED'
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  MAX_REQUESTS,
  WINDOW_MS,
  passwordRecoveryRateLimit
};
