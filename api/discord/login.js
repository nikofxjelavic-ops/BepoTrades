/**
 * GET /api/discord/login
 * Redirects the user to Discord OAuth2 authorization page.
 *
 * Required env vars:
 *   DISCORD_CLIENT_ID    — OAuth2 Application Client ID
 *   DISCORD_REDIRECT_URI — Must exactly match the redirect URI in Discord dev portal
 *                          e.g. https://bepotrades.com/api/discord/callback
 */
module.exports = function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error('[discord/login] Missing DISCORD_CLIENT_ID or DISCORD_REDIRECT_URI env vars');
    return res.status(500).send('Discord OAuth not configured.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
};
