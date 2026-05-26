/**
 * GET /api/slots
 * Fetches available time slots from Cal.com for the next 14 days.
 * Groups slots by date for the custom calendar UI.
 *
 * Required env vars:
 *   CAL_API_KEY          — Cal.com API key (Settings > Developer > API Keys)
 *   CAL_EVENT_TYPE_SLUG  — slug of your event type, e.g. "mentorship-call"
 */

const CAL_BASE    = 'https://api.cal.com/v2';
const CAL_VERSION = '2024-06-14';

/* cached within the same serverless instance to avoid repeat lookups */
let _eventTypeId = null;

async function getEventTypeId(apiKey, slug) {
  if (_eventTypeId) return _eventTypeId;

  console.log('[slots] resolving event type ID for slug:', slug);
  const r = await fetch(`${CAL_BASE}/event-types`, {
    headers: {
      'Authorization':   'Bearer ' + apiKey,
      'cal-api-version': CAL_VERSION,
    },
  });

  const raw = await r.text();
  if (!r.ok) throw new Error('event-types lookup failed: ' + r.status + ' ' + raw);

  const body = JSON.parse(raw);
  console.log('[slots] event-types raw (truncated):', raw.slice(0, 400));

  /* handle both possible response shapes */
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
      'No event type found for slug "' + slug + '". Available slugs: ' +
      eventTypes.map(e => e.slug).join(', ')
    );
  }

  _eventTypeId = found.id;
  console.log('[slots] resolved event type ID:', _eventTypeId);
  return _eventTypeId;
}

async function fetchSlotWindow(apiKey, eventTypeId, start, end) {
  const url =
    `${CAL_BASE}/slots/available` +
    '?startTime=' + encodeURIComponent(start.toISOString()) +
    '&endTime='   + encodeURIComponent(end.toISOString()) +
    '&eventTypeId=' + eventTypeId;

  console.log('[slots] fetching window:', start.toISOString(), '→', end.toISOString());

  const r = await fetch(url, {
    headers: {
      'Authorization':   'Bearer ' + apiKey,
      'cal-api-version': CAL_VERSION,
    },
  });

  const raw = await r.text();
  if (!r.ok) throw { cal_status: r.status, detail: raw };

  const body = JSON.parse(raw);
  console.log('[slots] Cal.com response status:', r.status, '| slot dates:', Object.keys(body.data?.slots || {}).length);
  return body.data?.slots || {};
}

module.exports = async function handler(req, res) {
  console.log('[slots] handler invoked, method:', req.method);

  const hasKey  = !!process.env.CAL_API_KEY;
  const hasSlug = !!process.env.CAL_EVENT_TYPE_SLUG;
  console.log('[slots] CAL_API_KEY present:', hasKey);
  console.log('[slots] CAL_EVENT_TYPE_SLUG present:', hasSlug);

  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasKey || !hasSlug) {
    return res.status(500).json({
      error: 'Missing env vars',
      CAL_API_KEY: hasKey,
      CAL_EVENT_TYPE_SLUG: hasSlug,
    });
  }

  const { CAL_API_KEY, CAL_EVENT_TYPE_SLUG } = process.env;

  try {
    const eventTypeId = await getEventTypeId(CAL_API_KEY, CAL_EVENT_TYPE_SLUG);

    /* Cal.com accepts any range — use two 7-day windows for 14 days total */
    const start1 = new Date(Date.now() + 5 * 60 * 1000);
    const end1   = new Date(start1.getTime() + 7 * 24 * 60 * 60 * 1000);
    const start2 = end1;
    const end2   = new Date(start2.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [week1, week2] = await Promise.all([
      fetchSlotWindow(CAL_API_KEY, eventTypeId, start1, end1),
      fetchSlotWindow(CAL_API_KEY, eventTypeId, start2, end2),
    ]);

    /* merge both weeks; Cal.com returns { 'YYYY-MM-DD': [{ time }] } */
    const byDate = {};
    for (const [date, slots] of Object.entries({ ...week1, ...week2 })) {
      byDate[date] = slots.map(s => s.time);
    }

    console.log('[slots] total available dates:', Object.keys(byDate).length);
    return res.status(200).json({ availability: byDate });

  } catch (err) {
    if (err.cal_status) {
      console.error('[slots] Cal.com API error:', err.cal_status, err.detail);
      return res.status(502).json({
        error:      'Cal.com API error',
        cal_status: err.cal_status,
        detail:     err.detail,
      });
    }
    console.error('[slots] unexpected error:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};
