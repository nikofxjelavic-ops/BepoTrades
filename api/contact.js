/**
 * POST /api/contact
 * Called when a user claims the free course on the home page.
 * Creates/upserts a contact in GoHighLevel and applies the free-course tag.
 *
 * Required env vars:
 *   GHL_API_KEY       — Private Integration Token from GHL
 *   GHL_LOCATION_ID   — Your GHL sub-account Location ID
 */
module.exports = async function handler(req, res) {
  console.log('[contact] handler invoked, method:', req.method);

  const hasKey = !!process.env.GHL_API_KEY;
  const hasLoc = !!process.env.GHL_LOCATION_ID;
  console.log('[contact] GHL_API_KEY present:', hasKey);
  console.log('[contact] GHL_LOCATION_ID present:', hasLoc);

  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasKey || !hasLoc) {
    return res.status(500).json({ error: 'Missing GHL env vars', GHL_API_KEY: hasKey, GHL_LOCATION_ID: hasLoc });
  }

  const { name, email, phone } = req.body || {};
  console.log('[contact] received:', { name, email, phone: !!phone });

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const [firstName, ...rest] = name.trim().split(' ');
  const lastName = rest.join(' ') || '';

  const body = {
    locationId: process.env.GHL_LOCATION_ID,
    firstName,
    lastName,
    email:  email.trim().toLowerCase(),
    phone:  phone?.trim() || undefined,
    tags:   ['free-course', 'website-lead'],
    source: 'bepotrades-website',
  };

  console.log('[contact] upserting GHL contact:', email);

  try {
    const r = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.GHL_API_KEY,
        'Version':       '2021-07-28',
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await r.text();
    console.log('[contact] GHL response status:', r.status, raw.slice(0, 200));

    if (!r.ok) {
      console.error('[contact] GHL error:', r.status, raw);
      return res.status(502).json({ error: 'CRM error', detail: raw });
    }

    const data = JSON.parse(raw);
    console.log('[contact] GHL contact upserted, id:', data.contact?.id);
    return res.status(200).json({ success: true, contactId: data.contact?.id });

  } catch (err) {
    console.error('[contact] unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};
