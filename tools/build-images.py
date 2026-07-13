"""Build optimized web images from the full-res scans in 'Film Photography/'.

Usage:  python tools/build-images.py
Add new photos to the CURATION list below, then re-run.
Originals are never touched; web copies land in assets/img/.
"""

import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "Film Photography")
OUT = os.path.join(ROOT, "assets", "img")

LONG_EDGE = 1600
QUALITY = 82

#      source (set, filename)                          output name
CURATION = [
    # hero: Half Dome, roll 1 frame 3
    (("Yosemite", "8491999_8491999-R1-009-3.jpg"), "hero.jpg", 1818),

    # roll 01: Yosemite
    (("Yosemite", "8491999_8491999-R1-009-3.jpg"), "yos-03.jpg", None),
    (("Yosemite", "8491999_8491999-R1-035-16.jpg"), "yos-16.jpg", None),
    (("Yosemite", "8491999_8491999-R2-022-9A.jpg"), "yos-r2-09a.jpg", None),
    (("Yosemite", "8491999_8491999-R2-036-16A.jpg"), "yos-r2-16a.jpg", None),
    (("Yosemite", "8491999_8491999-R2-050-23A.jpg"), "yos-r2-23a.jpg", None),
    (("Yosemite", "8491999_8491999-R1-007-2.jpg"), "yos-02.jpg", None),
    (("Yosemite", "8491999_8491999-R1-011-4.jpg"), "yos-04.jpg", None),
    (("Yosemite", "8491999_8491999-R1-013-5.jpg"), "yos-05.jpg", None),
    (("Yosemite", "8491999_8491999-R1-033-15.jpg"), "yos-15.jpg", None),
    (("Yosemite", "8491999_8491999-R1-058-27A.jpg"), "yos-27a.jpg", None),
    (("Yosemite", "8491999_8491999-R1-060-28A.jpg"), "yos-28a.jpg", None),
    (("Yosemite", "8491999_8491999-R1-064-30A.jpg"), "yos-30a.jpg", None),
    (("Yosemite", "8491999_8491999-R1-066-31A.jpg"), "yos-31a.jpg", None),
    (("Yosemite", "8491999_8491999-R2-030-13A.jpg"), "yos-r2-13a.jpg", None),
    (("Yosemite", "8491999_8491999-R2-046-21A.jpg"), "yos-r2-21a.jpg", None),

    # roll 02: graduation, among redwoods
    (("Graduation", "000085440008.jpg"), "grad-08.jpg", None),
    (("Graduation", "000085440015.jpg"), "grad-15.jpg", None),
    (("Graduation", "000085440016.jpg"), "grad-16.jpg", None),
    (("Graduation", "000085440017.jpg"), "grad-17.jpg", None),
    (("Graduation", "000085440029.jpg"), "grad-29.jpg", None),
    (("Graduation", "000085440027.jpg"), "grad-27.jpg", None),
    (("Graduation", "000085440006.jpg"), "grad-06.jpg", None),
    (("Graduation", "000085440014.jpg"), "grad-14.jpg", None),
    (("Graduation", "000085440019.jpg"), "grad-19.jpg", None),
    (("Graduation", "000085440025.jpg"), "grad-25.jpg", None),
    (("Graduation", "000085440030.jpg"), "grad-30.jpg", None),
    (("Graduation", "000085440032.jpg"), "grad-32.jpg", None),
    (("Graduation", "000085440034.jpg"), "grad-34.jpg", None),

    # roll 03: close to home
    (("nature", "000060620023.jpg"), "home-23.jpg", None),
    (("nature", "000060620021.jpg"), "home-21.jpg", None),
    (("nature", "000060620025.jpg"), "home-25.jpg", None),
    (("nature", "000060620026.jpg"), "home-26.jpg", None),
    (("nature", "000060620027.jpg"), "home-27.jpg", None),
    (("nature", "000060620028.jpg"), "home-28.jpg", None),
]


THUMB_EDGE = 520
THUMB_QUALITY = 78


def main():
    os.makedirs(OUT, exist_ok=True)
    for (setname, fname), outname, long_edge in CURATION:
        src = os.path.join(SRC, setname, fname)
        dst = os.path.join(OUT, outname)
        im = Image.open(src).convert("RGB")
        edge = long_edge or LONG_EDGE
        im.thumbnail((edge, edge), Image.LANCZOS)
        im.save(dst, "JPEG", quality=QUALITY, progressive=True, optimize=True)
        kb = os.path.getsize(dst) // 1024
        print(f"{outname:18} {im.size[0]}x{im.size[1]}  {kb} KB")

        # small copy for contact-sheet grids
        # (hero has none; roll 03 "close to home" has no contact sheet)
        if outname != "hero.jpg" and not outname.startswith("home-"):
            thumb = Image.open(src).convert("RGB")
            thumb.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
            tname = outname.replace(".jpg", "-t.jpg")
            thumb.save(os.path.join(OUT, tname), "JPEG",
                       quality=THUMB_QUALITY, progressive=True, optimize=True)


if __name__ == "__main__":
    main()
