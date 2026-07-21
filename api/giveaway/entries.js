/**
 * GET  /api/giveaway/entries  — returns { total } for the logged-in Discord user
 * POST /api/giveaway/entries  — increments total by 1, returns { total }
 *
 * Required env vars:
 *   SESSION_SECRET        — same secret used by discord/callback.js
 *   UPSTASH_REDIS_REST_URL   — auto-added by Vercel Upstash integration
 *   UPSTASH_REDIS_REST_TOKEN — auto-added by Vercel Upstash integration
 */
const { getUser } = require('../_lib/session');

async function kv(method, path, kvUrl, kvToken) {
  const r = await fetch(`${kvUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${kvToken}` },
  });
  if (!r.ok) throw new Error(`KV ${method} ${path} → ${r.status}`);
  return r.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) return res.status(500).json({ error: 'KV not configured' });

  const key = encodeURIComponent('gw:entries:' + user.id);

  try {
    if (req.method === 'GET') {
      const data = await kv('GET', `/get/${key}`, kvUrl, kvToken);
      return res.status(200).json({ total: parseInt(data.result || '0', 10) });
    }

    if (req.method === 'POST') {
      const data = await kv('POST', `/incrby/${key}/1`, kvUrl, kvToken);
      return res.status(200).json({ total: parseInt(data.result || '0', 10) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[giveaway/entries]', err.message);
    return res.status(502).json({ error: 'Storage error' });
  }
};
