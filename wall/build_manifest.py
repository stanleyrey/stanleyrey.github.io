#!/usr/bin/env python3
"""Scan this folder for photos (+ optional same-name .txt notes) and write manifest.json.

Drop `2026-01-15_mission-peak.jpg` and, optionally, `2026-01-15_mission-peak.txt`
into this folder, commit, push. The GitHub Action in .github/workflows/wall.yml
runs this script and commits the manifest; run it by hand for a local preview:

    python wall/build_manifest.py

Image dimensions are read from the file headers (no dependencies). If Pillow is
installed, two downsized, high-quality JPEG derivatives are also written per photo:
  _thumbs/<name>.jpg   long side 1200 px  - shown on the wall
  _large/<name>.jpg    long side 2400 px  - shown in the lightbox
Originals of any size can therefore be committed as-is. Derivatives are regenerated on every run
(deterministic output, so unchanged photos produce no git diff).
"""
from __future__ import annotations

import json
import re
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
THUMB_DIR, LARGE_DIR = HERE / "_thumbs", HERE / "_large"
THUMB_PX, LARGE_PX = 1200, 2400
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
DATE_RE = re.compile(r"^(\d{4})(?:[-_.](\d{2}))?(?:[-_.](\d{2}))?[-_ ]*(.*)$")


def png_size(b: bytes):
    if b[:8] == b"\x89PNG\r\n\x1a\n" and b[12:16] == b"IHDR":
        return struct.unpack(">II", b[16:24])
    return None


def gif_size(b: bytes):
    if b[:6] in (b"GIF87a", b"GIF89a"):
        return struct.unpack("<HH", b[6:10])
    return None


def webp_size(b: bytes):
    if b[:4] != b"RIFF" or b[8:12] != b"WEBP":
        return None
    chunk = b[12:16]
    if chunk == b"VP8X":
        w = 1 + int.from_bytes(b[24:27], "little")
        h = 1 + int.from_bytes(b[27:30], "little")
        return w, h
    if chunk == b"VP8 ":
        w, h = struct.unpack("<HH", b[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if chunk == b"VP8L":
        bits = int.from_bytes(b[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    return None


def jpeg_size(path: Path):
    with path.open("rb") as f:
        if f.read(2) != b"\xff\xd8":
            return None
        while True:
            marker = f.read(2)
            if len(marker) < 2 or marker[0] != 0xFF:
                return None
            while marker[1] == 0xFF:
                marker = b"\xff" + f.read(1)
            kind = marker[1]
            if kind in (0xD8, 0x01) or 0xD0 <= kind <= 0xD7:
                continue
            (length,) = struct.unpack(">H", f.read(2))
            if kind in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                f.read(1)
                h, w = struct.unpack(">HH", f.read(4))
                return w, h
            f.seek(length - 2, 1)


def image_size(path: Path):
    head = path.read_bytes()[:64]
    for probe in (png_size, gif_size, webp_size):
        size = probe(head)
        if size:
            return size
    if path.suffix.lower() in (".jpg", ".jpeg"):
        return jpeg_size(path)
    return None


def parse_name(stem: str):
    m = DATE_RE.match(stem)
    date, title = "", stem
    if m and m.group(1):
        y, mo, d, rest = m.groups()
        date = "-".join(x for x in (y, mo, d) if x)
        title = rest or stem
    title = re.sub(r"[-_]+", " ", title).strip()
    return date, (title[:1].upper() + title[1:]) if title else ""


def derive(path: Path, out_dir: Path, long_side: int):
    """Write a Lanczos-downscaled, lightly sharpened, 4:4:4 progressive JPEG. Returns (relpath, w, h) or None."""
    try:
        from PIL import Image, ImageFilter, ImageOps
    except ImportError:
        return None
    out = out_dir / (path.stem + ".jpg")
    out_dir.mkdir(exist_ok=True)
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        scale = long_side / max(im.size)
        if scale < 1:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS, reducing_gap=3.0)
            im = im.filter(ImageFilter.UnsharpMask(radius=0.8, percent=60, threshold=3))
        im.save(out, "JPEG", quality=88, subsampling=0, optimize=True, progressive=True)
        return f"wall/{out_dir.name}/{out.name}", im.width, im.height


def main() -> int:
    items = []
    for path in sorted(HERE.iterdir()):
        if path.suffix.lower() not in IMAGE_EXT or path.name.startswith((".", "_")):
            continue
        size = image_size(path)
        if not size:
            print(f"skip {path.name}: unreadable dimensions", file=sys.stderr)
            continue
        note_path = path.with_suffix(".txt")
        note = note_path.read_text(encoding="utf-8").strip() if note_path.exists() else ""
        date, title = parse_name(path.stem)
        item = {"src": f"wall/{path.name}", "title": title, "date": date, "w": size[0], "h": size[1], "note": note}
        thumb = derive(path, THUMB_DIR, THUMB_PX)
        large = derive(path, LARGE_DIR, LARGE_PX)
        if thumb:
            item["thumb"], item["w"], item["h"] = thumb[0], thumb[1], thumb[2]  # EXIF-corrected orientation
        if large:
            item["large"] = large[0]
        items.append(item)
    items.sort(key=lambda it: (it["date"], it["src"]), reverse=True)
    out = HERE / "manifest.json"
    out.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(HERE.parent)} with {len(items)} photos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
