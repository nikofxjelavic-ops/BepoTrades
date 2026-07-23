/**
 * POST /api/checklist
 * Upserts a GHL contact and tags them as a checklist lead.
 * GHL automation handles sending the checklist email.
 *
 * Required env vars:
 *   GHL_API_KEY      — Private Integration Token from GHL
 *   GHL_LOCATION_ID  — Your GHL sub-account Location ID
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { firstName, email } = req.body || {};

  if (!firstName || !email) {
    return res.status(400).json({ error: 'First name and email are required' });
  }

  const apiKey     = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    console.error('[checklist] Missing GHL env vars');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const r = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locationId,
        firstName: firstName.trim(),
        email: email.trim().toLowerCase(),
        tags: ['trading-checklist', 'website-lead'],
        source: 'checklist-page',
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[checklist] GHL error:', err);
      return res.status(502).json({ error: 'CRM error' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('[checklist] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
