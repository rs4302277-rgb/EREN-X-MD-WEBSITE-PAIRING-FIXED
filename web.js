'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { startPairing, stopPairing, getActiveSessions, normalizeNumber, PAIRING_ROOT, sessionPathFor } = require('./pair');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Math.max(1, Number(process.env.PORT) || 3000);
const CHANNEL_URL = process.env.WHATSAPP_CHANNEL_URL || 'https://whatsapp.com/channel/0029VbBItW060eBXTB93HT1Q';
const startedAt = Date.now();
const visitors = new Set();
const pageViews = { total: 0 };
const jobs = new Map();
const ipWindows = new Map();
const phoneWindows = new Map();
const MAX_PENDING = Math.max(1, Number(process.env.MAX_PENDING_PAIRINGS) || 4);
const PAIR_TTL_MS = 60_000;

function clientIp(req) {
  // Railway sets X-Forwarded-For. Only use the first address for rate-limiting.
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function allowRate(map, key, limit, windowMs) {
  const now = Date.now();
  const existing = map.get(key) || [];
  const recent = existing.filter(time => now - time < windowMs);
  if (recent.length >= limit) {
    map.set(key, recent);
    return false;
  }
  recent.push(now);
  map.set(key, recent);
  return true;
}

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
  res.end(body);
}

function stats() {
  const active = getActiveSessions();
  let savedSessions = 0;
  try {
    savedSessions = fs.readdirSync(PAIRING_ROOT, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /@s\.whatsapp\.net$/.test(entry.name)).length;
  } catch {}
  return {
    visitors: visitors.size,
    pageViews: pageViews.total,
    activeSessions: active.filter(session => session.connected).length,
    runningSessions: active.length,
    savedSessions,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000)
  };
}

function readJson(req, maxBytes = 2048) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBytes) {
        reject(Object.assign(new Error('Request too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function safeStaticPath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (decoded === '/') decoded = '/index.html';
  const resolved = path.resolve(PUBLIC_DIR, `.${decoded}`);
  if (!resolved.startsWith(PUBLIC_DIR + path.sep) && resolved !== path.join(PUBLIC_DIR, 'index.html')) return null;
  return resolved;
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[ext] || 'application/octet-stream';
}

async function handlePair(req, res) {
  const ip = clientIp(req);
  if (!allowRate(ipWindows, ip, 5, 10 * 60_000)) {
    return sendJson(res, 429, { error: 'Too many attempts. Please wait a few minutes and try again.' });
  }
  const body = await readJson(req);
  let number;
  try {
    number = normalizeNumber(body.number);
    if (String(body.number || '').trim().startsWith('0')) throw new Error('Include your country calling code and do not start with 0.');
  } catch (error) {
    return sendJson(res, 400, { error: 'Enter a valid phone number with country calling code, digits only. Example: +919876543210.' });
  }
  if (!allowRate(phoneWindows, number, 3, 15 * 60_000)) {
    return sendJson(res, 429, { error: 'This number has requested too many codes. Please wait and try again.' });
  }
  if (getActiveSessions().some(session => session.number === number && session.connected)) {
    return sendJson(res, 409, { error: 'This WhatsApp number is already connected to this bot.' });
  }
  const pendingCount = [...jobs.values()].filter(job => job.state === 'waiting' || job.state === 'code_ready' || job.state === 'connecting').length;
  if (pendingCount >= MAX_PENDING) {
    return sendJson(res, 503, { error: 'The pairing service is busy right now. Please try again shortly.' });
  }

  const jobId = crypto.randomUUID();
  const job = { id: jobId, number, state: 'waiting', createdAt: Date.now(), code: null, error: null };
  jobs.set(jobId, job);
  // Keep the job map bounded on long-lived Railway deployments.
  for (const [id, item] of jobs) if (Date.now() - item.createdAt > 30 * 60_000) jobs.delete(id);

  try {
    const startPromise = startPairing(number, {
      onPairingCode: async code => {
        job.code = code;
        job.state = 'code_ready';
        job.expiresAt = Date.now() + PAIR_TTL_MS;
        if (job.expiryTimer) clearTimeout(job.expiryTimer);
        job.expiryTimer = setTimeout(async () => {
          if (job.state === 'code_ready' || job.state === 'waiting') {
            job.state = 'expired';
            job.code = null;
            try { await stopPairing(number, true); } catch (error) { console.warn('[pair expiry]', error.message); }
          }
        }, PAIR_TTL_MS);
        job.expiryTimer.unref?.();
      },
      onConnected: async () => {
        job.state = 'connected';
        job.code = null;
        if (job.expiryTimer) clearTimeout(job.expiryTimer);
      },
      onLoggedOut: async () => {
        job.state = 'logged_out';
        job.code = null;
        if (job.expiryTimer) clearTimeout(job.expiryTimer);
      }
    });
    let requestTimeout;
    try {
      await Promise.race([
        startPromise,
        new Promise((_, reject) => {
          requestTimeout = setTimeout(() => reject(new Error('Pairing request timed out. Please try again.')), 30_000);
          requestTimeout.unref?.();
        })
      ]);
    } finally {
      if (requestTimeout) clearTimeout(requestTimeout);
    }
    if (job.code) {
      return sendJson(res, 200, { jobId, state: job.state, code: job.code, expiresIn: 60, message: 'Code generated. Enter it in WhatsApp Linked devices promptly.' });
    }
    // Existing registered credentials may reconnect without needing a new pairing code.
    const credsPath = path.join(sessionPathFor(number), 'creds.json');
    let registered = false;
    try { registered = !!JSON.parse(fs.readFileSync(credsPath, 'utf8')).registered; } catch {}
    if (registered) {
      job.state = 'connecting';
      return sendJson(res, 202, { jobId, state: job.state, message: 'An existing session was found. Waiting for WhatsApp to reconnect; no new code is needed.' });
    }
    throw new Error('WhatsApp did not return a pairing code. Please retry once.');
  } catch (error) {
    job.state = 'error';
    job.error = error.message;
    job.code = null;
    if (job.expiryTimer) clearTimeout(job.expiryTimer);
    // Clean up only incomplete auth state; never erase a previously registered session.
    let registered = false;
    try { registered = !!JSON.parse(fs.readFileSync(path.join(sessionPathFor(number), 'creds.json'), 'utf8')).registered; } catch {}
    if (!registered) stopPairing(number, true).catch(cleanupError => console.warn('[pair cleanup]', cleanupError.message));
    console.error(`[website pairing ${number}]`, error.message);
    return sendJson(res, 502, { error: error.message || 'Pairing failed. Please try again.' });
  }
}

function startWebServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && pathname === '/api/stats') return sendJson(res, 200, stats());
      if (req.method === 'GET' && pathname === '/api/config') return sendJson(res, 200, { channelUrl: CHANNEL_URL });
      if (req.method === 'GET' && pathname === '/api/pair-status') {
        const jobId = new URL(req.url, 'http://localhost').searchParams.get('id') || '';
        const job = jobs.get(jobId);
        if (!job) return sendJson(res, 404, { error: 'Pairing request not found or expired.' });
        return sendJson(res, 200, { state: job.state, code: job.code, error: job.error, expiresAt: job.expiresAt || null });
      }
      if (req.method === 'POST' && pathname === '/api/pair') return await handlePair(req, res);
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed.' });

      const ip = clientIp(req);
      if (pathname === '/' || pathname === '/index.html') {
        visitors.add(ip);
        pageViews.total += 1;
      }
      const file = safeStaticPath(req.url);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
        return res.end('Not found');
      }
      res.writeHead(200, {
        'Content-Type': contentType(file),
        'Cache-Control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY'
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      if (!res.headersSent) sendJson(res, error.statusCode || 500, { error: error.message || 'Internal server error.' });
      else res.end();
    }
  });
  server.listen(PORT, '0.0.0.0', () => console.log(`🌐 Eren MD pairing website listening on port ${PORT}`));
  return server;
}

module.exports = { startWebServer };
