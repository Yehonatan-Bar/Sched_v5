"""
FastAPI application for Sched_v5 task management.
Provides REST API endpoints for state management and backups.
"""
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    AppState,
    BackupInfo,
    BackupListResponse,
    BackupReason,
    HealthResponse,
    RestoreResponse,
    SaveResponse,
)
from .storage import get_storage

app = FastAPI(
    title="Sched v5 API",
    description="Task and project management API with timeline support",
    version="1.0.0",
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health Check ---

@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check API availability."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now().isoformat()
    )


# --- State Management ---

@app.get("/api/state", response_model=AppState, tags=["State"])
async def get_state():
    """
    Get the entire application state.
    Returns all projects, settings, and metadata.
    """
    storage = get_storage()
    return storage.load_state()


@app.post("/api/state/save", response_model=SaveResponse, tags=["State"])
async def save_state(state: AppState):
    """
    Save the entire application state.
    Creates a backup before saving.

    - Body: Complete application state
    - Returns: saved_at timestamp and backup_id
    """
    storage = get_storage()
    backup_info = storage.save_state(
        state,
        create_backup=True,
        backup_reason=BackupReason.MANUAL_SAVE
    )

    return SaveResponse(
        saved_at=datetime.now().isoformat(),
        backup_id=backup_info.id if backup_info else "no_previous_state"
    )


# --- Backup Management ---

@app.get("/api/state/backups", response_model=BackupListResponse, tags=["Backups"])
async def list_backups():
    """
    List all available backups.
    Returns backup metadata (id, timestamp, reason, file path).
    """
    storage = get_storage()
    backups = storage.list_backups()
    return BackupListResponse(backups=backups)


@app.post("/api/state/backups/{backup_id}/restore", response_model=RestoreResponse, tags=["Backups"])
async def restore_backup(backup_id: str):
    """
    Restore state from a specific backup.
    Creates a pre-restore backup of the current state first.

    - Path param: backup_id - The ID of the backup to restore
    - Returns: restored_from backup_id and restored_at timestamp
    """
    storage = get_storage()

    success, message = storage.restore_backup(backup_id)

    if not success:
        raise HTTPException(status_code=404, detail=message)

    return RestoreResponse(
        restored_from=backup_id,
        restored_at=datetime.now().isoformat()
    )


@app.get("/api/state/backups/{backup_id}", response_model=BackupInfo, tags=["Backups"])
async def get_backup(backup_id: str):
    """
    Get information about a specific backup.

    - Path param: backup_id - The ID of the backup
    - Returns: Backup metadata
    """
    storage = get_storage()
    backup_info = storage.get_backup_by_id(backup_id)

    if not backup_info:
        raise HTTPException(status_code=404, detail=f"Backup '{backup_id}' not found")

    return backup_info
