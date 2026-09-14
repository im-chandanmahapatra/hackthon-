# Argus Safety Intelligence 👁️

**Spatial AI Compliance Platform for Industrial Safety and Forensics**

Argus is an advanced computer vision platform designed for industrial environments to detect Personal Protective Equipment (PPE) compliance and environmental hazards like fire and smoke. It acts as a safety intelligence engine, transforming video feeds into actionable insights to ensure workplace safety.

---

## 🚀 Features (MVP)

- **Video Upload & Inference:** Upload pre-recorded video files (e.g., MP4) for automated frame-by-frame AI analysis.
- **PPE Detection:** Real-time detection of essential safety gear using fine-tuned models:
  - Hard Hats
  - High-Visibility Vests
  - Steel-Toe Footwear
  - Eye Protection / Goggles
  - Protective Work Gloves
- **Hazard Detection:** Identifies fire and smoke in the environment to trigger immediate high-priority alerts.
- **Incident Dashboard:** A live, auto-polling dashboard for monitoring compliance violations and safety incidents as they happen.
- **Evidence Snapshots:** Automatically captures and stores frame snapshots of detected violations as forensic evidence.
- **Acoustic Alerts:** Synthesized Web Audio API sound signatures for immediate auditory feedback on critical alerts.
- **Customizable Rules:** Fine-tune AI confidence thresholds and toggle specific PPE enforcement rules directly from the interface.

---

## 🛠️ Technology Stack

**Frontend:**
- React 18, TypeScript, Vite
- Tailwind CSS v4, Motion (Framer), Lucide Icons
- Custom Design System (Apple Editorial & Obsidian themes)

**Backend:**
- FastAPI (Python 3.10+)
- SQLite (Local development) / PostgreSQL (Production)
- SQLAlchemy ORM

**Machine Learning & Vision:**
- OpenCV (Frame extraction)
- Ultralytics YOLOv8n (Pre-trained and fine-tuned for PPE/Fire/Smoke)
- Native CPU inference optimized for hackathon environments

---

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Git

### Installation & Running Locally

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd argus-workspace
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Install backend dependencies:**
   It is highly recommended to use a Python virtual environment.
   ```bash
   cd backend
   python -m venv venv
   # On macOS/Linux: source venv/bin/activate
   # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cd ..
   ```

4. **Environment Configuration:**
   Copy the example environment file in the frontend and configure as needed:
   ```bash
   cp frontend/.env.example frontend/.env
   ```
   *(Ensure `VITE_API_BASE_URL` is set to `http://localhost:8000` or leave it empty for mock mode).*

5. **Start the Application:**
   Run the following command from the root directory to start both the frontend (Vite) and backend (FastAPI/Uvicorn) concurrently:
   ```bash
   npm run dev
   ```

6. **Access the Platform:**
   - Frontend: `http://localhost:5173`
   - Backend API Docs: `http://localhost:8000/docs`

---

## 🛡️ System Architecture & Workflow

The MVP focuses on a robust, single-stream golden path:
1. **Video Upload:** User uploads a clip via the Demo screen.
2. **Extraction:** OpenCV samples frames at ~2 FPS to optimize CPU load.
3. **AI Inference:** YOLOv8 runs sequentially on sampled frames for PPE and Fire detection.
4. **Validation/Debounce:** To prevent false positives, the system requires the hazard to be detected in multiple consecutive frames (e.g., 2 out of 3) before flagging.
5. **Zone Mapping & Storage:** The incident is tagged with a spatial zone and saved to the database with its evidence snapshot.
6. **Frontend Alert:** The dashboard polls the API, fetches the new incident, sounds an acoustic alert, and allows the operator to acknowledge it.

---

## 📁 Project Structure

```
.
├── /frontend      # React + Vite application (UI, state, API client)
├── /backend       # FastAPI server (Routers, DB models, ML wrappers)
├── /ml            # Machine learning weights and configurations
├── /uploads       # Local storage for user-uploaded videos
├── /evidence      # Local storage for generated violation snapshots
└── /scripts       # Node scripts for concurrent dev/start tasks
```

---

## 📄 License
This project is licensed under the MIT License.
