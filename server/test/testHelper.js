const http = require('http');
const { Readable } = require('stream');
const { EventEmitter } = require('events');

/**
 * Dispatches an HTTP-like request directly into an Express app in-process.
 * Avoids socket binding and external network requirements.
 */
function request(app, { method = 'GET', url = '/', body = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    let bodyBuffer = null;
    const reqHeaders = { ...headers };

    if (body !== null && body !== undefined) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      bodyBuffer = Buffer.from(bodyStr);
      reqHeaders['content-type'] = reqHeaders['content-type'] || 'application/json';
      reqHeaders['content-length'] = String(bodyBuffer.length);
    }

    const socket = new EventEmitter();
    socket.destroy = function () {};
    socket.end = function () {};
    socket.write = function () {};
    socket.remoteAddress = '127.0.0.1';

    // Create a mock IncomingMessage that behaves as a readable stream
    const req = new Readable({
      read() {
        if (bodyBuffer) {
          this.push(bodyBuffer);
          bodyBuffer = null;
        } else {
          this.push(null);
        }
      }
    });

    req.method = method.toUpperCase();
    req.url = url;
    req.headers = reqHeaders;
    req.socket = socket;
    req.connection = socket;

    // Response collector
    const res = new http.ServerResponse(req);
    let chunks = [];

    // Override write and end
    res.write = function (chunk, encoding, callback) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      if (typeof callback === 'function') callback();
      return true;
    };

    res.end = function (chunk, encoding, callback) {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let data;
      try {
        data = JSON.parse(rawBody);
      } catch (err) {
        data = rawBody;
      }

      resolve({
        statusCode: res.statusCode,
        headers: res.getHeaders(),
        body: data
      });

      if (typeof callback === 'function') callback();
    };

    app(req, res);
  });
}

module.exports = {
  request
};
