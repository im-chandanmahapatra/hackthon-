"""
ml/models/loader.py
===================
Model loader with priority-based selection:
  optimized → master → merged → legacy
  With automatic fallback on any loading failure.
"""

from __future__ import annotations
import os
import yaml
import hashlib
from pathlib import Path
from typing import Optional, Tuple

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False
    YOLO = None

# Repo root resolution (two levels up from this file: ml/models/ → ml/ → repo_root/)
_THIS_FILE = Path(__file__).resolve()
REPO_ROOT  = _THIS_FILE.parent.parent.parent           # C:\hackthon-
WEIGHTS_DIR = REPO_ROOT / "ml" / "weights"
CONFIG_PATH = REPO_ROOT / "ml" / "configs" / "model_config.yaml"

# Known SHA-256 checksums for integrity verification
KNOWN_CHECKSUMS = {
    "ppe_best.pt":   "07172EF3AE9E256C40A1FB0CE3EEFE5547D90170645AA73DDED0FFFC382CDB31",
    "ppe_master.pt": "12B23C4CFA5B4FBE2932B977D7E1D26D8081E54044DEB18EAB9A3AFEACCA0663",
}


def compute_sha256(path: Path, chunk: int = 1 << 20) -> str:
    """Compute SHA-256 of a file, reading in chunks for large models."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest().upper()


def verify_model_integrity(path: Path) -> Tuple[bool, str]:
    """Returns (ok, message). Checks known checksums if registered."""
    name = path.name
    if name not in KNOWN_CHECKSUMS:
        return True, f"[ModelLoader] No checksum registered for {name}; skipping verification."
    expected = KNOWN_CHECKSUMS[name]
    actual = compute_sha256(path)
    if actual == expected:
        return True, f"[ModelLoader] Integrity OK: {name}"
    return False, (f"[ModelLoader] ⚠️  CHECKSUM MISMATCH for {name}!\n"
                   f"  Expected: {expected}\n  Got:      {actual}")


def load_config() -> dict:
    """Load model_config.yaml; return safe defaults if missing."""
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r") as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            print(f"[ModelLoader] Could not parse config: {e}")
    return {"mode": "optimized"}


def _try_load_yolo(path: Path) -> Optional[object]:
    """Attempt to load a YOLO model; returns None on failure."""
    if not ULTRALYTICS_AVAILABLE:
        return None
    if not path.exists():
        return None
    try:
        model = YOLO(str(path))
        print(f"[ModelLoader] ✅ Loaded: {path.name}")
        return model
    except Exception as e:
        print(f"[ModelLoader] ❌ Failed to load {path.name}: {e}")
        return None


def load_ppe_model(mode: Optional[str] = None) -> Tuple[Optional[object], str]:
    """
    Load the PPE model according to the configured mode.

    Returns:
        (model, name) — model is None only if ALL weights fail to load.
    """
    cfg = load_config()
    effective_mode = mode or cfg.get("mode", "optimized")

    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

    legacy_path  = WEIGHTS_DIR / "ppe_best.pt"
    master_path  = WEIGHTS_DIR / "ppe_master.pt"
    merged_path  = WEIGHTS_DIR / "ppe_merged_best.pt"

    # --- Verify integrity of critical files ---
    for p in [legacy_path, master_path]:
        if p.exists():
            ok, msg = verify_model_integrity(p)
            print(msg)
            if not ok:
                print("[ModelLoader] ⚠️  Integrity check failed; model will still be loaded with caution.")

    if effective_mode == "legacy":
        m = _try_load_yolo(legacy_path)
        if m is not None:
            return m, "legacy (ppe_best.pt)"
        raise RuntimeError("[ModelLoader] CRITICAL: Legacy model ppe_best.pt could not be loaded.")

    if effective_mode in ("optimized", "ensemble"):
        # Preference: merged > master > legacy
        for path, label in [
            (merged_path, "merged (ppe_merged_best.pt)"),
            (master_path, "master (ppe_master.pt)"),
            (legacy_path, "legacy-fallback (ppe_best.pt)"),
        ]:
            m = _try_load_yolo(path)
            if m is not None:
                return m, label

        raise RuntimeError(
            "[ModelLoader] CRITICAL: No PPE model could be loaded. "
            "Ensure ppe_best.pt exists in ml/weights/"
        )

    raise ValueError(f"[ModelLoader] Unknown mode: {effective_mode}")
