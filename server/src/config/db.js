const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Ensure environment variables are loaded if db.js is invoked directly
dotenv.config();

/**
 * Sanitizes error messages to prevent leaking credentials in connection strings.
 */
const sanitizeErrorMessage = (error) => {
  if (!error || !error.message) return 'Unknown database error';
  return error.message.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb$1://***:***@');
};

/**
 * Connects to MongoDB using Mongoose.
 * @param {string} [uri] - Optional MongoDB connection URI (defaults to process.env.MONGODB_URI)
 * @returns {Promise<mongoose.Mongoose>}
 */
const connectDB = async (uri = process.env.MONGODB_URI) => {
  if (!uri) {
    const errorMsg = 'MONGODB_URI environment variable is required.';
    console.error(`[Database Error] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Database] MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${sanitizeErrorMessage(error)}`);
    throw error;
  }
};

module.exports = connectDB;
