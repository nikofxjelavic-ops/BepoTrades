/**
 * GET /api/discord/user
 * Returns the currently connected Discord user from the signed session cookie.
 * Returns { connected: false } if no valid session exists.
 *
 * Required env vars:
 *   SESSION_SECRET
 */
const crypto = require('crypto');

function parseCookies(header) {
  const cookies = {};
  (header || '').split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) cookies[key] = val;
  });
  return cookies;
}

function verifyToken(token, secret) {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(sig + '==', 'base64'),
      Buffer.from(expected + '==', 'base64')
    );
  } catch { return null; }
  if (!valid) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch { return null; }
}

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.dc_session;

  if (!token) return res.status(200).json({ connected: false });

  const secret = process.env.SESSION_SECRET;
  if (!secret) return res.status(200).json({ connected: false });

  const user = verifyToken(token, secret);
  if (!user) return res.status(200).json({ connected: false });

  return res.status(200).json({
    connected: true,
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatar: user.avatar,
  });
};
