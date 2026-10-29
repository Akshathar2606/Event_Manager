const dotenv = require('dotenv');

// 1. Load environment variables before reading configuration or importing app/db
dotenv.config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const PasswordRecoveryAttempt = require('./src/models/PasswordRecoveryAttempt');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Sanitizes error messages to prevent leaking credentials in connection strings.
 */
const sanitizeErrorMessage = (error) => {
  if (!error || !error.message) return 'Unknown server error';
  return error.message.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, 'mongodb$1://***:***@');
};

/**
 * Starts the EventFlow HTTP server.
 * Requires MONGODB_URI and a successful database connection before accepting HTTP requests.
 */
const startServer = async () => {
  try {
    // 2. Require MONGODB_URI in normal development and production modes
    if (!process.env.MONGODB_URI) {
      console.error(
        '[Startup Error] MONGODB_URI environment variable is required. Please set MONGODB_URI before starting the server.'
      );
      process.exit(1);
    }

    // Await database connection before accepting any HTTP requests
    await connectDB();
    await PasswordRecoveryAttempt.init();

    const server = app.listen(PORT, () => {
      console.log(`[EventFlow Server] Running on port ${PORT} in ${NODE_ENV} mode`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error(`[Unhandled Rejection] Error: ${sanitizeErrorMessage(err)}`);
      // Close server & exit process gracefully
      server.close(() => process.exit(1));
    });

    return server;
  } catch (err) {
    // 3. Exit with a non-zero status if connection or startup fails
    console.error(`[Startup Error] Server initialization failed: ${sanitizeErrorMessage(err)}`);
    process.exit(1);
  }
};

// Start server if executed directly (e.g. node server.js)
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
