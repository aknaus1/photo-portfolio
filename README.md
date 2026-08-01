# kianalee.photo

Portfolio site for Kiana Lee, a 35mm film photographer in San Jose.

Plain static HTML/CSS/JS, no build step. Animation is GSAP + ScrollTrigger +
Lenis, vendored in `vendor/`. Fonts are self-hosted in `assets/fonts/`.
Open `index.html` (or serve the folder with any static server) and it works.

## Images

Full-resolution scans live in `Film Photography/` (not committed; see
`.gitignore`). The web-sized copies in `assets/img/` are generated from them:

```
python tools/build-images.py
```

To publish a new photo: add it to the `CURATION` list in
[tools/build-images.py](tools/build-images.py), re-run the script, then
reference the new `assets/img/*.jpg` (and `-t.jpg` thumbnail, if the page
has a contact sheet) from the HTML. Requires Pillow (`pip install pillow`).
Re-encoding through Pillow also strips EXIF/GPS from the published copies.

## Pages

- `index.html`: home, preloader, static film hero, roll cards, price teaser
- `rolls.html`: all rolls, stacked
- `yosemite.html` / `graduation.html` / `close-to-home.html`: one page per roll
- `about.html`: about page
- `pricing.html`: session estimator
- `booking.html`: availability calendar, half-hour slots, deposit
- `contact.html`: general enquiries (opens a prefilled email)

All pages share `styles.css` and `main.js`; every JS feature guards on its
markup, so a page only gets the behaviors its HTML asks for. The two new
pages add their own scripts on top: `estimate.js` (choices → money),
`schedule.js` (dates → open slots), and a UI file each.

## Pricing, scheduling and deposits

Prices live in [assets/data/pricing.js](assets/data/pricing.js) and
availability in [assets/data/availability.js](assets/data/availability.js).
Both are plain globals, so they work from `file://` too — edit a number,
reload, done.

`api/` holds an optional, dependency-free Google Calendar + Stripe backend.
The site is fully functional without it. See [BOOKING.md](BOOKING.md).
