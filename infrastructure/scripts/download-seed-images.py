#!/usr/bin/env python3
"""
AfriXplore — Download public-domain seed images for Custom Vision training.
Images sourced from Wikimedia Commons (CC/public domain).

Usage:
    python3 infrastructure/scripts/download-seed-images.py
"""

import urllib.request
import ssl
import os
import sys

# Fix macOS SSL certificate issue
try:
    import certifi
    ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    ctx = ssl.create_default_context()

BASE = "infrastructure/assets/seed-images"

# Wikimedia Commons public domain mineral photos
# Each mineral needs 5+ images for Custom Vision training
IMAGES: dict[str, list[str]] = {
    "copper": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/NatCopper.jpg/320px-NatCopper.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Copper_sulfide_porphyry.jpg/320px-Copper_sulfide_porphyry.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Copper_ore.jpg/320px-Copper_ore.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Chalcopyrite-118736.jpg/320px-Chalcopyrite-118736.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Copper_-_El_Teniente.jpg/320px-Copper_-_El_Teniente.jpg",
    ],
    "gold": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Gold_nugget_%28Australia%29_4_%28aka%29.jpg/320px-Gold_nugget_%28Australia%29_4_%28aka%29.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Gold_-_El_Callao%2C_Venezuela.jpg/320px-Gold_-_El_Callao%2C_Venezuela.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Gold_veins_in_quartz.jpg/320px-Gold_veins_in_quartz.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gold_crystals.jpg/320px-Gold_crystals.jpg",
    ],
    "malachite": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Malachite_-_Katanga%2C_Congo.jpg/320px-Malachite_-_Katanga%2C_Congo.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Malachite_from_Kolwezi.jpg/320px-Malachite_from_Kolwezi.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Malachite_FMNH.jpg/320px-Malachite_FMNH.jpg",
    ],
    "pyrite": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/PyriteSam30b.jpg/320px-PyriteSam30b.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Pyrite_fool%27s_gold.jpg/320px-Pyrite_fool%27s_gold.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Pyrite_cubic_crystals.jpg/320px-Pyrite_cubic_crystals.jpg",
    ],
    "graphite": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/GraphiteUSGOV.jpg/320px-GraphiteUSGOV.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Graphite-233333.jpg/320px-Graphite-233333.jpg",
    ],
    "quartz": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Quartz%2C_Tibet.jpg/320px-Quartz%2C_Tibet.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Quartz_Ouro_Preto_Brazil.jpg/320px-Quartz_Ouro_Preto_Brazil.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Quartz_crystals.jpg/320px-Quartz_crystals.jpg",
    ],
    "galena": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Galena_-_Hunan%2C_China.jpg/320px-Galena_-_Hunan%2C_China.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Galena_-_Missouri.jpg/320px-Galena_-_Missouri.jpg",
    ],
    "bauxite": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Bauxite_with_unweathered_rock_core.jpg/320px-Bauxite_with_unweathered_rock_core.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Bauxite_ds.jpg/320px-Bauxite_ds.jpg",
    ],
    "cobalt": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Cobaltite-164988.jpg/320px-Cobaltite-164988.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Cobaltite_-_Hakansboda.jpg/320px-Cobaltite_-_Hakansboda.jpg",
    ],
    "tin": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Cassiterite_-_Viloco_mine.jpg/320px-Cassiterite_-_Viloco_mine.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Cassiterite_-_Bolivia.jpg/320px-Cassiterite_-_Bolivia.jpg",
    ],
    "chrome": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Chromite_-_South_Africa.jpg/320px-Chromite_-_South_Africa.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Chromite_-_Bushveld.jpg/320px-Chromite_-_Bushveld.jpg",
    ],
    "manganese": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Pyrolusite_-_Schneeberg%2C_Erzgebirge.jpg/320px-Pyrolusite_-_Schneeberg%2C_Erzgebirge.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Rhodonite_-_Broken_Hill.jpg/320px-Rhodonite_-_Broken_Hill.jpg",
    ],
    "coltan": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Columbite.jpg/320px-Columbite.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Tantalite-Columbite.jpg/320px-Tantalite-Columbite.jpg",
    ],
    "lithium": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Spodumene_-_Pala%2C_California.jpg/320px-Spodumene_-_Pala%2C_California.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Lepidolite_mica.jpg/320px-Lepidolite_mica.jpg",
    ],
    "nickel": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Pentlandite_-_Ontario%2C_Canada.jpg/320px-Pentlandite_-_Ontario%2C_Canada.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Nickel_ore.jpg/320px-Nickel_ore.jpg",
    ],
    "feldspar": [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Feldspar_-_Orthoclase.jpg/320px-Feldspar_-_Orthoclase.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Labradorite_feldspar.jpg/320px-Labradorite_feldspar.jpg",
    ],
}

# Minerals without Wikimedia entries — note for manual addition
MANUAL_REQUIRED = ["platinum", "palladium", "tungsten", "uranium", "ree"]


def download_images() -> None:
    total_ok = 0
    total_err = 0

    print(f"\nDownloading seed images to: {os.path.abspath(BASE)}\n")

    for mineral, urls in IMAGES.items():
        folder = os.path.join(BASE, mineral)
        os.makedirs(folder, exist_ok=True)

        for i, url in enumerate(urls, 1):
            dest = os.path.join(folder, f"sample_{i:02d}.jpg")

            # Skip if already downloaded
            if os.path.exists(dest) and os.path.getsize(dest) > 5000:
                size_kb = os.path.getsize(dest) // 1024
                print(f"  ⏭  {mineral}/sample_{i:02d}.jpg  ({size_kb}KB) — already exists")
                total_ok += 1
                continue

            try:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 AfriXplore/1.0"}
                )
                with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
                    data = r.read()

                # Verify it's a real image (JPEG magic bytes)
                if len(data) < 1000:
                    raise ValueError(f"File too small ({len(data)} bytes)")

                with open(dest, "wb") as f:
                    f.write(data)

                size_kb = len(data) // 1024
                print(f"  ✅  {mineral}/sample_{i:02d}.jpg  ({size_kb}KB)")
                total_ok += 1

            except Exception as e:
                print(f"  ⚠️   {mineral}/sample_{i:02d}.jpg — {e}")
                total_err += 1

    # Create empty placeholder dirs for minerals needing manual images
    for mineral in MANUAL_REQUIRED:
        folder = os.path.join(BASE, mineral)
        os.makedirs(folder, exist_ok=True)
        readme = os.path.join(folder, "README.txt")
        if not os.path.exists(readme):
            with open(readme, "w") as f:
                f.write(
                    f"Add at least 5 JPG images of {mineral} ore/minerals here.\n"
                    f"Minimum resolution: 256x256px\n"
                    f"Naming: sample_01.jpg, sample_02.jpg, ...\n"
                )

    print(f"\n{'=' * 52}")
    print(f"  Downloaded: {total_ok}   Failed: {total_err}")
    print(f"  Location:   {os.path.abspath(BASE)}")

    if MANUAL_REQUIRED:
        print(f"\n  Manual images needed for:")
        for m in MANUAL_REQUIRED:
            print(f"    {BASE}/{m}/  (add 5+ JPGs)")

    print(f"\n  Next step:")
    print(f"    ./infrastructure/scripts/setup-custom-vision.sh staging")
    print()

    if total_err > 0:
        sys.exit(1)


if __name__ == "__main__":
    # Change to repo root if run from scripts dir
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(os.path.dirname(script_dir))
    os.chdir(repo_root)

    download_images()
