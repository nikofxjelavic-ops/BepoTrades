/**
 * GET /api/discord/callback
 * Handles the Discord OAuth2 redirect. Exchanges the code for a token,
 * fetches the user's Discord info, sets a signed session cookie, and
 * redirects back to the giveaway page.
 *
 * Required env vars:
 *   DISCORD_CLIENT_ID
 *   DISCORD_CLIENT_SECRET
 *   DISCORD_REDIRECT_URI
 *   SESSION_SECRET        — any long random string, used to sign the cookie
 *
 * Optional env vars (GHL integration):
 *   GHL_API_KEY
 *   GHL_LOCATION_ID
 */
const crypto = require('crypto');

function createToken(data, secret) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

async function pushToGHL(user) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  console.log('[discord/callback] pushToGHL called for user:', {
    id: user.id, username: user.username, email: user.email,
    verified: user.verified, global_name: user.global_name,
  });
  console.log('[discord/callback] GHL env vars — has GHL_API_KEY:', !!apiKey, '| has GHL_LOCATION_ID:', !!locationId);

  if (!apiKey || !locationId) {
    console.warn('[discord/callback] SKIP GHL — missing GHL_API_KEY or GHL_LOCATION_ID');
    return;
  }
  if (!user.email) {
    console.warn('[discord/callback] SKIP GHL — user.email is null. Discord account has no verified email or email scope was denied.');
    return;
  }

  const payload = {
    locationId,
    email: user.email,
    firstName: user.global_name || user.username,
    tags: ['giveaway-entrant', 'discord-connected'],
    source: 'bepotrades-giveaway',
    customFields: [
      { key: 'discord_username', field_value: user.username },
      { key: 'discord_id',       field_value: user.id },
    ],
  };
  console.log('[discord/callback] GHL upsert payload:', JSON.stringify(payload));

  try {
    const r = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = await r.text();
    console.log('[discord/callback] GHL upsert status:', r.status);
    console.log('[discord/callback] FULL GHL upsert response:', raw);
    if (!r.ok) console.error('[discord/callback] GHL upsert FAILED');
    else       console.log('[discord/callback] GHL contact upserted for', user.email);
  } catch (err) {
    console.error('[discord/callback] GHL fetch threw:', err.message);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const { code, error } = req.query;

  if (error || !code) {
    console.log('[discord/callback] OAuth cancelled or error:', error);
    return res.redirect('/giveaway?discord_error=cancelled');
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientId || !clientSecret || !redirectUri || !sessionSecret) {
    console.error('[discord/callback] Missing required env vars');
    return res.redirect('/giveaway?discord_error=config');
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const raw = await tokenRes.text();
      console.error('[discord/callback] Token exchange failed:', tokenRes.status, raw);
      return res.redirect('/giveaway?discord_error=failed');
    }

    const { access_token } = await tokenRes.json();

    // 2. Fetch Discord user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      console.error('[discord/callback] User fetch failed:', userRes.status);
      return res.redirect('/giveaway?discord_error=failed');
    }

    const user = await userRes.json();
    console.log('[discord/callback] Connected:', user.username, user.id);

    // 3. Push to GHL — must AWAIT on Vercel serverless. If we don't,
    // the runtime terminates when we return the redirect and kills
    // the in-flight fetch before it hits GHL. Fire-and-forget only
    // works on long-lived servers, not on serverless functions.
    // Extra ~200-500 ms latency on the OAuth redirect, worth it.
    await pushToGHL(user);

    // 4. Set signed session cookie (7 days)
    const token = createToken({
      id: user.id,
      username: user.username,
      displayName: user.global_name || user.username,
      email: user.email || null,
      avatar: user.avatar,
    }, sessionSecret);

    res.setHeader('Set-Cookie', `dc_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    return res.redirect('/giveaway');

  } catch (err) {
    console.error('[discord/callback] Unexpected error:', err.message);
    return res.redirect('/giveaway?discord_error=failed');
  }
};
