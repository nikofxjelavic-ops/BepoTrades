/**
 * GET  /api/giveaway/entries  — returns { total } for the logged-in Discord user
 * POST /api/giveaway/entries  — increments total by 1, returns { total }
 *
 * Required env vars:
 *   SESSION_SECRET  — same secret used by discord/callback.js
 *
 * Redis / KV env vars (accepts either naming — depends on which Vercel
 * integration is installed):
 *   KV_REST_API_URL   + KV_REST_API_TOKEN         (Vercel KV / newer Upstash template)
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  (Upstash direct)
 */
const { getUser } = require('../_lib/session');

function resolveKv() {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const source = process.env.KV_REST_API_URL ? 'KV_REST_API_*'
              : process.env.UPSTASH_REDIS_REST_URL ? 'UPSTASH_REDIS_REST_*'
              : 'none';
  return { url, token, source };
}

async function kv(method, path, kvUrl, kvToken) {
  const r = await fetch(`${kvUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${kvToken}` },
  });
  const bodyText = await r.text();
  if (!r.ok) {
    throw new Error(`KV ${method} ${path} → ${r.status} ${bodyText.slice(0, 200)}`);
  }
  try { return JSON.parse(bodyText); }
  catch { throw new Error(`KV ${method} ${path} → invalid JSON: ${bodyText.slice(0, 200)}`); }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  console.log('[giveaway/entries] method:', req.method);

  const user = getUser(req);
  if (!user) {
    console.warn('[giveaway/entries] no dc_session cookie → 401. User must be logged in via Discord first.');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  console.log('[giveaway/entries] user:', { id: user.id, username: user.username });

  const { url: kvUrl, token: kvToken, source } = resolveKv();
  console.log('[giveaway/entries] KV env source:', source, '| has url:', !!kvUrl, '| has token:', !!kvToken);

  if (!kvUrl || !kvToken) {
    /* Log every KV/Upstash-related env var name we can see so it's
     * obvious which prefix Vercel actually injected. */
    const kvEnvKeys = Object.keys(process.env).filter(k => /KV_|UPSTASH_|REDIS/i.test(k));
    console.error('[giveaway/entries] KV not configured. Available KV-ish env vars:', kvEnvKeys);
    return res.status(500).json({ error: 'KV not configured', available: kvEnvKeys });
  }

  const key = encodeURIComponent('gw:entries:' + user.id);

  try {
    if (req.method === 'GET') {
      const data = await kv('GET', `/get/${key}`, kvUrl, kvToken);
      console.log('[giveaway/entries] GET result:', data);
      return res.status(200).json({ total: parseInt(data.result || '0', 10) });
    }

    if (req.method === 'POST') {
      const data = await kv('POST', `/incrby/${key}/1`, kvUrl, kvToken);
      console.log('[giveaway/entries] INCRBY result:', data);
      return res.status(200).json({ total: parseInt(data.result || '0', 10) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[giveaway/entries] threw:', err.message);
    return res.status(502).json({ error: 'Storage error', detail: err.message });
  }
};
