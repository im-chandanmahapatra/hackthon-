"""
ml/training/package_dataset.py
==============================
Packages the 22,138-image master dataset into a single compressed zip file
ready for fast upload to Google Drive or cloud storage for Google Colab training.

Usage:
    python ml/training/package_dataset.py
"""

import os
import sys
import zipfile
import time
from pathlib import Path

DATASET_DIR = Path(r"C:\Model\PPE_Master_System\dataset")
OUTPUT_ZIP = Path(r"C:\Model\PPE_Master_System\argus_ppe_dataset.zip")


def package_dataset():
    if not DATASET_DIR.exists():
        print(f"[ERROR] Dataset directory not found at: {DATASET_DIR}")
        sys.exit(1)

    print("=" * 70)
    print("  ARGUS — Packaging Master PPE Dataset for Cloud / Colab Training")
    print(f"  Source: {DATASET_DIR}")
    print(f"  Output: {OUTPUT_ZIP}")
    print("=" * 70)

    start_time = time.time()
    total_files = 0

    # Count files
    for root, _, files in os.walk(DATASET_DIR):
        total_files += len(files)

    print(f"Found {total_files:,} files to compress. Compressing...")

    OUTPUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
    count = 0

    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=1) as zipf:
        for root, _, files in os.walk(DATASET_DIR):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(DATASET_DIR)
                zipf.write(file_path, arcname)
                count += 1
                if count % 2500 == 0 or count == total_files:
                    elapsed = time.time() - start_time
                    percent = (count / total_files) * 100
                    print(f"  [{percent:5.1f}%] Compressed {count:,} / {total_files:,} files ({elapsed:.1f}s)")

    elapsed = time.time() - start_time
    zip_size_gb = OUTPUT_ZIP.stat().st_size / (1024 ** 3)

    print("=" * 70)
    print(f"[SUCCESS] Packaging complete in {elapsed:.1f} seconds!")
    print(f"  Archive: {OUTPUT_ZIP}")
    print(f"  Size:    {zip_size_gb:.2f} GB")
    print("  Next Step: Upload this zip to your Google Drive to train on Colab.")
    print("=" * 70)


if __name__ == "__main__":
    package_dataset()
