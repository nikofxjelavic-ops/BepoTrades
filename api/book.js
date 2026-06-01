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

/* ── Meet URL extraction ─────────────────────────────────────────────────
 * Cal.com returns the conferencing integration ID (e.g.
 * "integrations:google:meet") in booking.location when the URL hasn't
 * been resolved yet. The real URL shows up in different fields depending
 * on conferencing app + API timing — check every candidate and only
 * accept actual http(s) URLs. */
function isRealUrl(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v);
}

function extractMeetUrl(booking) {
  if (!booking || typeof booking !== 'object') return '';

  const loc = booking.location;
  const locs = Array.isArray(booking.locations) ? booking.locations : [];

  const candidates = [
    booking.meetingUrl,
    booking.videoCallUrl,
    booking.conferencing?.url,
    booking.metadata?.videoCallUrl,
    booking.metadata?.meetingUrl,
    loc && typeof loc === 'object' ? loc.url || loc.link : null,
    locs[0]?.url,
    locs[0]?.link,
    locs[0]?.meetingUrl,
    booking.responses?.location?.value,
    booking.responses?.location,
    // location can itself be a raw URL string for some conferencing types
    typeof loc === 'string' && isRealUrl(loc) ? loc : null,
  ];

  for (const c of candidates) {
    if (isRealUrl(c)) return c;
  }
  return '';
}

/* ── Phone validation ─────────────────────────────────────────────────
 * The frontend uses intl-tel-input (libphonenumber-js under the hood),
 * but the API endpoint must defend itself. Accept only strict E.164:
 * leading +, 7–15 digits, no spaces. Reject obvious fake patterns. */
function isValidE164Phone(p) {
  if (typeof p !== 'string') return false;
  if (!/^\+[1-9]\d{6,14}$/.test(p)) return false;
  const digits = p.slice(1);
  if (/^(\d)\1+$/.test(digits)) return false;
  const fakes = ['1234567890', '0123456789', '12345678', '11111111', '00000000', '01234567'];
  if (fakes.indexOf(digits) !== -1) return false;
  return true;
}

/* cached within the same serverless instance */
let _eventTypeId           = null;
let _ghlCustomFieldMap     = null;   // { [displayName]: fieldId }
let _ghlCalendarOwnerByCal = {};     // { [calendarId]: userId }

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

/* Fetch GHL custom fields for the location and return TWO maps:
 *   byName:    "Display Name" → { id, fieldKey }
 *   byFieldKey: "field_key"   → { id, name }
 * Cached per-serverless-instance.
 *
 * We need fieldKey (not just id) because email-template merge tags
 * like {{contact.call_date}} resolve via fieldKey, NOT via id. If we
 * write to a field whose key isn't 'call_date', the merge tag stays
 * blank even though the field has data. */
async function getGhlCustomFieldMap(apiKey, locationId) {
  if (_ghlCustomFieldMap) return _ghlCustomFieldMap;

  console.log('[book] fetching GHL custom fields for location:', locationId);
  const r = await fetch(
    `${GHL_BASE}/locations/${locationId}/customFields`,
    { headers: ghlHeaders(apiKey) }
  );
  const raw = await r.text();
  console.log('[book] GHL customFields status:', r.status);
  console.log('[book] FULL GHL customFields response:', raw);

  if (!r.ok) {
    console.warn('[book] GHL custom-fields lookup failed — will fall back to key-based custom fields');
    return null;
  }

  const body = JSON.parse(raw);
  const list = body.customFields || body.data || [];

  /* Normalise GHL's fieldKey — it sometimes comes back prefixed
   * ("contact.call_date") and sometimes not ("call_date"). Merge tags
   * use the prefixed form, but the upsert API expects the bare slug. */
  function stripPrefix(k) {
    if (typeof k !== 'string') return '';
    return k.startsWith('contact.') ? k.slice('contact.'.length) : k;
  }

  const byName     = {};
  const byFieldKey = {};
  for (const f of list) {
    if (!f || !f.id) continue;
    const bareKey = stripPrefix(f.fieldKey || f.key || '');
    if (f.name) {
      byName[f.name] = { id: f.id, fieldKey: bareKey, rawFieldKey: f.fieldKey || f.key || '' };
    }
    if (bareKey) {
      byFieldKey[bareKey] = { id: f.id, name: f.name || '' };
    }
  }
  console.log('[book] GHL field map by name:', JSON.stringify(byName, null, 2));
  console.log('[book] GHL field map by fieldKey:', JSON.stringify(byFieldKey, null, 2));

  _ghlCustomFieldMap = { byName, byFieldKey };
  return _ghlCustomFieldMap;
}

async function ghlUpsertContact({ apiKey, locationId, name, email, phone, startTime, timeZone, bookingUid, meetUrl, applicationSummary }) {
  const [firstName, ...rest] = (name || '').trim().split(' ');
  const lastName = rest.join(' ') || '';

  /* Call Date is back to a human-readable string for nicer email
   * rendering via {{contact.call_date}}. Reminder timing is now driven
   * by the native GHL appointment record (see ghlCreateAppointment),
   * so this field no longer needs to be ISO/machine-parseable.
   * Format example: "June 2, 2026 at 7:00 PM" */
  const dateObj  = new Date(startTime);
  const tz       = timeZone || 'UTC';
  const datePart = dateObj.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: tz,
  });
  const timePart = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz,
  });
  const callDate = datePart + ' at ' + timePart;

  /* The custom fields we want to populate. Display names should
   * match the GHL field names exactly; the code falls back to
   * fieldKey matching if names don't line up. */
  const desiredFields = {
    'Call Date':            callDate,
    'Call Timezone':        tz,
    'Cal Booking UID':      String(bookingUid || ''),
    'Google Meet Link':     meetUrl || '',
    'Application Answers':  applicationSummary || '',
  };

  console.log('[book] GHL custom field values to send (by display name):');
  for (const [n, v] of Object.entries(desiredFields)) {
    console.log('  ' + n + ' = ' + JSON.stringify(v));
  }

  /* Resolve display names → { id, fieldKey } from Bepo's GHL location. */
  let fieldMap = null;
  try {
    fieldMap = await getGhlCustomFieldMap(apiKey, locationId);
  } catch (e) {
    console.error('[book] getGhlCustomFieldMap threw:', e.message);
  }

  /* Fallback slugs — used if no field is found by display name AND no
   * field is found whose fieldKey matches the expected slug below. */
  const expectedKeyByName = {
    'Call Date':           'call_date',
    'Call Timezone':       'call_timezone',
    'Cal Booking UID':     'cal_booking_uid',
    'Google Meet Link':    'google_meet_link',
    'Application Answers': 'application_answers',
  };

  /* Build customFields array. We send id + key + field_value together so
   * GHL accepts the payload regardless of which form its API expects.
   *   - field_value: documented form for /contacts/upsert v2
   *   - key:         the fieldKey (so {{contact.<key>}} merge tags resolve)
   *   - id:          unambiguous reference to the field */
  const customFields = [];
  for (const [displayName, value] of Object.entries(desiredFields)) {
    if (!value) {
      console.log('[book] skip "' + displayName + '" — empty value');
      continue;
    }

    let resolved =
      (fieldMap?.byName?.[displayName]) ||
      (fieldMap?.byFieldKey?.[expectedKeyByName[displayName]] && {
        id:       fieldMap.byFieldKey[expectedKeyByName[displayName]].id,
        fieldKey: expectedKeyByName[displayName],
      }) || null;

    /* Send every shape GHL v2 might accept. Different versions of the
     * /contacts/upsert endpoint expect different field names — be safe
     * by including all four:
     *   id           — UUID reference to the custom field
     *   key          — the fieldKey (drives {{contact.<key>}} merge tags)
     *   value        — newer LeadConnector format
     *   field_value  — legacy GHL v1 / v2 format
     * GHL ignores keys it doesn't recognize, so sending extra is safe. */
    if (resolved && resolved.id) {
      const entry = {
        id:          resolved.id,
        value:       value,
        field_value: value,
      };
      if (resolved.fieldKey) entry.key = resolved.fieldKey;
      customFields.push(entry);
      console.log(
        '[book] cf → id=' + resolved.id +
        ' key="' + (resolved.fieldKey || '(none)') + '"' +
        ' name="' + displayName + '"' +
        ' value=' + JSON.stringify(value)
      );
    } else {
      const key = expectedKeyByName[displayName];
      if (fieldMap) {
        console.warn(
          '[book] WARNING: no GHL field matches name="' + displayName + '"' +
          ' or fieldKey="' + key + '" — sending bare key form, merge tag may not resolve'
        );
      }
      customFields.push({ key, value, field_value: value });
    }
  }

  const body = {
    locationId,
    firstName,
    lastName,
    email: (email || '').trim().toLowerCase(),
    phone: phone || '',
    tags: ['mentorship-applicant', 'mentorship-call-booked'],
    customFields,
    source: 'mentorship-booking',
  };

  console.log('[book] GHL upsert contact:', email);
  console.log('[book] FULL GHL upsert payload:', JSON.stringify(body, null, 2));

  const r = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method:  'POST',
    headers: ghlHeaders(apiKey),
    body:    JSON.stringify(body),
  });

  const raw = await r.text();
  console.log('[book] GHL contact upsert status:', r.status);
  console.log('[book] FULL GHL contact upsert response:', raw);

  if (!r.ok) throw new Error('GHL contact upsert failed: ' + r.status + ' ' + raw);

  const data      = JSON.parse(raw);
  const contactId = data.contact?.id || data.id;

  /* ── Verification: GET the contact back and log what GHL actually stored.
   * If the custom field values we sent are present in the response, the
   * upsert worked. If they're absent, GHL silently rejected the format
   * (most common cause: wrong field-value key name for this API version). */
  if (contactId) {
    try {
      const verifyR = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
        headers: ghlHeaders(apiKey),
      });
      const verifyRaw = await verifyR.text();
      console.log('[book] GHL GET contact status:', verifyR.status);
      console.log('[book] FULL GHL GET contact response:', verifyRaw);

      if (verifyR.ok) {
        const v        = JSON.parse(verifyRaw);
        const contact  = v.contact || v;
        const stored   = contact.customFields || contact.customField || [];
        console.log('[book] GHL stored customFields on contact:', JSON.stringify(stored, null, 2));

        /* Cross-check: did each of our five fields actually persist? */
        const sentIds = customFields.map(f => f.id).filter(Boolean);
        for (const sentId of sentIds) {
          const got = stored.find(s => s.id === sentId);
          console.log(
            '[book] persisted? id=' + sentId +
            ' → ' + (got ? JSON.stringify(got.value ?? got.field_value ?? got) : '(MISSING)')
          );
        }
      }
    } catch (e) {
      console.error('[book] GHL verification GET failed:', e.message);
    }
  }

  /* ── Copy-paste-ready merge tag block ────────────────────────────────────
   * Uses the actual fieldKeys returned by Bepo's GHL — guaranteed to be
   * the strings that resolve in the workflow email templates. */
  if (fieldMap) {
    const tagLines = [];
    for (const displayName of Object.keys(desiredFields)) {
      const resolved =
        fieldMap.byName?.[displayName] ||
        (fieldMap.byFieldKey?.[expectedKeyByName[displayName]] && {
          fieldKey: expectedKeyByName[displayName],
        });
      const key = resolved?.fieldKey || expectedKeyByName[displayName] || '?';
      tagLines.push('  ' + displayName.padEnd(22) + ' {{contact.' + key + '}}');
    }
    console.log(
      '[book] ====== MERGE TAGS TO PASTE IN GHL EMAILS ======\n' +
      tagLines.join('\n') +
      '\n[book] ==============================================='
    );
  }

  return contactId;
}

/* Fetch GHL calendar details and resolve the owner / first team-member
 * userId. GHL appointments require assignedUserId (422 otherwise) and
 * different calendar types expose the owner in different places:
 *   Personal calendar  → calendar.userId
 *   Round Robin / Team → calendar.teamMembers[0].userId
 *   Some variants      → calendar.assignedUserId or assignedUserIds[0]
 * Cached per-serverless-instance, keyed by calendarId. */
async function getGhlCalendarOwnerUserId(apiKey, calendarId) {
  if (_ghlCalendarOwnerByCal[calendarId]) return _ghlCalendarOwnerByCal[calendarId];

  console.log('[book] fetching GHL calendar details for:', calendarId);
  const r = await fetch(
    `${GHL_BASE}/calendars/${calendarId}`,
    { headers: ghlHeaders(apiKey) }
  );
  const raw = await r.text();
  console.log('[book] GHL calendar GET status:', r.status);
  console.log('[book] GHL calendar details:', raw);

  if (!r.ok) {
    throw new Error('GHL calendar lookup failed: ' + r.status + ' ' + raw);
  }

  const body = JSON.parse(raw);
  const cal  = body.calendar || body.data || body;

  /* Walk every documented location the user id might live in. */
  const userId =
    cal.userId ||
    cal.assignedUserId ||
    (Array.isArray(cal.assignedUserIds) && cal.assignedUserIds[0]) ||
    (Array.isArray(cal.teamMembers) && cal.teamMembers[0]?.userId) ||
    (Array.isArray(cal.teamMembers) && cal.teamMembers[0]?.id) ||
    null;

  if (!userId) {
    throw new Error(
      'Could not resolve owner userId from calendar — calendar payload had no ' +
      'userId / assignedUserId / assignedUserIds / teamMembers[0].userId. ' +
      'Raw calendar: ' + raw.slice(0, 500)
    );
  }

  _ghlCalendarOwnerByCal[calendarId] = userId;
  return userId;
}

/* ── GHL Appointment ─────────────────────────────────────────────────────
 * Creates a native GHL calendar event so workflow "Appointment Booked"
 * triggers fire and "Wait X hours before appointment" actions can do
 * minute-precision math against the appointment's startTime.
 *
 * Why this exists: GHL Date-Picker custom fields are date-only, and
 * Bepo's GHL plan doesn't expose a DateTime field type. The contact's
 * 'Call Date' field can't drive hour-precision reminders on its own.
 * A native appointment record gives us that precision via GHL's built-in
 * appointment-aware workflow actions.
 *
 * Requires env var: GHL_CALENDAR_ID — the ID of any calendar in the
 * GHL sub-account. Type doesn't matter; the calendar just acts as a
 * container for externally-booked events. */
async function ghlCreateAppointment({
  apiKey, locationId, calendarId, contactId,
  name, startIso, endIso, meetUrl,
}) {
  /* Resolve the calendar owner so GHL accepts the appointment.
   * GHL returns 422 "A team member needs to be selected. assignedUserId
   * is missing" if this isn't included. */
  const assignedUserId = await getGhlCalendarOwnerUserId(apiKey, calendarId);
  console.log('[book] resolved assignedUserId:', assignedUserId);

  const body = {
    calendarId,
    locationId,
    contactId,
    assignedUserId,
    title:               'Mentorship Call — ' + name,
    appointmentStatus:   'confirmed',
    startTime:           startIso,
    endTime:             endIso,
    /* External meeting URL — surfaced in GHL UI as the join link. */
    meetingLocationType: 'custom',
    address:             meetUrl || '',
    /* Bypass GHL's own availability checks — Cal.com is the source of
     * truth for scheduling, and this GHL appointment exists purely so
     * reminder workflows have a datetime-precision object to wait
     * against. Two separate flags must be set:
     *   ignoreDateRange          — skip "is this within the calendar's
     *                              bookable window?" check
     *   ignoreFreeSlotValidation — skip "is this exact slot currently
     *                              open on the calendar?" check
     * Without the second flag GHL returns:
     *   "The slot you have selected is no longer available." */
    ignoreDateRange:          true,
    ignoreFreeSlotValidation: true,
    /* Don't let GHL send its own auto-notification email — reminder
     * workflows in GHL drive all customer-facing messages. */
    toNotify:                 false,
  };

  console.log('[book] FULL GHL appointment payload:', JSON.stringify(body, null, 2));

  const r = await fetch(`${GHL_BASE}/calendars/events/appointments`, {
    method:  'POST',
    headers: ghlHeaders(apiKey),
    body:    JSON.stringify(body),
  });

  const raw = await r.text();
  console.log('[book] GHL appointment create status:', r.status);
  console.log('[book] FULL GHL appointment response:', raw);

  if (!r.ok) throw new Error('GHL appointment create failed: ' + r.status + ' ' + raw);

  const data = JSON.parse(raw);
  const apptId = data.id || data.appointment?.id || data.event?.id;
  console.log('[book] GHL appointment created, id:', apptId);
  return apptId;
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
  const hasGhlCal   = !!process.env.GHL_CALENDAR_ID;
  console.log('[book] CAL_API_KEY:', hasCalKey, '| CAL_EVENT_TYPE_SLUG:', hasCalSlug);
  console.log('[book] GHL_API_KEY:', hasGhlKey, '| GHL_LOCATION_ID:',   hasGhlLoc, '| GHL_CALENDAR_ID:', hasGhlCal);

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

  /* Server-side phone validation — frontend uses intl-tel-input +
   * libphonenumber-js, but never trust the client. Phone is optional;
   * if present, it must be valid E.164. Catches fake numbers like
   * 123456, 0000000000, 1111111111 etc. */
  if (phone && !isValidE164Phone(phone)) {
    console.warn('[book] rejecting invalid phone:', phone);
    return res.status(400).json({ error: 'Please enter a valid phone number.' });
  }

  const { CAL_API_KEY, CAL_EVENT_TYPE_SLUG, GHL_API_KEY, GHL_LOCATION_ID, GHL_CALENDAR_ID } = process.env;

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
      meetUrl || 'Will appear in the calendar event',
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
    console.log('[book] FULL Cal.com booking response body:', raw);

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

  const bookingUid    = booking.uid || String(booking.id);
  /* Capture exact start/end from Cal.com — these become the GHL
   * appointment's startTime/endTime. Fall back to the requested
   * startTime + 30 min if Cal.com doesn't echo them. */
  const bookingStart  = booking.start || booking.startTime || startTime;
  const bookingEnd    = booking.end   || booking.endTime   ||
    new Date(new Date(bookingStart).getTime() + 30 * 60 * 1000).toISOString();
  console.log('[book] booking time window:', bookingStart, '→', bookingEnd);

  let   meetUrl    = extractMeetUrl(booking);
  console.log('[book] meetUrl after initial extraction:', meetUrl || '(empty)');
  console.log('[book] booking.location was:', JSON.stringify(booking.location));

  /* ── Refetch booking if Google Meet URL hasn't resolved yet ──────────
   * For Google Meet the URL is created when Cal.com syncs to Google
   * Calendar — that happens after the booking POST returns. A follow-up
   * GET usually has the real URL. */
  if (!meetUrl) {
    console.log('[book] No meet URL on create response, refetching booking:', bookingUid);
    try {
      const getR = await fetch(`${CAL_BASE}/bookings/${bookingUid}`, {
        headers: {
          'Authorization':   'Bearer ' + CAL_API_KEY,
          'cal-api-version': CAL_VERSION,
        },
      });
      const getRaw = await getR.text();
      console.log('[book] GET booking status:', getR.status);
      console.log('[book] FULL Cal.com GET booking response:', getRaw);
      if (getR.ok) {
        const getBody    = JSON.parse(getRaw);
        const refreshed  = getBody.data || getBody;
        meetUrl = extractMeetUrl(refreshed);
        console.log('[book] meetUrl after refetch:', meetUrl || '(still empty)');
      }
    } catch (e) {
      console.error('[book] booking refetch failed:', e.message);
    }
  }

  console.log('[book] FINAL meetingLink before GHL:', meetUrl || '(empty)');

  /* Build the full application-notes string (used as the
   * Application Answers custom field in GHL). No longer PATCHed back
   * to Cal.com — that endpoint 404'd and the notes weren't being read
   * from there anyway. */
  const fullNotes = buildNotes(meetUrl);

  /* ── Step 2: GHL contact + opportunity (non-fatal) ────────────────────── */
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
        /* Native GHL appointment — drives "Wait X hours before
         * appointment" reminder workflows. Independent of the
         * opportunity create below; if appointment fails (e.g.
         * missing GHL_CALENDAR_ID env var) we still want the
         * opportunity to land. */
        if (hasGhlCal) {
          try {
            await ghlCreateAppointment({
              apiKey:     GHL_API_KEY,
              locationId: GHL_LOCATION_ID,
              calendarId: GHL_CALENDAR_ID,
              contactId,
              name,
              startIso:   bookingStart,
              endIso:     bookingEnd,
              meetUrl,
            });
          } catch (apptErr) {
            console.error('[book] GHL appointment create failed (non-fatal):', apptErr.message);
          }
        } else {
          console.warn('[book] GHL_CALENDAR_ID missing — skipping appointment create; reminder workflows will not have an appointment to wait against');
        }

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
  /* (Renumbered since the Cal.com PATCH step was removed.) */
  return res.status(200).json({
    ok:        true,
    bookingId: bookingUid,
    meetUrl,
  });
};
