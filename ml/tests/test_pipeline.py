import sys
import os
sys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None

import time
import json
import hashlib
from pathlib import Path

REPO_ROOT   = Path(__file__).resolve().parent.parent.parent
WEIGHTS_DIR = REPO_ROOT / "ml" / "weights"

results = []

def _record(name, status, detail=""):
    results.append({"test": name, "status": status, "detail": detail})
    print(f"  [{status}] {name}: {str(detail)[:80]}")

def test_model_integrity():
    print("\n[1] Model Integrity Checks")
    KNOWN = {
        "ppe_best.pt":   "07172EF3AE9E256C40A1FB0CE3EEFE5547D90170645AA73DDED0FFFC382CDB31",
        "ppe_master.pt": "12B23C4CFA5B4FBE2932B977D7E1D26D8081E54044DEB18EAB9A3AFEACCA0663",
    }
    for fname, expected in KNOWN.items():
        path = WEIGHTS_DIR / fname
        if not path.exists():
            _record(f"integrity:{fname}", "FAIL", "File not found")
            continue
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
        actual = h.hexdigest().upper()
        if actual == expected:
            _record(f"integrity:{fname}", "PASS", f"SHA256={actual[:16]}...")
        else:
            _record(f"integrity:{fname}", "FAIL", f"Expected {expected[:16]} got {actual[:16]}")

def test_model_loading():
    print("\n[2] Model Loading")
    for fname in ["ppe_master.pt", "ppe_best.pt"]:
        path = WEIGHTS_DIR / fname
        if not path.exists():
            _record(f"load:{fname}", "WARN", "File not found")
            continue
        try:
            from ultralytics import YOLO
            m = YOLO(str(path))
            _record(f"load:{fname}", "PASS", f"Classes: {list(m.names.values())}")
        except Exception as e:
            _record(f"load:{fname}", "FAIL", str(e)[:60])
    try:
        from ml.inference.engine import InferenceEngine
        eng = InferenceEngine()
        _record("InferenceEngine:init", "PASS", f"Mode: {eng._model_label}")
    except Exception as e:
        _record("InferenceEngine:init", "FAIL", str(e)[:60])

def test_api_contract():
    print("\n[3] API Contract")
    import numpy as np
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    for fn_name in ["run_ppe", "run_fire", "infer_frame"]:
        try:
            import ml.inference_wrapper as w
            fn = getattr(w, fn_name)
            result = fn(frame)
            if fn_name == "infer_frame":
                assert isinstance(result, dict)
                assert "detections" in result
                assert "frame_width" in result
            else:
                assert isinstance(result, list)
            _record(f"api:{fn_name}", "PASS", f"Type: {type(result).__name__}")
        except Exception as e:
            _record(f"api:{fn_name}", "FAIL", str(e)[:60])

def test_video_pipeline():
    print("\n[4] Video Pipeline")
    video_path = REPO_ROOT / "test_clip.mp4"
    if not video_path.exists():
        _record("video:file_exists", "WARN", "test_clip.mp4 not found")
        return
    try:
        import cv2
        import numpy as np
        from ml.inference_wrapper import run_ppe, run_fire
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            _record("video:open", "FAIL", "Cannot open test_clip.mp4")
            return
        fps_n = cap.get(cv2.CAP_PROP_FPS) or 25.0
        step = max(1, int(fps_n / 2))
        frames_ok = 0; crashes = 0; frame_idx = 0
        t0 = time.perf_counter()
        while frames_ok < 10:
            ret, frame = cap.read()
            if not ret: break
            if frame_idx % step == 0:
                try:
                    ppe = run_ppe(frame); fire = run_fire(frame)
                    assert isinstance(ppe, list); assert isinstance(fire, list)
                    frames_ok += 1
                except Exception as e:
                    crashes += 1
            frame_idx += 1
        cap.release()
        elapsed = time.perf_counter() - t0
        fps = frames_ok / elapsed if elapsed > 0 else 0
        if crashes == 0:
            _record("video:pipeline", "PASS", f"{frames_ok} frames, {fps:.1f} FPS")
        else:
            _record("video:pipeline", "FAIL", f"{crashes} crashes")
    except Exception as e:
        _record("video:pipeline", "FAIL", str(e)[:60])

def test_database():
    print("\n[5] Database")
    db_path = REPO_ROOT / "argus.db"
    if not db_path.exists():
        _record("db:exists", "WARN", "argus.db not found")
        return
    try:
        import sqlite3
        con = sqlite3.connect(str(db_path))
        tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
        required = {"zones", "cameras", "incidents", "detections", "evidence", "processing_jobs"}
        missing = required - tables
        if not missing:
            _record("db:schema", "PASS", f"Tables OK: {sorted(tables)}")
        else:
            _record("db:schema", "FAIL", f"Missing: {missing}")
        con.close()
    except Exception as e:
        _record("db:schema", "FAIL", str(e)[:60])

def test_performance():
    print("\n[6] Performance")
    import numpy as np
    frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    try:
        from ml.inference_wrapper import run_ppe
        times = []
        for _ in range(5):
            t0 = time.perf_counter()
            run_ppe(frame)
            times.append((time.perf_counter() - t0) * 1000)
        mean_ms = sum(times) / len(times)
        fps = 1000.0 / mean_ms if mean_ms > 0 else 0
        _record("perf:run_ppe", "PASS" if fps > 1 else "WARN", f"Mean={mean_ms:.1f}ms FPS={fps:.1f}")
    except Exception as e:
        _record("perf:run_ppe", "FAIL", str(e)[:60])

if __name__ == "__main__":
    print("=" * 60)
    print("  ARGUS Pipeline Test Suite")
    print("=" * 60)
    test_model_integrity()
    test_model_loading()
    test_api_contract()
    test_video_pipeline()
    test_database()
    test_performance()
    print("\n" + "=" * 60)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    warned = sum(1 for r in results if r["status"] == "WARN")
    print(f"  TOTAL: {len(results)}  PASS: {passed}  FAIL: {failed}  WARN: {warned}")
    print("=" * 60)
    if failed:
        print("\n  FAILED:")
        for r in results:
            if r["status"] == "FAIL":
                print(f"    - {r['test']}: {r['detail']}")
    out = REPO_ROOT / "ml" / "experiments" / "test_results.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w") as f:
        json.dump({"results": results, "summary": {"total": len(results), "passed": passed, "failed": failed}}, f, indent=2)
    print(f"\n  Results: {out}")
    sys.exit(0 if failed == 0 else 1)
