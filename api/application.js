/**
 * POST /api/application
 * Called when a user completes the mentorship qualification form on course.html.
 * Creates/upserts a contact in GoHighLevel with all qualification answers
 * stored as tags and custom fields, then triggers the mentorship workflow.
 *
 * Required env vars (set in Vercel dashboard):
 *   GHL_API_KEY       — Private Integration Token from GHL
 *   GHL_LOCATION_ID   — Your GHL sub-account Location ID
 */
/* Phone validation — mirror of api/book.js so the application step and
 * the booking step apply the same rules. E.164, no fake patterns. */
function isValidE164Phone(p) {
  if (typeof p !== 'string') return false;
  if (!/^\+[1-9]\d{6,14}$/.test(p)) return false;
  const digits = p.slice(1);
  if (/^(\d)\1+$/.test(digits)) return false;
  const fakes = ['1234567890', '0123456789', '12345678', '11111111', '00000000', '01234567'];
  if (fakes.indexOf(digits) !== -1) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, experience, situation, goal, investment } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email and phone are required' });
  }

  if (!isValidE164Phone(phone)) {
    console.warn('[application] rejecting invalid phone:', phone);
    return res.status(400).json({ error: 'Please enter a valid phone number.' });
  }

  const [firstName, ...rest] = name.trim().split(' ');
  const lastName = rest.join(' ') || '';

  /* Build readable tags from answers */
  const tags = [
    'mentorship-applicant',
    'website-lead',
    experience  ? `exp:${experience.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9:-]/g, '')}` : null,
    goal        ? `goal:${goal.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9:-]/g, '')}` : null,
    investment  ? `budget:${investment.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9:-]/g, '')}` : null,
  ].filter(Boolean);

  /* Custom fields — create these in GHL Settings > Custom Fields first */
  const customFields = [
    { key: 'trading_experience',  field_value: experience  || '' },
    { key: 'current_situation',   field_value: situation   || '' },
    { key: 'main_goal',           field_value: goal        || '' },
    { key: 'investment_budget',   field_value: investment  || '' },
  ].filter(f => f.field_value);

  try {
    const response = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locationId: process.env.GHL_LOCATION_ID,
        firstName,
        lastName,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        tags,
        customFields,
        source: 'mentorship-application',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('GHL application error:', err);
      return res.status(502).json({ error: 'CRM error', detail: err });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, contactId: data.contact?.id });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
