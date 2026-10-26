const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../src/app');
const { request } = require('./testHelper');
const connectDB = require('../src/config/db');

describe('EventFlow Health Check & MongoDB Startup Sequence Tests', () => {
  afterEach(() => {
    // Clean up any test overrides on mongoose.connection.readyState
    delete mongoose.connection.readyState;
  });

  describe('1. Health Check Endpoint (/api/health)', () => {
    test('returns 503 and degraded status when MongoDB is disconnected', async () => {
      // Ensure readyState is 0 (disconnected)
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 0,
        configurable: true
      });

      const res = await request(app, {
        method: 'GET',
        url: '/api/health'
      });

      assert.equal(res.statusCode, 503);
      assert.equal(res.body.status, 'degraded');
      assert.equal(res.body.service, 'EventFlow API');
      assert.equal(res.body.database, 'disconnected');
      assert.ok(res.body.timestamp);
    });

    test('returns 200 and ok status when MongoDB is connected', async () => {
      // Simulate connected state (readyState === 1)
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      });

      const res = await request(app, {
        method: 'GET',
        url: '/api/health'
      });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.service, 'EventFlow API');
      assert.equal(res.body.database, 'connected');
      assert.ok(res.body.timestamp);
    });
  });

  describe('2. Database Connection Initialization (connectDB)', () => {
    test('rejects with descriptive error if MONGODB_URI is missing', async () => {
      await assert.rejects(
        async () => {
          await connectDB('');
        },
        {
          name: 'Error',
          message: /MONGODB_URI environment variable is required/i
        }
      );
    });
  });
});
