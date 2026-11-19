# stanleyrey.github.io

Personal site and résumé of Yao Zhang, served by GitHub Pages at <https://stanleyrey.github.io/>.

Plain HTML, CSS and JavaScript — no build step, no dependencies. Push to `main` and GitHub Pages redeploys.

## Two sides

The page has a **Work** side (résumé) and a **Life** side (the photo wall). The switch in the header flips between them; `https://stanleyrey.github.io/#life` opens the Life side directly. Sections are tagged `data-side="work"` / `data-side="life"` in `index.html`; `#contact` and the footer are shared. Life has its own palette (`html[data-side="life"]` in `styles.css`).

## Layout

| What | Where |
|---|---|
| Résumé content (about, experience, publications, contact) | `index.html` |
| Profile photo | `assets/profile.jpg` (optional; initials are shown until the file exists) |
| Photo wall | `wall/` — photos + same-name `.txt` notes (see below) |
| "Ask me about" tags | `index.html`, `<div class="ask-card">` |
| Career timeline marks | `index.html`, `<div class="timeline">` — `--at` is the percent position between 2009 and now |
| Styling and color tokens | `styles.css` (`:root` / `[data-theme="dark"]` / `html[data-side="life"]`) |
| Theme toggle, side switch, figure interactions, wall rendering | `script.js` |

## The wall: adding a photo

1. Drop the image into `wall/`. Name it `YYYY-MM-DD_short-title.jpg` (the date sorts it, the title becomes the caption; `-`/`_` become spaces). `.jpg .jpeg .png .webp .gif .avif` are accepted. Any size is fine: the build step writes high-quality downsized copies to `wall/_thumbs/` (1200 px, shown on the wall) and `wall/_large/` (2400 px, shown in the lightbox); the original is never served.
2. Optionally add a note with the **same name** and `.txt`: `wall/YYYY-MM-DD_short-title.txt`. Plain text, any length.
3. Commit and push. The GitHub Action (`.github/workflows/wall.yml`) rebuilds `wall/manifest.json`, regenerates `_thumbs/` and `_large/` (Pillow, Lanczos + light unsharp mask, JPEG q88 4:4:4) and commits them; Pages redeploys a minute or two later.

How the wall lays things out (all automatic, from the image size and the note):

| Photo | Footprint |
|---|---|
| panorama (w/h > 2.1) | 6, 8 or 12 of 12 columns |
| landscape | 4, 6 or 8 columns |
| square | 3, 4 or 6 columns |
| portrait | 3 or 4 columns |
| any | height follows the photo's real aspect ratio; the first photo is always a big one |
| short note (≤ 40 chars) | a small italic slip overlapping the photo corner |
| medium / long note | a paper slip under the photo; the pin grows one or two rows |

The width, tilt and pin position are all derived from the filename hash, so the wall looks hand-arranged but never moves between visits, and runs of same-shaped photos still interleave instead of stacking one per row. Newest first.

Local preview: `pip install pillow` once, run `python wall/build_manifest.py` after adding files, then serve the folder (below).

## Interactive bits (no configuration needed)

- Hero: reticle grid lights up near the pointer; drifting "defects" hide under the title.
- Experience: timeline spans highlight as you scroll past each project; hover a KlearView data source to see which views it feeds; BDO runs its optimization when scrolled into view (or on the button); the AI agent streams its answer (click the question bubble to replay).
- Footer `re-inspect` (or clicking the `YZ.` logo five times) runs a mock inspection pass.
- Life side: pins drop in on load; hover straightens a pin; click opens it large with its note.
- All motion is disabled under `prefers-reduced-motion`. Print (`Ctrl+P`) yields a clean text résumé (Work side only).

## Preview locally

```
python -m http.server 8000
```

Then open <http://localhost:8000>.
