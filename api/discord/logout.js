/**
 * GET /api/discord/logout
 * Clears the Discord session cookie and redirects back to the giveaway page.
 */
module.exports = function handler(req, res) {
  res.setHeader('Set-Cookie', 'dc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.redirect('/giveaway');
};
