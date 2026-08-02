/* ============================================================
   Kiana Lee — the price model.

   This is the single source of truth for every number the
   estimator (pricing.html) and the booking flow (booking.html)
   ever show. It is a plain global, not JSON, so the site still
   works when you just double-click index.html (file:// blocks
   fetch, but a <script> tag always loads).

   TO CHANGE A PRICE: edit the number here. Nothing else.

   What the site shows: anything the client picks carries a price — the
   film stock, the add-ons, prints, travel — because those are decisions
   they can't make blind. Her hourly rate and the developing stay bundled
   into the estimate total. See `costNotes` at the bottom for where each
   number came from; that list is for you, not the page.

   Worth knowing: this file is served to the browser, so the numbers
   are readable by anyone who opens devtools. Not showing them is a
   presentation choice, not a secret.
   ============================================================ */

window.KL_PRICING = {

  /* ---------------- labor ---------------- */

  /* Her portrait rate. (For reference when you revise it: local
     beginner rates ran $50–100/hr in mid-2026. That's a note for you,
     not for the site — nothing customer-facing quotes it.) Events and
     weddings carry their own rate: longer days, no second chances. */
  hourly: 65,

  /* ---------------- session types ---------------- */

  /* minHours drives the booking calendar: a day only offers a start
     time if the whole minimum fits before the window closes.
     rolls is just the sensible default; clients can add more. */
  sessions: [
    {
      id: "grad",
      name: "Grad portraits",
      blurb: "Cap, gown, campus, or the redwoods behind it.",
      minHours: 1,
      rolls: 1,
      cursor: "go",
    },
    {
      id: "portrait",
      name: "Portrait / solo",
      blurb: "Headshots, senior photos, or just you on your own.",
      minHours: 1,
      rolls: 1,
    },
    {
      id: "couples",
      name: "Couples & engagement",
      blurb: "A walk, mostly. The good frames happen between poses.",
      minHours: 1.5,
      rolls: 2,
    },
    {
      id: "proposal",
      name: "Proposal",
      blurb: "She scouts it first and shoots it from a distance.",
      minHours: 1.5,
      rolls: 2,
      note: "Includes scouting the spot beforehand and staying hidden.",
    },
    {
      id: "family",
      name: "Family & friends",
      blurb: "Kids, dogs, the whole loud group of you.",
      minHours: 1.5,
      rolls: 2,
    },
    {
      id: "event",
      name: "Small event",
      blurb: "Birthdays, showers, gallery nights, band sets.",
      minHours: 2,
      rolls: 3,
      hourly: 75,
    },
    {
      id: "wedding",
      name: "Wedding / elopement",
      blurb: "Small and film-only. Ceremony, portraits, the party after.",
      minHours: 4,
      rolls: 6,
      hourly: 85,
      note: "Full-day weddings are quoted by hand — send her the details.",
    },
  ],

  /* ---------------- film stock ---------------- */

  /* Retail single-roll price, 36 exposures. Passed through at cost. */
  stocks: [
    {
      id: "gold",
      name: "Kodak Gold 200",
      blurb: "Warm and forgiving. Her default in daylight.",
      roll: 11,
    },
    {
      id: "ultramax",
      name: "Kodak UltraMax 400",
      blurb: "Same warmth, faster. For shade and late afternoon.",
      roll: 13,
    },
    {
      id: "portra",
      name: "Kodak Portra 400",
      blurb: "The pro stock. Softest skin tones, widest latitude.",
      roll: 18,
    },
    {
      id: "hp5",
      name: "Ilford HP5 Plus 400",
      blurb: "Black and white, grain and all.",
      roll: 12,
    },
  ],

  /* ---------------- the lab ---------------- */

  lab: {
    /* Develop + high-resolution (2000dpi) scan, one 36exp color roll,
       at Bay Area walk-in rates. */
    developScan: 16,

    /* 4000dpi scans instead — worth it if you plan to print big. */
    ultraScan: 4,

    /* Negatives sleeved, numbered and handed back instead of binned. */
    negatives: 6,

    /* Hand editing: dust, colour, straightening, a real pass over each
       keeper rather than a preset. Priced per roll (~12 keepers). */
    editing: 40,

    /* Lab bumps the whole order to next-day instead of about a week. */
    rush: 55,
  },

  /* Everything digital is included in every session, always. */
  included: [
    "Every keeper scanned at high resolution",
    "A private gallery link that never expires",
    "Full personal-use rights to your photos",
  ],

  /* ---------------- prints ---------------- */

  /* Lab-printed on lustre paper, curated and packed by hand. */
  prints: [
    { id: "p46", name: "4×6 prints", unit: "set of 10", price: 25, max: 10 },
    { id: "p57", name: "5×7 prints", unit: "set of 5", price: 24, max: 10 },
    { id: "p810", name: "8×10 print", unit: "each", price: 18, max: 12 },
  ],

  /* ---------------- travel ---------------- */

  travel: [
    { id: "local", name: "San Jose & right around it", price: 0 },
    { id: "bay", name: "Peninsula, Oakland, Santa Cruz", price: 25 },
    { id: "far", name: "San Francisco, Monterey, Point Reyes", price: 55 },
    { id: "trip", name: "Yosemite or farther", price: 0, quote: true },
  ],

  /* ---------------- deposit ---------------- */

  /* A deposit holds the date and comes off the final total. */
  deposit: { pct: 0.25, min: 40, max: 250, roundTo: 5 },

  /* ---------------- payment ---------------- */

  /* Card: paste a Stripe Payment Link here (Stripe dashboard →
     Payment links). A link needs no backend and no keys in the page.
     Leave null and the card button politely explains it's coming.
     If api/book.js is deployed, it returns a per-booking Checkout
     URL instead and this is only the fallback. */
  stripeLink: null,

  /* Venmo handle without the @. */
  venmo: "Kiananlee7",

  email: "hello@kianalee.photo",

  /* ---------------- where the numbers came from ---------------- */

  /* INTERNAL ONLY — nothing renders this. Kept so that when you revise
     a price above you can see what the underlying cost was when it was
     set. Safe to edit or delete; no page reads it. */
  costNotes: [
    ["Kodak Gold 200, 36exp, single roll", "$9–12", "retail, mid-2026"],
    ["Kodak Portra 400, 36exp, single roll", "$16–18", "retail, mid-2026"],
    ["Develop + 2000dpi scan, 36exp color", "$14–16", "Bay Area lab walk-in"],
    ["4000dpi scan upgrade", "+$3–4", "same lab, per roll"],
    ["4×6 lustre print", "$1.10", "pro lab list price"],
    ["8×10 lustre print", "$4.00", "pro lab list price"],
    ["Her time on a portrait session", "$65/hr", "events and weddings differ"],
  ],
};
