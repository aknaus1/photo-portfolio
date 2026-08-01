/* ============================================================
   POST /api/stripe-webhook

   The only thing that turns a pencilled-in day into a confirmed
   one. Stripe calls this when a Checkout session is paid; we
   check the signature ourselves (HMAC over "timestamp.body", the
   scheme Stripe documents) and flip the calendar event from
   tentative to confirmed.

   Point a Stripe webhook endpoint at this URL and subscribe to
   checkout.session.completed. Anything else is acknowledged and
   ignored.
   ============================================================ */

"use strict";

const {
  CALENDAR,
  json,
  readRaw,
  googleCalendar,
  verifyStripeSignature,
} = require("./_lib.js");

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "POST only" });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json(res, 501, { ok: false, error: "webhook not configured" });

  const raw = await readRaw(req).catch(() => null);
  if (raw == null) return json(res, 400, { ok: false, error: "no body" });

  if (!verifyStripeSignature(raw, req.headers["stripe-signature"], secret)) {
    return json(res, 400, { ok: false, error: "bad signature" });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch (err) {
    return json(res, 400, { ok: false, error: "bad json" });
  }

  /* Acknowledge everything — an unhandled type is not an error, and
     failing here just makes Stripe retry forever. */
  if (event.type !== "checkout.session.completed") {
    return json(res, 200, { ok: true, ignored: event.type });
  }

  const meta = (event.data && event.data.object && event.data.object.metadata) || {};
  if (!meta.eventId) return json(res, 200, { ok: true, ignored: "no event id" });

  try {
    await googleCalendar(
      "/calendars/" + encodeURIComponent(CALENDAR) + "/events/" + encodeURIComponent(meta.eventId),
      {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed", colorId: "10" /* green: paid */ }),
      }
    );
  } catch (err) {
    /* 5xx so Stripe retries; the payment is real either way. */
    console.error("webhook/patch:", err.message);
    return json(res, 500, { ok: false, error: "couldn't update the calendar" });
  }

  return json(res, 200, { ok: true, ref: meta.ref || null });
}

module.exports = handler;

/* Stripe signs the raw bytes, so the body must not be parsed first.
   (Set after the export, or the assignment above would wipe it.) */
module.exports.config = { api: { bodyParser: false } };
