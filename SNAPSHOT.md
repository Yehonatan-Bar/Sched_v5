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
│   │   ├── main.py      # FastAPI app with all CRUD endpoints
│   │   ├── models.py    # Pydantic models with validations
│   │   └── storage.py   # JSON file operations and backups
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── types/       # TypeScript interfaces + validation helpers
│   │   ├── store/       # Zustand state management with undo/redo
│   │   ├── contexts/    # Theme provider
│   │   ├── hooks/       # Custom hooks (useProjectLock)
│   │   ├── components/  # Layout, ThemeToggle, ProjectCard, Timeline, Modal, DurationPicker
│   │   └── pages/       # MainPage, ProjectPage
│   ├── package.json
│   └── vite.config.ts
├── data/
│   ├── state.json       # Main application state
│   └── backups/         # Timestamped backup snapshots
└── venv/                # Python virtual environment
```

## Current Features

### Backend
- Pydantic models with validations
- Full CRUD endpoints for Projects and Tasks
- Task-node endpoints for nested subtask operations
- Project order update endpoint
- JSON file persistence with backup/restore

### Frontend - Main Page (Dashboard)
- Full RTL support (Hebrew UI)
- Light/Dark theme toggle with system preference
- Drag-and-drop project reordering with keyboard navigation (Ctrl+Arrow)
- Visual "shrinking/opacity" effect based on list position
- Hover restores full size on desktop, tap on mobile
- Lock mechanism (click to lock at full size for 1 hour)
- Floating "+" button for adding new projects
- Mobile-friendly drag handles with larger touch targets

### Timeline Visualization
- **Level 1 (Milestones)**:
  - RTL timeline (past on right, future on left)
  - 5 zoom levels: months → weeks → days → hours → minutes
  - Zoom via + / − buttons (above timeline) or scroll wheel (when locked + hovering)
  - Task bars with automatic row assignment for overlaps
  - Distinct colors per task with connecting lines to labels
  - Drag to move tasks, resize handles for range tasks
  - Snap-to-grid based on zoom level
  - "Now" indicator (dashed red line)
  - Hint markers on edges for off-screen tasks
  - Point tasks displayed as circles
- **Level 2 (Sub-timeline)**:
  - Click on task bar to expand sub-timeline below
  - Other tasks dim to background (30% opacity)
  - Sub-timeline shows task's subtasks with their own time range
  - Close with click outside or ESC key
  - Subtask count indicator on task bars
- **Level 3 (People & Status)**:
  - People names displayed below task labels
  - "Waiting for" status shown with person name
  - Editable via task details modal

### Mobile Support (Stage 6)
- Touch gesture handlers for drag/resize operations
- Long-press or horizontal swipe to activate task drag
- Vertical scroll preserved (horizontal drag activates task movement)
- touch-action CSS to prevent scroll conflicts
- Larger touch targets (44px minimum) for resize handles
- Visual drag indicators on task bars

### Keyboard Accessibility (Stage 6)
- Arrow keys to navigate between tasks on timeline
- Shift+Arrow to move focused task on timeline
- Focus indicator with animated border
- Keyboard hints displayed when task is focused
- Full ARIA labels for screen reader support
- Ctrl+Arrow to reorder projects in list
- Ctrl+Z/Y for undo/redo, Ctrl+S for save

### Edge Case Handling (Stage 6)
- Tasks without schedule gracefully hidden from timeline
- Many overlapping tasks assigned to multiple rows
- Conflict detection for multi-tab editing ("last one wins")
- Warning banner when another tab saves changes
- Option to reload or dismiss conflict warning

### Task Details
- Info icon on each task bar opens details modal
- Modal shows: detailed description, people, notes, status
- Edit people as comma-separated list
- View subtask count

### Project Modals
- Detailed Description modal (per project)
- Draft Notebook modal (per project)
- Access via icons in project card header

### Project Page (Separate URL)
- Full textual view of all tasks and subtasks (no timeline)
- Task statistics bar: total count, by status
- Expandable task details (description, people, notes)
- Duration picker with unit selection (minutes/hours/days/weeks/months)
- Quick duration buttons and start/end date/time inputs
- Schedule dates displayed as text
- Create/edit/delete tasks at any nesting level
- Status dropdown with "Waiting For" input

### State Management
- "Working state" vs "saved global state" pattern
- Undo/Redo support (Ctrl+Z / Ctrl+Y)
- Global save button (Ctrl+S) with unsaved changes indicator
- Inline editing with focus/blur feedback
- Animated "Unsaved" badge for visual feedback

### Performance Optimizations (Stage 6)
- GPU-accelerated animations (will-change, translateZ)
- Respects prefers-reduced-motion for accessibility
- Smooth transitions with CSS variables
- Efficient resize observer for responsive timeline

## API Endpoints

### State & Backups
- `GET /api/health` - Health check
- `GET /api/state` - Get entire state
- `POST /api/state/save` - Save state (creates backup)
- `GET /api/state/backups` - List backups
- `POST /api/state/backups/{id}/restore` - Restore from backup

### Projects CRUD
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `GET /api/projects/{id}` - Get project
- `PATCH /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `PATCH /api/projects/{id}/notebook` - Update notebook
- `PATCH /api/projects/{id}/description` - Update description

### Tasks CRUD
- `POST /api/projects/{id}/tasks` - Create task
- `PATCH /api/projects/{id}/tasks/{task_id}` - Update task
- `DELETE /api/projects/{id}/tasks/{task_id}` - Delete task

### Task Node (nested)
- `POST /api/projects/{id}/task-node` - Create at path
- `PATCH /api/projects/{id}/task-node` - Update at path
- `DELETE /api/projects/{id}/task-node` - Delete at path

### UI State
- `PATCH /api/ui/project-order` - Update project order

## Known Issues
- Project time_range manual editing not implemented

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
