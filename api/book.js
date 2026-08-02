/* ============================================================
   POST /api/book

   Pencils the session into Google Calendar as a *tentative* event
   and, if the visitor chose card, hands back a Stripe Checkout
   URL for the deposit. api/stripe-webhook.js flips the event to
   confirmed once that payment lands.

   The one rule worth enforcing server-side is the one the client
   can't be trusted with: one session a day. Everything else on the
   slip is an estimate that Kiana confirms by hand anyway.

   Returns 501 when nothing is configured, and booking.js quietly
   falls back to the prefilled-email flow.
   ============================================================ */

"use strict";

const {
  TZ,
  CALENDAR,
  json,
  readJson,
  localDateTime,
  dateInTz,
  addDays,
  isDate,
  googleCalendar,
  busyDates,
  stripe,
} = require("./_lib.js");

/* Hard bounds on what can ever be charged, whatever the page sends. */
const DEPOSIT_MIN = Number(process.env.KL_DEPOSIT_MIN || 40);
const DEPOSIT_MAX = Number(process.env.KL_DEPOSIT_MAX || 250);
const HORIZON_DAYS = Number(process.env.KL_HORIZON_DAYS || 150);
const SITE = (process.env.KL_SITE_URL || "").replace(/\/$/, "");

const clean = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max || 200);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "POST only" });
  }

  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return json(res, 501, { ok: false, error: "booking backend not configured" });
  }

  const body = await readJson(req).catch(() => null);
  if (!body) return json(res, 400, { ok: false, error: "bad request body" });

  /* ---------------- validate ---------------- */

  const date = body.date;
  const start = Number(body.start);
  const minutes = Number(body.minutes);
  const email = clean(body.email, 120);
  const name = clean(body.name, 120);

  const today = dateInTz(new Date());
  const problems = [];

  if (!isDate(date)) problems.push("date");
  else if (date < today || date > addDays(today, HORIZON_DAYS)) problems.push("date out of range");
  if (!Number.isInteger(start) || start < 0 || start > 1439 || start % 30 !== 0) problems.push("start");
  if (!Number.isInteger(minutes) || minutes < 30 || minutes > 12 * 60) problems.push("length");
  if (start + minutes > 24 * 60) problems.push("session runs past midnight");
  if (!name) problems.push("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("email");

  if (problems.length) return json(res, 400, { ok: false, error: "check: " + problems.join(", ") });

  /* ---------------- one session a day ---------------- */

  try {
    const taken = await busyDates(date, date);
    if (taken.length) {
      return json(res, 409, {
        ok: false,
        error: "that day just went — someone booked it while you were filling this in",
      });
    }
  } catch (err) {
    console.error("book/freebusy:", err.message);
    return json(res, 502, { ok: false, error: "couldn't reach the calendar" });
  }

  /* ---------------- pencil it in ---------------- */

  const estimate = body.estimate && typeof body.estimate === "object" ? body.estimate : {};
  const sessionName = clean((estimate.session && estimate.session.name) || "Film session", 80);
  const reference = clean(body.reference, 40) || date.replace(/-/g, "");
  const deposit = Math.min(
    DEPOSIT_MAX,
    Math.max(DEPOSIT_MIN, Math.round(Number(estimate.deposit) || 0))
  );

  const description = [
    sessionName,
    "",
    "Name:   " + name,
    "Email:  " + email,
    "Phone:  " + (clean(body.phone, 40) || "—"),
    "Where:  " + (clean(body.where, 160) || "up to Kiana"),
    "",
    "On the slip: " + clean(body.summary, 400),
    "Estimate:    $" + (Number(estimate.total) || 0).toFixed(2),
    "Deposit:     $" + deposit + " (" + clean(body.pay, 20) + ")",
    "Ref:         " + reference,
    "",
    clean(body.message, 1200) || "(no note)",
    "",
    "— booked from kianalee.photo. Tentative until the deposit lands.",
  ].join("\n");

  let event;
  try {
    event = await googleCalendar("/calendars/" + encodeURIComponent(CALENDAR) + "/events", {
      method: "POST",
      body: JSON.stringify({
        summary: sessionName + " — " + name,
        description,
        location: clean(body.where, 160) || undefined,
        status: "tentative",
        start: { dateTime: localDateTime(date, start), timeZone: TZ },
        end: { dateTime: localDateTime(date, start + minutes), timeZone: TZ },
        extendedProperties: { private: { ref: reference, deposit: String(deposit), email } },
        /* No attendees: a service account can't invite anyone without
           domain-wide delegation, and the request would fail outright. */
      }),
    });
  } catch (err) {
    console.error("book/insert:", err.message);
    return json(res, 502, { ok: false, error: "couldn't write to the calendar" });
  }

  /* ---------------- the deposit ---------------- */

  let checkoutUrl = null;
  if (body.pay === "card" && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await stripe("/checkout/sessions", {
        mode: "payment",
        customer_email: email,
        client_reference_id: reference,
        success_url: (SITE || "") + "/booking.html?paid=" + encodeURIComponent(reference),
        cancel_url: (SITE || "") + "/booking.html?cancelled=" + encodeURIComponent(reference),
        metadata: { eventId: event.id, ref: reference, date },
        line_items: {
          0: {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: deposit * 100,
              product_data: {
                name: "Deposit — " + sessionName,
                description: date + " at " + localDateTime(date, start).slice(11, 16),
              },
            },
          },
        },
      });
      checkoutUrl = session.url || null;
    } catch (err) {
      /* The day is held either way; she can send a link by hand. */
      console.error("book/stripe:", err.message);
    }
  }

  /* Optional: ping a Slack/Zapier/whatever hook so she hears about
     it without waiting for a calendar notification. */
  if (process.env.KL_NOTIFY_WEBHOOK) {
    fetch(process.env.KL_NOTIFY_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "New booking: " + sessionName + " — " + name + ", " + date +
          " " + localDateTime(date, start).slice(11, 16) + " (ref " + reference + ")",
      }),
    }).catch(() => {});
  }

  return json(res, 200, {
    ok: true,
    reference,
    deposit,
    eventId: event.id,
    checkoutUrl,
  });
};
