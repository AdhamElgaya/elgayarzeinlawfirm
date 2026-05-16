"""Resize and convert assets/library images to WebP; move originals to originals/."""
from pathlib import Path

from PIL import Image

LIB = Path(__file__).resolve().parent.parent / "assets" / "library"
ORIG = LIB / "originals"
MAX_SIDE = 1600
QUALITY = 85
SOURCE_EXTS = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}

ORIG.mkdir(exist_ok=True)

total_before = 0
total_after = 0

for path in sorted(LIB.iterdir()):
    if not path.is_file() or path.suffix not in SOURCE_EXTS:
        continue

    before = path.stat().st_size
    total_before += before

    img = Image.open(path)
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        bg = Image.new("RGB", img.size, (15, 15, 15))
        bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > MAX_SIDE:
        scale = MAX_SIDE / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)

    out = LIB / f"{path.stem}.webp"
    img.save(out, "WEBP", quality=QUALITY, method=6)
    total_after += out.stat().st_size

    backup = ORIG / path.name
    if not backup.exists():
        path.rename(backup)

    print(f"{path.name:12} {before // 1024:6} KB -> {out.name:12} {out.stat().st_size // 1024:5} KB")

print(f"\nTotal: {total_before // (1024*1024)} MB -> {total_after // 1024} KB")
