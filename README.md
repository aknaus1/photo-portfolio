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

- `index.html`: home, preloader, static film hero, and roll cards
- `rolls.html`: all rolls, stacked
- `yosemite.html` / `graduation.html` / `close-to-home.html`: one page per roll
- `about.html`, `contact.html`: about page and booking form (opens a prefilled email)

All pages share `styles.css` and `main.js`; every JS feature guards on its
markup, so a page only gets the behaviors its HTML asks for.
