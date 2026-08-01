/* ============================================================
   Shared bits for the booking endpoints.

   No npm packages, on purpose: the site has no build step and
   this shouldn't give it one. Everything here is node:crypto and
   fetch, both built in since Node 18.

   Nothing else in the site imports this. If you never deploy the
   api/ folder, the booking page falls back to the schedule in
   assets/data/availability.js and a prefilled email, and nothing
   below ever runs. See BOOKING.md.
   ============================================================ */

"use strict";

const crypto = require("node:crypto");

const TZ = process.env.KL_TIMEZONE || "America/Los_Angeles";
const CALENDAR = process.env.GOOGLE_CALENDAR_ID || "primary";

/* ---------------- http helpers ---------------- */

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/* Vercel parses JSON bodies for us; other runtimes may not. */
function readJson(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return readRaw(req).then((raw) => {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null; // caller turns this into a 400
    }
  });
}

/* Resolves to the exact bytes as a string, or null when they're gone.

   Reading the stream is only safe if nothing upstream has already drained
   it. A platform that parsed the body first leaves an ended stream, and
   listening to it would hang until the function times out — so check for
   every shape a parsed body can arrive in before touching the stream. */
function readRaw(req) {
  if (typeof req.body === "string") return Promise.resolve(req.body);
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString("utf8"));
  /* parsed into an object: the original bytes no longer exist, and Stripe
     signs bytes, so say so rather than guess by re-serialising */
  if (req.body && typeof req.body === "object") return Promise.resolve(null);
  if (req.readableEnded) return Promise.resolve("");

  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/* ---------------- dates ---------------- */

/* "2026-08-15" + 1080 minutes -> "2026-08-15T18:00:00", which is
   what Google wants alongside an explicit timeZone. */
function localDateTime(date, minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return date + "T" + h + ":" + m + ":00";
}

/* The calendar date an instant falls on, where she is. */
function dateInTz(instant) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ---------------- google ---------------- */

let cachedToken = null; // { token, expires }

/* Service-account JWT, signed here and traded for an access token.
   No google client library involved. */
async function googleToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expires > now + 60) return cachedToken.token;

  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("google credentials not configured");

  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const head = enc({ alg: "RS256", typ: "JWT" });
  const claim = enc({
    iss: email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const sig = crypto
    .sign("RSA-SHA256", Buffer.from(head + "." + claim), key)
    .toString("base64url");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: head + "." + claim + "." + sig,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error("google auth failed: " + (data.error_description || r.status));

  cachedToken = { token: data.access_token, expires: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

async function googleCalendar(path, init) {
  const token = await googleToken();
  const r = await fetch("https://www.googleapis.com/calendar/v3" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(init && init.headers),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error((data.error && data.error.message) || "calendar error " + r.status);
    err.status = r.status;
    throw err;
  }
  return data;
}

/* Every local date between `from` and `to` that already has
   something on the calendar. One session a day, so a single busy
   minute closes the whole day. */
async function busyDates(from, to) {
  const data = await googleCalendar("/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: new Date(from + "T00:00:00Z").toISOString(),
      timeMax: new Date(addDays(to, 1) + "T00:00:00Z").toISOString(),
      timeZone: TZ,
      items: [{ id: CALENDAR }],
    }),
  });

  const cal = (data.calendars && data.calendars[CALENDAR]) || {};
  if (cal.errors && cal.errors.length) {
    throw new Error("calendar not readable: " + cal.errors[0].reason);
  }

  const days = new Set();
  (cal.busy || []).forEach((slot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    /* an event can straddle midnight, so walk it a day at a time */
    let d = dateInTz(start);
    const last = dateInTz(new Date(end.getTime() - 1));
    for (let guard = 0; guard < 40 && d <= last; guard++) {
      days.add(d);
      d = addDays(d, 1);
    }
  });

  return [...days].sort();
}

/* ---------------- stripe ---------------- */

/* Form-encoded, like Stripe's API wants, without the SDK. */
function formEncode(obj, prefix, out) {
  out = out || new URLSearchParams();
  Object.keys(obj).forEach((k) => {
    const key = prefix ? prefix + "[" + k + "]" : k;
    const v = obj[k];
    if (v === undefined || v === null) return;
    if (typeof v === "object") formEncode(v, key, out);
    else out.append(key, String(v));
  });
  return out;
}

async function stripe(path, body) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("stripe not configured");
  const r = await fetch("https://api.stripe.com/v1" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error((data.error && data.error.message) || "stripe error " + r.status);
  return data;
}

/* Stripe's own signature scheme: HMAC over "timestamp.body". */
function verifyStripeSignature(raw, header, secret, toleranceSeconds) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=").map((s) => s.trim()))
  );
  if (!parts.t || !parts.v1) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t));
  if (age > (toleranceSeconds || 300)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(parts.t + "." + raw)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  TZ,
  CALENDAR,
  json,
  readJson,
  readRaw,
  localDateTime,
  dateInTz,
  addDays,
  isDate,
  googleCalendar,
  busyDates,
  stripe,
  verifyStripeSignature,
};
