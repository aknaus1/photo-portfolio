# Pricing, scheduling and deposits

Three pieces, in the order you'd meet them:

| Page | What it does |
| --- | --- |
| `pricing.html` | Builds an estimate total. Pure front end, no network. |
| `booking.html` | Picks a day and a start time, then sends the request. |
| `api/` | **Optional.** Google Calendar + Stripe, if you want them. |

The site works completely without `api/`. Nothing below is required to
put this online — skip to [Changing prices](#changing-prices) and
[Changing availability](#changing-availability) and you're done.

## How it hangs together

```
assets/data/pricing.js       every price, one file
assets/data/availability.js  when she shoots, one file
estimate.js                  choices -> money (shared by both pages)
schedule.js                  dates -> open half-hour slots
pricing.js                   the estimator UI
booking.js                   the calendar + form UI
api/_lib.js                  Google + Stripe, no npm packages
api/availability.js          GET  — which days are already taken
api/book.js                  POST — pencil it in, start a Checkout
api/stripe-webhook.js        POST — payment lands, event confirmed
```

Both data files are plain `window.X = {...}` globals rather than JSON so
that opening `index.html` straight off the disk still works — `fetch()` is
blocked on `file://`, a `<script>` tag never is.

## Changing prices

Everything is in [`assets/data/pricing.js`](assets/data/pricing.js). Edit a
number, reload. Nothing else needs to change: the session cards, the film
list, the add-ons and the home-page "from $92" figures are all generated
from it.

The numbers shipped are real mid-2026 Bay Area costs — single-roll retail
film, walk-in develop-and-scan, pro-lab print list prices — with Kiana's
hourly rate on top.

**The base session is bundled, the extras are priced.** Her hourly rate,
the film and the developing never appear as separate figures — they roll
into one estimate total, so the page reads as a price rather than an
invoice. Optional add-ons, prints and travel do show what each one adds,
because people are deciding whether to buy them.

`costNotes` at the bottom of the file records where each number came
from, for whoever revises them later — nothing renders it. Nothing
customer-facing compares her prices to anyone else's either.

One caveat: `assets/data/pricing.js` is a normal script, so every number
in it is readable in devtools by anyone who looks, including the bundled
ones. Not printing them is a presentation decision, not a secret. Moving
pricing behind the API would be the only way to actually hide it, and it
would cost the site its works-from-a-file-and-needs-no-backend property.

The deposit is a percentage of the total, clamped and rounded:
`deposit: { pct, min, max, roundTo }`.

## Changing availability

Everything is in
[`assets/data/availability.js`](assets/data/availability.js):

- `week` — the normal week, `0` = Sunday. Each day is a list of
  `[open, close]` windows in 24h time. `[]` means she doesn't shoot then.
- `overrides` — one-off days. A date here **replaces** that day's windows.
  `[]` closes a day she'd normally shoot.
- `booked` — days that are gone. Add a date after you confirm a session
  and the calendar strikes it out. (The backend keeps this in sync for you
  if you deploy it.)
- `leadTimeDays` / `horizonDays` — how soon and how far ahead people can
  book.

The rules the calendar enforces regardless: one session a day, starts on
the half hour only, and a start time only appears if the whole session
fits before the window closes. So a four-hour wedding on a day that opens
at 4pm and closes at 8pm offers exactly one start time.

Slots inside the last 90 minutes before sunset are starred as golden hour.
Sunset is worked out per date from `place` — no API involved.

## Payments without a backend

**Card.** Make a Stripe [Payment Link](https://stripe.com/docs/payment-links)
in the Stripe dashboard and paste it into `stripeLink` in
`assets/data/pricing.js`. A payment link is a plain URL, so no secret keys
go anywhere near this repository. The booking page appends
`prefilled_email` and `client_reference_id` so you can match a payment to a
request. Left as `null`, the card option tells people she'll email a link
instead — which is honest and fine.

**Venmo.** Set `venmo` to the handle without the `@`. The button opens
Venmo with the amount and a note already filled in.

Both options are *after* the request is sent — the deposit holds a day
she's confirmed, it doesn't buy one.

## The optional backend

Deploy `api/` on anything that runs Node 18+ functions (Vercel, Netlify
Functions, Cloudflare with a Node compat layer). There are no
dependencies to install: the Google JWT is signed with `node:crypto` and
both APIs are called with `fetch`.

Nothing here is load-bearing. If `api/availability` doesn't answer, the
calendar uses the data file. If `api/book` doesn't answer, the request
leaves as a prefilled email exactly as before.

### 1. A Google service account

1. Google Cloud console → new project → enable the **Google Calendar API**.
2. Create a **service account**, then a **JSON key** for it.
3. In Google Calendar, share the calendar you want to use with the service
   account's email address, with **Make changes to events**.

Set:

```
GOOGLE_CLIENT_EMAIL   the service account's email
GOOGLE_PRIVATE_KEY    the private_key from the JSON (\n escapes are fine)
GOOGLE_CALENDAR_ID    the calendar's id, or "primary"
KL_TIMEZONE           America/Los_Angeles
```

One thing to know: a service account **cannot invite attendees** without
domain-wide delegation, so `api/book.js` deliberately doesn't try. The
client's name, email and phone go in the event description instead.

### 2. Stripe (optional, for card deposits)

```
STRIPE_SECRET_KEY       sk_live_… or sk_test_…
STRIPE_WEBHOOK_SECRET   whsec_… from the webhook endpoint you create
KL_SITE_URL             https://kianalee.photo
```

Add a webhook endpoint pointing at `/api/stripe-webhook` subscribed to
`checkout.session.completed`. The signature is verified locally against
`STRIPE_WEBHOOK_SECRET` before anything is touched.

Stripe signs the raw request bytes, so that endpoint opts out of body
parsing (`module.exports.config = { api: { bodyParser: false } }`). If you
host it somewhere that ignores that and parses the body anyway, the
endpoint answers `400 raw body unavailable` and logs why, rather than
silently reporting every webhook as a bad signature.

### 3. Optional extras

```
KL_DEPOSIT_MIN   default 40    hard floor on any charge
KL_DEPOSIT_MAX   default 250   hard ceiling on any charge
KL_HORIZON_DAYS  default 150   how far ahead bookings are accepted
KL_NOTIFY_WEBHOOK              a Slack/Zapier URL to ping on each booking
```

### What the flow looks like with it on

1. The page loads the schedule from `assets/data/availability.js`, draws
   the calendar immediately, then asks `GET /api/availability` and redraws
   if Google knows about days the file doesn't.
2. `POST /api/book` re-checks free/busy server-side — this is the only
   place the one-session-a-day rule is actually enforced against a race —
   and writes a **tentative** event.
3. If the visitor chose card, it creates a Stripe Checkout session for the
   deposit and hands back the URL; the page redirects there.
4. `POST /api/stripe-webhook` flips the event to **confirmed** and colours
   it green when the payment lands.

The deposit sent by the browser is never trusted as-is: it is rounded and
clamped to `KL_DEPOSIT_MIN`…`KL_DEPOSIT_MAX` before a Checkout session is
created.

## Testing without deploying anything

```
python3 -m http.server 8000
```

then open <http://localhost:8000/booking.html>. The `api/availability`
request 404s, which is exactly the path a visitor takes when there's no
backend, so that's the case worth testing most.
