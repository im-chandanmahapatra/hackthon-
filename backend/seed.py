from backend.db import SessionLocal, Base, engine
from backend.models import Zone, Camera

def seed_database():
    """Create all tables and seed zones and cameras if not already present."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Zone).count() == 0:
            zones = [
                Zone(id="zone-a", name="Zone A - Assembly Floor", floor_area="1,200 sq m"),
                Zone(id="zone-b", name="Zone B - Welding Cell", floor_area="650 sq m"),
                Zone(id="zone-c", name="Zone C - Logistics Bay", floor_area="2,100 sq m"),
            ]
            db.add_all(zones)
            db.commit()
            print("[OK] Seeded 3 physical zones")

        if db.query(Camera).count() == 0:
            cameras = [
                Camera(id="cam-01", zone_id="zone-a", label="Assembly Conveyor 01", status="active"),
                Camera(id="cam-02", zone_id="zone-a", label="Overhead Robotic Cell", status="active"),
                Camera(id="cam-03", zone_id="zone-b", label="Welding Booth North", status="active"),
                Camera(id="cam-04", zone_id="zone-c", label="Loading Dock Entry", status="active"),
                Camera(id="cam-05", zone_id="zone-c", label="High-Bay Racks East", status="active"),
            ]
            db.add_all(cameras)
            db.commit()
            print("[OK] Seeded 5 cameras")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
