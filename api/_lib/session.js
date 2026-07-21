/**
 * Shared session helper — verifies the dc_session cookie set by discord/callback.js
 */
const crypto = require('crypto');

function parseCookies(header) {
  const cookies = {};
  (header || '').split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return cookies;
}

function verifyToken(token, secret) {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig + '==', 'base64'), Buffer.from(expected + '==', 'base64'))) return null;
  } catch { return null; }
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { return null; }
}

function getUser(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.dc_session;
  if (!token) return null;
  return verifyToken(token, secret);
}

module.exports = { getUser };
