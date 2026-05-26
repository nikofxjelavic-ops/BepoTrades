/**
 * POST /api/book
 * 1. Creates Cal.com booking (server-side — no UI redirect)
 * 2. Upserts GHL contact with booking details
 * 3. Creates/updates GHL opportunity in "Mentorship Pipeline" > "Call Booked"
 * 4. Returns { ok: true } — frontend redirects to /confirm
 *
 * Required env vars:
 *   CAL_API_KEY          — Cal.com API key
 *   CAL_EVENT_TYPE_SLUG  — slug of your event type
 *   GHL_API_KEY          — GHL Private Integration Token
 *   GHL_LOCATION_ID      — GHL sub-account Location ID
 *
 * Body: { name, email, startTime, timeZone, answers: { experience, situation, goal, investment } }
 */

const CAL_BASE    = 'https://api.cal.com/v2';
const CAL_VERSION = '2024-06-14';
const GHL_BASE    = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

/* cached within the same serverless instance */
let _eventTypeId = null;

async function getEventTypeId(apiKey, slug) {
  if (_eventTypeId) return _eventTypeId;

  console.log('[book] resolving Cal.com event type ID for slug:', slug);
  const r = await fetch(`${CAL_BASE}/event-types`, {
    headers: {
      'Authorization':   'Bearer ' + apiKey,
      'cal-api-version': CAL_VERSION,
    },
  });

  const raw = await r.text();
  if (!r.ok) throw new Error('Cal.com event-types lookup failed: ' + r.status + ' ' + raw);

  const body = JSON.parse(raw);
  let eventTypes = [];
  if (Array.isArray(body.data)) {
    eventTypes = body.data;
  } else if (body.data?.eventTypeGroups) {
    for (const g of body.data.eventTypeGroups) {
      eventTypes = eventTypes.concat(g.eventTypes || []);
    }
  }

  const found = eventTypes.find(e => e.slug === slug);
  if (!found) {
    throw new Error(
      'No event type found for slug "' + slug + '". Available: ' +
      eventTypes.map(e => e.slug).join(', ')
    );
  }

  _eventTypeId = found.id;
  console.log('[book] resolved event type ID:', _eventTypeId);
  return _eventTypeId;
}

/* ── GHL helpers ─────────────────────────────────────────────────────────── */

function ghlHeaders(apiKey) {
  return {
    'Authorization': 'Bearer ' + apiKey,
    'Version':       GHL_VERSION,
    'Content-Type':  'application/json',
  };
}

async function ghlUpsertContact({ apiKey, locationId, name, email, phone, startTime, timeZone, bookingUid, meetUrl, applicationSummary }) {
  const [firstName, ...rest] = (name || '').trim().split(' ');
  const lastName = rest.join(' ') || '';

  const callDate = new Date(startTime).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: timeZone || 'UTC',
  });

  const body = {
    locationId,
    firstName,
    lastName,
    email: (email || '').trim().toLowerCase(),
    phone: phone || '',
    tags: ['mentorship-applicant', 'mentorship-call-booked'],
    customFields: [
      { key: 'call_date',           field_value: callDate },
      { key: 'call_timezone',       field_value: timeZone || 'UTC' },
      { key: 'cal_booking_uid',     field_value: String(bookingUid || '') },
      { key: 'google_meet_link',    field_value: meetUrl || '' },
      { key: 'application_answers', field_value: applicationSummary || '' },
    ].filter(f => f.field_value),
    source: 'mentorship-booking',
  };

  console.log('[book] GHL upsert contact:', email);
  const r = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method:  'POST',
    headers: ghlHeaders(apiKey),
    body:    JSON.stringify(body),
  });

  const raw = await r.text();
  console.log('[book] GHL contact upsert status:', r.status, raw.slice(0, 200));

  if (!r.ok) throw new Error('GHL contact upsert failed: ' + r.status + ' ' + raw);

  const data = JSON.parse(raw);
  return data.contact?.id || data.id;
}

async function ghlCreateOpportunity({ apiKey, locationId, contactId, name, startTime }) {
  /* fetch pipelines to resolve IDs by name */
  const pipelineRes = await fetch(
    `${GHL_BASE}/opportunities/pipelines?locationId=${locationId}`,
    { headers: ghlHeaders(apiKey) }
  );

  const pipelineRaw = await pipelineRes.text();
  console.log('[book] GHL pipelines status:', pipelineRes.status, pipelineRaw.slice(0, 300));

  if (!pipelineRes.ok) throw new Error('GHL pipelines lookup failed: ' + pipelineRes.status);

  const { pipelines = [] } = JSON.parse(pipelineRaw);
  const pipeline = pipelines.find(p => p.name === 'Mentorship Pipeline');

  if (!pipeline) {
    const names = pipelines.map(p => p.name).join(', ');
    throw new Error('Pipeline "Mentorship Pipeline" not found. Available: ' + names);
  }

  const stage = (pipeline.stages || []).find(s => s.name === 'Call Booked');
  if (!stage) {
    const names = (pipeline.stages || []).map(s => s.name).join(', ');
    throw new Error('Stage "Call Booked" not found. Available: ' + names);
  }

  console.log('[book] GHL pipeline:', pipeline.id, '| stage:', stage.id);

  const callDate = new Date(startTime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const oppBody = {
    pipelineId:      pipeline.id,
    pipelineStageId: stage.id,
    locationId,
    contactId,
    name:   'Mentorship Call — ' + name + ' (' + callDate + ')',
    status: 'open',
  };

  const oppRes = await fetch(`${GHL_BASE}/opportunities/`, {
    method:  'POST',
    headers: ghlHeaders(apiKey),
    body:    JSON.stringify(oppBody),
  });

  const oppRaw = await oppRes.text();
  console.log('[book] GHL opportunity create status:', oppRes.status, oppRaw.slice(0, 200));

  if (!oppRes.ok) throw new Error('GHL opportunity create failed: ' + oppRes.status + ' ' + oppRaw);
  return JSON.parse(oppRaw);
}

/* ── Main handler ────────────────────────────────────────────────────────── */

module.exports = async function handler(req, res) {
  console.log('[book] handler invoked, method:', req.method);

  const hasCalKey   = !!process.env.CAL_API_KEY;
  const hasCalSlug  = !!process.env.CAL_EVENT_TYPE_SLUG;
  const hasGhlKey   = !!process.env.GHL_API_KEY;
  const hasGhlLoc   = !!process.env.GHL_LOCATION_ID;
  console.log('[book] CAL_API_KEY:', hasCalKey, '| CAL_EVENT_TYPE_SLUG:', hasCalSlug);
  console.log('[book] GHL_API_KEY:', hasGhlKey, '| GHL_LOCATION_ID:',   hasGhlLoc);

  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasCalKey || !hasCalSlug) {
    return res.status(500).json({
      error: 'Missing Cal.com env vars',
      CAL_API_KEY: hasCalKey,
      CAL_EVENT_TYPE_SLUG: hasCalSlug,
    });
  }

  const { name, email, phone, startTime, timeZone, answers } = req.body || {};
  console.log('[book] booking request:', { name, email, phone, startTime, timeZone });

  if (!name || !email || !startTime) {
    return res.status(400).json({ error: 'Missing required fields: name, email, startTime' });
  }

  const { CAL_API_KEY, CAL_EVENT_TYPE_SLUG, GHL_API_KEY, GHL_LOCATION_ID } = process.env;

  /* ── Notes builder — called twice: once without meetUrl, once with ──────── */
  function buildNotes(meetUrl) {
    return [
      'Name:',
      name,
      '',
      'Email:',
      email,
      '',
      'Phone:',
      phone || 'Not provided',
      '',
      'Timezone:',
      timeZone || 'UTC',
      '',
      'Investment Budget:',
      answers?.investment || 'Not provided',
      '',
      'Trading Experience:',
      answers?.experience || 'Not provided',
      '',
      'Current Situation:',
      answers?.situation || 'Not provided',
      '',
      'Main Goal:',
      answers?.goal || 'Not provided',
      '',
      'Application Answers:',
      [
        answers?.experience ? 'Experience: ' + answers.experience : null,
        answers?.situation  ? 'Situation: '  + answers.situation  : null,
        answers?.goal       ? 'Goal: '       + answers.goal       : null,
        answers?.investment ? 'Budget: '     + answers.investment : null,
      ].filter(Boolean).join('\n'),
      '',
      'Google Meet Link:',
      meetUrl || 'Will appear in Google Calendar event',
    ].join('\n');
  }

  console.log('[book] notes builder ready for:', email);

  /* ── Step 1: Cal.com booking ─────────────────────────────────────────── */
  let booking;
  try {
    const eventTypeId = await getEventTypeId(CAL_API_KEY, CAL_EVENT_TYPE_SLUG);

    const initialNotes = buildNotes('');

    const payload = {
      eventTypeId,
      start: startTime,
      attendee: {
        name,
        email,
        timeZone: timeZone || 'UTC',
        language: 'en',
      },
      timeZone:    timeZone || 'UTC',
      language:    'en',
      metadata:    {},
      responses:   { name, email, notes: initialNotes },
      notes:       initialNotes,
      description: initialNotes,
    };

    console.log('[book] FULL Cal.com booking payload:', JSON.stringify(payload, null, 2));

    const r = await fetch(`${CAL_BASE}/bookings`, {
      method:  'POST',
      headers: {
        'Authorization':   'Bearer ' + CAL_API_KEY,
        'cal-api-version': CAL_VERSION,
        'Content-Type':    'application/json',
      },
      body: JSON.stringify(payload),
    });

    const raw = await r.text();
    console.log('[book] Cal.com response status:', r.status);
    console.log('[book] Cal.com response body:', raw.slice(0, 600));

    if (!r.ok) {
      return res.status(502).json({
        error:      'Cal.com booking failed',
        cal_status: r.status,
        detail:     raw,
      });
    }

    const body = JSON.parse(raw);
    booking = body.data || body;
    console.log('[book] Cal.com booking created, uid:', booking.uid || booking.id);

  } catch (err) {
    console.error('[book] Cal.com error:', err.message, err.stack);
    return res.status(500).json({ error: 'Booking failed', message: err.message });
  }

  const bookingUid = booking.uid || String(booking.id);
  const meetUrl    = booking.meetingUrl || booking.location || '';

  /* ── Step 2: PATCH Cal.com booking with full description + meet URL ──────── */
  const fullNotes = buildNotes(meetUrl);
  try {
    const patchBody = { description: fullNotes, notes: fullNotes };
    console.log('[book] FULL Cal.com PATCH payload:', JSON.stringify(patchBody, null, 2));

    const patchR = await fetch(`${CAL_BASE}/bookings/${bookingUid}`, {
      method:  'PATCH',
      headers: {
        'Authorization':   'Bearer ' + CAL_API_KEY,
        'cal-api-version': CAL_VERSION,
        'Content-Type':    'application/json',
      },
      body: JSON.stringify(patchBody),
    });

    const patchRaw = await patchR.text();
    console.log('[book] Cal.com PATCH status:', patchR.status);
    console.log('[book] Cal.com PATCH response:', patchRaw.slice(0, 400));
  } catch (patchErr) {
    console.error('[book] Cal.com PATCH failed (non-fatal):', patchErr.message);
  }

  /* ── Step 3: GHL contact + opportunity (non-fatal) ────────────────────── */
  if (hasGhlKey && hasGhlLoc) {
    try {
      const contactId = await ghlUpsertContact({
        apiKey:     GHL_API_KEY,
        locationId: GHL_LOCATION_ID,
        name, email, phone, startTime, timeZone,
        bookingUid, meetUrl, applicationSummary: fullNotes,
      });

      console.log('[book] GHL contact ID:', contactId);

      if (contactId) {
        await ghlCreateOpportunity({
          apiKey:     GHL_API_KEY,
          locationId: GHL_LOCATION_ID,
          contactId,
          name,
          startTime,
        });
      }

    } catch (ghlErr) {
      /* GHL failure must not block the booking confirmation */
      console.error('[book] GHL update failed (non-fatal):', ghlErr.message);
    }
  } else {
    console.warn('[book] GHL env vars missing — skipping CRM update');
  }

  /* ── Step 3: respond — frontend redirects to /confirm ────────────────── */
  return res.status(200).json({
    ok:        true,
    bookingId: bookingUid,
    meetUrl,
  });
};
