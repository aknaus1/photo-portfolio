/* ============================================================
   Kiana Lee — the scheduling engine.

   Pure dates and arithmetic, no DOM. Everything is a
   "YYYY-MM-DD" string and a number of minutes past local
   midnight, which keeps daylight saving and the visitor's own
   timezone out of the way: a 4:30pm slot in San Jose is 4:30pm
   whether you're booking from Oakland or Osaka.

   Rules, enforced here rather than in the markup:
   · one session per day
   · starts land on :00 and :30
   · a start only exists if the whole session fits before the
     window closes
   · nothing inside the lead time, nothing past the horizon

   Depends on assets/data/availability.js.
   ============================================================ */

window.KLSchedule = (function () {
  "use strict";

  const A = window.KL_AVAILABILITY;
  const SLOT = 30; // minutes

  /* live availability, replaced wholesale if the backend answers */
  let week = A.week;
  let overrides = Object.assign({}, A.overrides);
  let booked = new Set(A.booked);

  /* ---------------- date arithmetic on ISO strings ---------------- */

  const partsOf = (iso) => iso.split("-").map(Number);

  /* UTC under the hood so adding a day is always 24h */
  function utc(iso) {
    const [y, m, d] = partsOf(iso);
    return Date.UTC(y, m - 1, d);
  }

  function iso(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  function addDays(isoDate, n) {
    return iso(utc(isoDate) + n * 86400000);
  }

  function diffDays(a, b) {
    return Math.round((utc(b) - utc(a)) / 86400000);
  }

  function dow(isoDate) {
    return new Date(utc(isoDate)).getUTCDay();
  }

  /* today where *she* is, not where the visitor is */
  function today() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: A.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function formatDate(isoDate, opts) {
    return new Intl.DateTimeFormat("en-US", Object.assign({ timeZone: "UTC" }, opts))
      .format(new Date(utc(isoDate)));
  }

  const longDate = (isoDate) =>
    formatDate(isoDate, { weekday: "long", month: "long", day: "numeric" });

  const shortDate = (isoDate) =>
    formatDate(isoDate, { weekday: "short", month: "short", day: "numeric" });

  const monthLabel = (isoDate) =>
    formatDate(isoDate, { month: "long", year: "numeric" }).toUpperCase();

  /* ---------------- clock helpers ---------------- */

  function toMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function clockLabel(minutes) {
    const h24 = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    const h = h24 % 12 === 0 ? 12 : h24 % 12;
    return h + ":" + String(m).padStart(2, "0") + (h24 < 12 ? " AM" : " PM");
  }

  /* ---------------- availability lookups ---------------- */

  function windowsFor(isoDate) {
    const own = Object.prototype.hasOwnProperty.call(overrides, isoDate)
      ? overrides[isoDate]
      : week[dow(isoDate)];
    return (own || []).map((w) => [toMinutes(w[0]), toMinutes(w[1])]);
  }

  const firstBookable = () => addDays(today(), A.leadTimeDays);
  const lastBookable = () => addDays(today(), A.horizonDays);

  /* Every start time that fits a session of `minutes` on this day. */
  function slotsFor(isoDate, minutes) {
    if (booked.has(isoDate)) return [];
    if (isoDate < firstBookable() || isoDate > lastBookable()) return [];

    const golden = goldenWindow(isoDate);
    const out = [];

    windowsFor(isoDate).forEach(([open, close]) => {
      /* round the opening up onto the half hour */
      let t = Math.ceil(open / SLOT) * SLOT;
      for (; t + minutes <= close; t += SLOT) {
        out.push({
          start: t,
          end: t + minutes,
          label: clockLabel(t),
          endLabel: clockLabel(t + minutes),
          /* does the session catch the last light? */
          golden: !!golden && t < golden.end && t + minutes > golden.start,
        });
      }
    });

    return out;
  }

  /* Everything the calendar needs to draw one cell. */
  function dayState(isoDate, minutes) {
    if (isoDate < today()) return { state: "past", slots: 0 };
    if (booked.has(isoDate)) return { state: "taken", slots: 0 };
    if (isoDate < firstBookable()) return { state: "soon", slots: 0 };
    if (isoDate > lastBookable()) return { state: "closed", slots: 0 };
    const n = slotsFor(isoDate, minutes).length;
    return { state: n ? "open" : "closed", slots: n };
  }

  /* First day that can actually take this session — where the
     calendar opens, so nobody lands on an empty month. */
  function firstOpenDay(minutes) {
    let d = firstBookable();
    const last = lastBookable();
    while (d <= last) {
      if (dayState(d, minutes).state === "open") return d;
      d = addDays(d, 1);
    }
    return firstBookable();
  }

  /* ---------------- the sun ---------------- */

  /* Sunrise-equation solve, the same one SunCalc uses. Accurate to
     about a minute, which is all a golden-hour badge needs. */
  const RAD = Math.PI / 180;
  const J1970 = 2440588;
  const J2000 = 2451545;
  const OBLIQUITY = RAD * 23.4397;

  const toDays = (date) => date.valueOf() / 86400000 - 0.5 + J1970 - J2000;
  const fromJulian = (j) => new Date((j + 0.5 - J1970) * 86400000);

  const meanAnomaly = (d) => RAD * (357.5291 + 0.98560028 * d);

  function eclipticLongitude(M) {
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    return M + C + RAD * 102.9372 + Math.PI;
  }

  const declination = (L) => Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
  const solarTransit = (ds, M, L) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

  function sunsetAt(isoDate) {
    const place = A.place;
    if (!place) return null;
    const [y, m, d] = partsOf(isoDate);
    const noon = new Date(Date.UTC(y, m - 1, d, 12));
    const lw = RAD * -place.lon;
    const phi = RAD * place.lat;
    const days = toDays(noon);
    const n = Math.round(days - 0.0009 - lw / (2 * Math.PI));
    const ds = 0.0009 + lw / (2 * Math.PI) + n;
    const M = meanAnomaly(ds);
    const L = eclipticLongitude(M);
    const dec = declination(L);
    const cosH =
      (Math.sin(RAD * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    if (cosH > 1 || cosH < -1) return null; // polar day or night, not a San Jose problem
    const H = Math.acos(cosH);
    const set = fromJulian(solarTransit(0.0009 + (H + lw) / (2 * Math.PI) + n, M, L));

    /* read it back as wall-clock time where she is */
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: A.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(set);
    const hh = +p.find((x) => x.type === "hour").value % 24;
    const mm = +p.find((x) => x.type === "minute").value;
    return hh * 60 + mm;
  }

  function goldenWindow(isoDate) {
    const set = sunsetAt(isoDate);
    if (set == null) return null;
    return { start: set - (A.goldenHourMinutes || 90), end: set, sunset: set };
  }

  /* ---------------- live availability ---------------- */

  /* Merge whatever the backend knows over the file's defaults.
     Anything missing from the response simply stays as configured. */
  function merge(remote) {
    if (!remote || typeof remote !== "object") return false;
    if (remote.week && typeof remote.week === "object") week = remote.week;
    if (remote.overrides && typeof remote.overrides === "object") {
      overrides = Object.assign({}, A.overrides, remote.overrides);
    }
    if (Array.isArray(remote.booked)) booked = new Set(remote.booked);
    return true;
  }

  return {
    A,
    SLOT,
    addDays,
    diffDays,
    dow,
    today,
    longDate,
    shortDate,
    monthLabel,
    formatDate,
    clockLabel,
    windowsFor,
    slotsFor,
    dayState,
    firstOpenDay,
    firstBookable,
    lastBookable,
    sunsetAt,
    goldenWindow,
    merge,
    isBooked: (d) => booked.has(d),
  };
})();
