from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import settings
from backend.seed import seed_database
from backend.routers import incidents, cameras, demo

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema is created and seeded with default zones and cameras
    print("[Argus] Initializing database and verifying seed records...")
    seed_database()
    yield
    print("[Argus] Shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Spatial AI Compliance Platform for Industrial Safety and Forensics",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for React / Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for generated visual evidence snapshots and surveillance recordings
app.mount("/evidence", StaticFiles(directory=str(settings.EVIDENCE_DIR)), name="evidence")
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")

# Register API routers
app.include_router(demo.router)
app.include_router(incidents.router)
app.include_router(cameras.router)

@app.get("/")
def health_check():
    return {
        "status": "online",
        "system": "Argus Safety Intelligence Engine",
        "version": "1.0.0",
        "api_docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
