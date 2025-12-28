"""
Pydantic models for the Sched_v5 task management application.
Based on the JSON schema defined in the project specification.
"""
from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional, Literal
from pydantic import BaseModel, Field, model_validator


class StatusType(str, Enum):
    """Task status types."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    STUCK = "stuck"
    DONE = "done"
    WAITING_FOR = "waiting_for"


class ScheduleMode(str, Enum):
    """Schedule mode: range (start/end) or point (single timestamp)."""
    RANGE = "range"
    POINT = "point"


class ThemeType(str, Enum):
    """Theme options."""
    SYSTEM = "system"
    LIGHT = "light"
    DARK = "dark"


class BackupReason(str, Enum):
    """Reason for creating a backup."""
    MANUAL_SAVE = "manual_save"
    AUTO_BACKUP = "auto_backup"
    PRE_RESTORE = "pre_restore"


# --- Task/Subtask Models ---

class TaskStatus(BaseModel):
    """Status of a task."""
    type: StatusType = StatusType.NOT_STARTED
    waiting_for: Optional[str] = None

    @model_validator(mode='after')
    def validate_waiting_for(self) -> 'TaskStatus':
        """Validate that waiting_for is provided when status is WAITING_FOR."""
        if self.type == StatusType.WAITING_FOR:
            if not self.waiting_for or not self.waiting_for.strip():
                raise ValueError("waiting_for name is required when status is 'waiting_for'")
        return self


class TaskScheduleRange(BaseModel):
    """Schedule for a task with a time range."""
    mode: Literal["range"] = "range"
    start_iso: str
    end_iso: str

    @model_validator(mode='after')
    def validate_date_range(self) -> 'TaskScheduleRange':
        """Validate that end is not before start."""
        try:
            start = datetime.fromisoformat(self.start_iso.replace('Z', '+00:00'))
            end = datetime.fromisoformat(self.end_iso.replace('Z', '+00:00'))
            if end < start:
                raise ValueError("end date cannot be before start date")
        except ValueError as e:
            if "end date cannot be before start date" in str(e):
                raise
            # If parsing fails, let it pass - the format might be validated elsewhere
        return self


class TaskSchedulePoint(BaseModel):
    """Schedule for a task at a single point in time."""
    mode: Literal["point"] = "point"
    point_iso: str


TaskSchedule = TaskScheduleRange | TaskSchedulePoint


class Task(BaseModel):
    """
    Task model - used for both milestones and subtasks (recursive structure).
    Supports unlimited nesting depth.
    """
    id: str
    title: str = ""
    details: str = ""
    status: TaskStatus = Field(default_factory=TaskStatus)
    priority: int = 1
    tags: list[str] = Field(default_factory=list)
    color: str = "auto"
    schedule: Optional[TaskSchedule] = None
    people: list[str] = Field(default_factory=list)
    notes: str = ""
    subtasks: list[Task] = Field(default_factory=list)


# --- Project Models ---

class TimeRange(BaseModel):
    """Time range for a project."""
    start_iso: str
    end_iso: str
    is_user_defined: bool = False

    @model_validator(mode='after')
    def validate_date_range(self) -> 'TimeRange':
        """Validate that end is not before start."""
        try:
            start = datetime.fromisoformat(self.start_iso.replace('Z', '+00:00'))
            end = datetime.fromisoformat(self.end_iso.replace('Z', '+00:00'))
            if end < start:
                raise ValueError("end date cannot be before start date")
        except ValueError as e:
            if "end date cannot be before start date" in str(e):
                raise
        return self


class Project(BaseModel):
    """Project model."""
    id: str
    title: str = ""
    short_description: str = ""
    detailed_description: str = ""
    notebook: str = ""
    tags: list[str] = Field(default_factory=list)
    color: str = "auto"
    time_range: Optional[TimeRange] = None
    milestones: list[Task] = Field(default_factory=list)


# --- UI State Models ---

class LockedProject(BaseModel):
    """Locked project state."""
    locked_until_epoch_ms: int


class UndoState(BaseModel):
    """Undo/Redo state (stored client-side, but structure defined here)."""
    stack: list[dict] = Field(default_factory=list)
    redo_stack: list[dict] = Field(default_factory=list)


class UIState(BaseModel):
    """UI state for the application."""
    project_order: list[str] = Field(default_factory=list)
    locked_projects: dict[str, LockedProject] = Field(default_factory=dict)
    undo: UndoState = Field(default_factory=UndoState)


# --- App Settings Models ---

class AppSettings(BaseModel):
    """Application settings."""
    timezone: str = "Asia/Jerusalem"
    date_format: str = "DD/MM/YY"
    rtl: bool = True
    theme: ThemeType = ThemeType.SYSTEM


# --- Backup Models ---

class BackupInfo(BaseModel):
    """Information about a backup."""
    id: str
    created_at_iso: str
    reason: BackupReason = BackupReason.MANUAL_SAVE
    file_path: str


# --- Root State Model ---

class AppState(BaseModel):
    """
    Root state model for the entire application.
    This is what gets saved to and loaded from the JSON file.
    """
    schema_version: int = 1
    app: AppSettings = Field(default_factory=AppSettings)
    ui_state: UIState = Field(default_factory=UIState)
    projects: list[Project] = Field(default_factory=list)
    backups: list[BackupInfo] = Field(default_factory=list)


# --- API Response Models ---

class SaveResponse(BaseModel):
    """Response from save endpoint."""
    saved_at: str
    backup_id: str


class BackupListResponse(BaseModel):
    """Response listing all backups."""
    backups: list[BackupInfo]


class RestoreResponse(BaseModel):
    """Response from restore endpoint."""
    restored_from: str
    restored_at: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    timestamp: str


# --- CRUD Request/Response Models ---

class ProjectCreate(BaseModel):
    """Request to create a new project."""
    title: str = ""
    short_description: str = ""
    detailed_description: str = ""
    notebook: str = ""
    tags: list[str] = Field(default_factory=list)
    color: str = "auto"
    time_range: Optional[TimeRange] = None


class ProjectUpdate(BaseModel):
    """Request to update a project (partial update)."""
    title: Optional[str] = None
    short_description: Optional[str] = None
    detailed_description: Optional[str] = None
    notebook: Optional[str] = None
    tags: Optional[list[str]] = None
    color: Optional[str] = None
    time_range: Optional[TimeRange] = None


class ProjectResponse(BaseModel):
    """Response containing a project."""
    project: Project


class ProjectListResponse(BaseModel):
    """Response containing a list of projects."""
    projects: list[Project]


class ProjectOrderUpdate(BaseModel):
    """Request to update project order."""
    project_order: list[str]


class TaskCreate(BaseModel):
    """Request to create a new task."""
    title: str = ""
    details: str = ""
    status: Optional[TaskStatus] = None
    priority: int = 1
    tags: list[str] = Field(default_factory=list)
    color: str = "auto"
    schedule: Optional[TaskSchedule] = None
    people: list[str] = Field(default_factory=list)
    notes: str = ""


class TaskUpdate(BaseModel):
    """Request to update a task (partial update)."""
    title: Optional[str] = None
    details: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[int] = None
    tags: Optional[list[str]] = None
    color: Optional[str] = None
    schedule: Optional[TaskSchedule] = None
    people: Optional[list[str]] = None
    notes: Optional[str] = None


class TaskResponse(BaseModel):
    """Response containing a task."""
    task: Task


class TaskNodeRequest(BaseModel):
    """Request for task-node operations (nested path-based updates)."""
    path: list[str]  # Path to the task (e.g., ["task_1", "task_1_1"])


class TaskNodeCreateRequest(BaseModel):
    """Request to create a task at a nested path."""
    parent_path: list[str] = Field(default_factory=list)  # Empty = top level
    node: TaskCreate


class TaskNodeUpdateRequest(BaseModel):
    """Request to update a task at a nested path."""
    path: list[str]
    patch: TaskUpdate


class TaskNodeDeleteRequest(BaseModel):
    """Request to delete a task at a nested path."""
    path: list[str]


class MessageResponse(BaseModel):
    """Generic message response."""
    message: str
    id: Optional[str] = None
