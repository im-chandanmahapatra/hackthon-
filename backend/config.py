import os
from pathlib import Path

# Root directory of the repository (C:\hackthon-)
REPO_ROOT = Path(__file__).resolve().parent.parent

class Settings:
    PROJECT_NAME: str = "Argus Safety Intelligence"
    DEBUG: bool = True

    # Database: default to local SQLite, swappable to PostgreSQL via env var
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{REPO_ROOT / 'argus.db'}")

    # Storage Paths
    UPLOAD_DIR: Path = REPO_ROOT / "uploads"
    EVIDENCE_DIR: Path = REPO_ROOT / "evidence"
    MODELS_DIR: Path = REPO_ROOT / "ml" / "weights"

    # AI Detection Thresholds
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.50"))
    
    # CORS - allow local Vite ports (5173, 5174, etc.), React ports, and regex for any localhost port
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080",
        ).split(",")
        if origin.strip()
    ]
    CORS_ORIGIN_REGEX: str = os.getenv(
        "CORS_ORIGIN_REGEX",
        r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    )

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
