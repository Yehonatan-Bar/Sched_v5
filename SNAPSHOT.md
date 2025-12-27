# Project Snapshot

## Overview
Personal task/project management application with hierarchical timelines, RTL support, and dynamic UI.

## Tech Stack
- **Backend**: Python 3.12, FastAPI, Pydantic v2, Uvicorn
- **Frontend**: React 18, TypeScript, Vite, Zustand, React Router v6
- **Storage**: JSON file with backup mechanism
- **Styling**: CSS Variables (light/dark theme support)

## Project Structure
```
Sched_v5/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py      # FastAPI app with endpoints
│   │   ├── models.py    # Pydantic models
│   │   └── storage.py   # JSON file operations and backups
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── types/       # TypeScript interfaces
│   │   ├── store/       # Zustand state management
│   │   ├── contexts/    # Theme provider
│   │   ├── hooks/       # Custom hooks
│   │   ├── components/  # Reusable components (Layout, ThemeToggle, ProjectCard)
│   │   └── pages/       # Route pages (MainPage, ProjectPage)
│   ├── package.json
│   └── vite.config.ts
├── data/
│   ├── state.json       # Main application state
│   └── backups/         # Timestamped backup snapshots
└── venv/                # Python virtual environment
```

## Current Features

### Backend
- Pydantic models for: Project, Task (recursive), TimeRange, Schedule, Status, Backups
- JSON file persistence with load/save functionality
- Automatic backup creation before each save
- Backup restore with pre-restore snapshot

### Frontend
- Full RTL support (Hebrew UI, direction: rtl)
- Light/Dark theme toggle with system preference detection
- Two-page routing (Main: project list, Project: task list)
- State management with "working state" vs "saved global state" pattern
- Undo/Redo support (Ctrl+Z / Ctrl+Y)
- Global save button (Ctrl+S) with unsaved changes indicator
- Projects: create, edit title/description, delete
- Tasks: nested unlimited depth, create, edit, delete

## API Endpoints (Implemented)
- `GET /api/health` - Health check
- `GET /api/state` - Get entire application state
- `POST /api/state/save` - Save state (creates backup)
- `GET /api/state/backups` - List all backups
- `POST /api/state/backups/{backup_id}/restore` - Restore from backup
- `GET /api/state/backups/{backup_id}` - Get backup info

## Known Issues
- Additional CRUD endpoints for projects/tasks not yet implemented
- Drag-and-drop for project reordering not implemented
- Timeline visualization not implemented (only task list view)
- Project locking (sticky focus) not implemented

## Configuration
- Backend port: 8000
- Frontend dev port: 5173 (proxies /api to backend)
- Data directory: `./data/`
- Theme preference stored in localStorage

## How to Run
```bash
# Backend
cd Sched_v5
venv/Scripts/pip install -r backend/requirements.txt
venv/Scripts/uvicorn backend.app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev      # Development server on http://localhost:5173
npm run build    # Production build
```
