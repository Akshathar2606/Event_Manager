const dotenv = require('dotenv');

// Load environment variables before importing app or db
dotenv.config();

const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas if URI is provided, otherwise warn and run in offline mode for health checks
if (process.env.MONGODB_URI) {
  connectDB();
} else {
  console.warn('[Database Warning] MONGODB_URI not provided. Running in offline/unconnected mode.');
}

const server = app.listen(PORT, () => {
  console.log(`[EventFlow Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[Unhandled Rejection] Error: ${err.message}`);
  // Close server & exit process gracefully
  server.close(() => process.exit(1));
});
