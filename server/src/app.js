const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Standard middleware
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:3000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive during early dev, tighten before prod
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection state descriptor
const DB_READY_STATE = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

// Health check endpoint: reports service health and database connectivity
app.get('/api/health', (req, res) => {
  const readyState = mongoose.connection ? mongoose.connection.readyState : 0;
  const isDbConnected = readyState === 1;
  const databaseStatus = DB_READY_STATE[readyState] || 'disconnected';

  if (!isDbConnected) {
    return res.status(503).json({
      status: 'degraded',
      service: 'EventFlow API',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: databaseStatus
    });
  }

  return res.status(200).json({
    status: 'ok',
    service: 'EventFlow API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: databaseStatus
  });
});

// Authentication and authorization routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Venue management routes
const venueRoutes = require('./routes/venueRoutes');
app.use('/api/venues', venueRoutes);

// Catering vendor & discovery routes
const cateringRoutes = require('./routes/cateringRoutes');
app.use('/api/catering', cateringRoutes);

// Event management routes
const eventRoutes = require('./routes/eventRoutes');
app.use('/api/events', eventRoutes);

// Venue booking management routes
const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('EventFlow API is running. Check /api/health for system status.');
});

// Global 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
