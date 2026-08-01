/* ============================================================
   Kiana Lee — when she's free.

   Edit this file to change your availability. It is a plain
   global (not JSON) so the calendar works even from file://.

   If api/availability.js is deployed, the booking page fetches
   it and merges the result over this file — Google Calendar then
   owns `booked` and this stays the schedule template. Without the
   backend, everything below still works on its own: add a date to
   `booked` after you confirm a session and that day closes.

   Rules the calendar enforces, no matter what you put here:
   · one session per day, full stop
   · start times land on :00 and :30 only
   · a start time is only offered if the whole session minimum
     fits inside the window before it closes
   ============================================================ */

window.KL_AVAILABILITY = {

  /* Everything below is San Jose local time. */
  timezone: "America/Los_Angeles",

  /* Don't let anyone book sooner than this many days out — film
     needs buying, spots need scouting. */
  leadTimeDays: 3,

  /* How far ahead the calendar opens. */
  horizonDays: 150,

  /* The normal week. 0 = Sunday … 6 = Saturday.
     Each day is a list of [open, close] windows in 24h time.
     An empty list means she doesn't shoot that day at all.
     Windows lean late on purpose: film wants the last light. */
  week: {
    0: [["08:30", "20:00"]],  // Sunday — all day
    1: [],                     // Monday — off
    2: [],                     // Tuesday — off
    3: [["16:00", "20:00"]],  // Wednesday — evenings
    4: [["16:00", "20:00"]],  // Thursday — evenings
    5: [["15:00", "20:30"]],  // Friday — afternoon on
    6: [["08:00", "20:30"]],  // Saturday — all day
  },

  /* One-off changes. A date here REPLACES that day's windows.
     Use [] to close a day you'd normally shoot, or add windows to
     open a day you normally wouldn't. */
  overrides: {
    "2026-08-13": [["09:00", "20:00"]],  // took the day off work
    "2026-08-31": [],                     // travelling
    "2026-09-07": [],                     // Labor Day
    "2026-11-26": [],                     // Thanksgiving
    "2026-12-24": [],
    "2026-12-25": [],
  },

  /* Days already taken. One session per day, so anything listed
     here is closed outright. Add a date after you confirm a
     booking — or let the backend keep this in sync with Google
     Calendar and never touch it again. */
  booked: [
    "2026-08-08",
    "2026-08-16",
    "2026-08-22",
    "2026-09-05",
    "2026-09-13",
    "2026-09-26",
    "2026-10-10",
  ],

  /* Where she is, for working out when the light goes.
     The booking page marks the last 90 minutes before sunset as
     golden hour, per date, from these coordinates. */
  place: { name: "San Jose, CA", lat: 37.3387, lon: -121.8853 },
  goldenHourMinutes: 90,
};
