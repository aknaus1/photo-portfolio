/* ============================================================
   GET /api/availability

   Answers with the days Google Calendar already has something on,
   which the booking page merges over the schedule in
   assets/data/availability.js. One session a day, so a busy day
   is a closed day.

   Deliberately narrow: the weekly template and the one-off
   overrides stay in the data file where Kiana can edit them
   without a deploy. Only the "what's taken" half comes from here.

   Answers 204 when Google isn't configured, and the page keeps
   using the file's own `booked` list.
   ============================================================ */

"use strict";

const { json, busyDates, addDays, dateInTz } = require("./_lib.js");

const HORIZON_DAYS = Number(process.env.KL_HORIZON_DAYS || 150);

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "GET only" });
  }

  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    res.statusCode = 204; // nothing to add; the data file stands
    return res.end();
  }

  const today = dateInTz(new Date());

  try {
    const booked = await busyDates(today, addDays(today, HORIZON_DAYS));
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, from: today, booked }));
  } catch (err) {
    /* Never break the calendar over this — the page falls back to
       the file's schedule when the response isn't usable. */
    console.error("availability:", err.message);
    res.statusCode = 204;
    res.end();
  }
};
