"""Resize and convert public-site photos to WebP for faster page loads."""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
MAX_SIDE = {
    "team": 1400,
    "services": 1200,
    "partners": 800,
    "library": 1400,
}
QUALITY = 80
SOURCE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"}
SKIP_NAMES = {"favicon.png"}
UNUSED_TEAM = {"IMG_0102 (1).heic", "khamis-gomaa.webp", "amany-fouad.webp"}

total_before = 0
total_after = 0
rewrites = []


def prepare(img):
    img = ImageOps.exif_transpose(img)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    if has_alpha:
        return img.convert("RGBA"), True
    return img.convert("RGB"), False


def optimize_dir(folder, max_side):
    global total_before, total_after
    directory = ROOT / "assets" / folder
    if not directory.is_dir():
        return
    originals = directory / "originals"
    originals.mkdir(exist_ok=True)

    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.suffix not in SOURCE_EXTS:
            continue
        if path.name in SKIP_NAMES or path.name in UNUSED_TEAM:
            continue

        before = path.stat().st_size
        img = Image.open(path)
        img, has_alpha = prepare(img)
        w, h = img.size
        if max(w, h) > max_side:
            scale = max_side / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)

        out = directory / f"{path.stem}.webp"
        tmp = directory / f"{path.stem}.tmp.webp"
        save_kw = {"method": 6}
        if has_alpha:
            save_kw.update(quality=88)
        else:
            save_kw.update(quality=QUALITY)
        img.save(tmp, "WEBP", **save_kw)
        after = tmp.stat().st_size

        if after >= before * 0.97 and path.suffix.lower() == ".webp":
            tmp.unlink()
            print(f"keep     {path.name:42} {before // 1024:5} KB")
            continue

        if out.exists() and out.resolve() != tmp.resolve():
            out.unlink()
        tmp.replace(out)
        total_before += before
        total_after += after
        rel_from = f"assets/{folder}/{path.name}"
        rel_to = f"assets/{folder}/{out.name}"
        if path.exists() and path.resolve() != out.resolve():
            backup = originals / path.name
            if not backup.exists():
                path.rename(backup)
            else:
                path.unlink()
            rewrites.append((rel_from, rel_to))
        print(f"{path.name:42} {before // 1024:5} KB -> {out.name:42} {after // 1024:5} KB")


for folder, max_side in MAX_SIDE.items():
    optimize_dir(folder, max_side)

print(f"\nOptimized payload: {total_before / (1024 * 1024):.2f} MB -> {total_after / 1024:.0f} KB")
print("\nReference rewrites:")
for old, new in rewrites:
    print(f"  {old} -> {new}")
