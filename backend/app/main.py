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
    MessageResponse,
    Project,
    ProjectCreate,
    ProjectListResponse,
    ProjectOrderUpdate,
    ProjectResponse,
    ProjectUpdate,
    RestoreResponse,
    SaveResponse,
    Task,
    TaskCreate,
    TaskNodeCreateRequest,
    TaskNodeDeleteRequest,
    TaskNodeUpdateRequest,
    TaskResponse,
    TaskStatus,
    TaskUpdate,
    TimeRange,
)
from .storage import get_storage
import uuid

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

@app.get("/", tags=["System"])
async def root():
    """Root endpoint - redirects to API docs."""
    return {
        "message": "Sched v5 API is running",
        "docs": "/docs",
        "health": "/api/health",
        "note": "This is the backend API. For the web app, access the frontend (port 5173)."
    }

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


# --- Helper Functions ---

def generate_id(prefix: str) -> str:
    """Generate a unique ID with a prefix."""
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def find_project_by_id(state: AppState, project_id: str) -> tuple[int, Project | None]:
    """Find a project by ID. Returns (index, project) or (-1, None)."""
    for i, project in enumerate(state.projects):
        if project.id == project_id:
            return i, project
    return -1, None


def find_task_by_path(tasks: list[Task], path: list[str]) -> Task | None:
    """Find a task by its path in a nested structure."""
    if not path:
        return None

    current_id = path[0]
    rest_path = path[1:]

    for task in tasks:
        if task.id == current_id:
            if not rest_path:
                return task
            return find_task_by_path(task.subtasks, rest_path)

    return None


def update_task_by_path(tasks: list[Task], path: list[str], updates: TaskUpdate) -> list[Task]:
    """Update a task by path, returning the new list."""
    if not path:
        return tasks

    current_id = path[0]
    rest_path = path[1:]

    result = []
    for task in tasks:
        if task.id == current_id:
            if not rest_path:
                # Apply updates to this task
                task_dict = task.model_dump()
                for key, value in updates.model_dump(exclude_unset=True).items():
                    task_dict[key] = value
                result.append(Task.model_validate(task_dict))
            else:
                # Recurse into subtasks
                updated_subtasks = update_task_by_path(task.subtasks, rest_path, updates)
                updated_task = task.model_copy(update={"subtasks": updated_subtasks})
                result.append(updated_task)
        else:
            result.append(task)

    return result


def delete_task_by_path(tasks: list[Task], path: list[str]) -> list[Task]:
    """Delete a task by path, returning the new list."""
    if not path:
        return tasks

    current_id = path[0]
    rest_path = path[1:]

    if not rest_path:
        # Delete this task
        return [task for task in tasks if task.id != current_id]

    result = []
    for task in tasks:
        if task.id == current_id:
            updated_subtasks = delete_task_by_path(task.subtasks, rest_path)
            updated_task = task.model_copy(update={"subtasks": updated_subtasks})
            result.append(updated_task)
        else:
            result.append(task)

    return result


def add_task_to_path(tasks: list[Task], parent_path: list[str], new_task: Task) -> list[Task]:
    """Add a task to a parent path, returning the new list."""
    if not parent_path:
        # Add to root level
        return tasks + [new_task]

    current_id = parent_path[0]
    rest_path = parent_path[1:]

    result = []
    for task in tasks:
        if task.id == current_id:
            if not rest_path:
                # Add to this task's subtasks
                updated_subtasks = task.subtasks + [new_task]
                updated_task = task.model_copy(update={"subtasks": updated_subtasks})
                result.append(updated_task)
            else:
                # Recurse
                updated_subtasks = add_task_to_path(task.subtasks, rest_path, new_task)
                updated_task = task.model_copy(update={"subtasks": updated_subtasks})
                result.append(updated_task)
        else:
            result.append(task)

    return result


def create_default_time_range() -> TimeRange:
    """Create a default time range (now to +1 month)."""
    now = datetime.now()
    end = datetime(now.year, now.month + 1 if now.month < 12 else 1,
                   now.day if now.month < 12 else 1,
                   now.hour, now.minute, now.second)
    if now.month == 12:
        end = end.replace(year=now.year + 1)

    return TimeRange(
        start_iso=now.isoformat(),
        end_iso=end.isoformat(),
        is_user_defined=False
    )


# --- Project CRUD Endpoints ---

@app.post("/api/projects", response_model=ProjectResponse, tags=["Projects"])
async def create_project(project_data: ProjectCreate):
    """
    Create a new project.

    - Body: Project data (title, description, etc.)
    - Returns: Created project
    """
    storage = get_storage()
    state = storage.load_state()

    # Generate new project ID
    project_id = generate_id("proj")

    # Create project with defaults
    new_project = Project(
        id=project_id,
        title=project_data.title,
        short_description=project_data.short_description,
        detailed_description=project_data.detailed_description,
        notebook=project_data.notebook,
        tags=project_data.tags,
        color=project_data.color,
        time_range=project_data.time_range or create_default_time_range(),
        milestones=[]
    )

    # Add to state
    state.projects.append(new_project)
    state.ui_state.project_order.append(project_id)

    # Save state
    storage.save_state(state, create_backup=False)

    return ProjectResponse(project=new_project)


@app.get("/api/projects", response_model=ProjectListResponse, tags=["Projects"])
async def list_projects():
    """
    List all projects in order.

    - Returns: List of projects sorted by project_order
    """
    storage = get_storage()
    state = storage.load_state()

    # Sort projects by order
    order = state.ui_state.project_order
    order_map = {pid: i for i, pid in enumerate(order)}

    sorted_projects = sorted(
        state.projects,
        key=lambda p: order_map.get(p.id, len(order))
    )

    return ProjectListResponse(projects=sorted_projects)


@app.get("/api/projects/{project_id}", response_model=ProjectResponse, tags=["Projects"])
async def get_project(project_id: str):
    """
    Get a single project by ID.

    - Path param: project_id
    - Returns: Project data
    """
    storage = get_storage()
    state = storage.load_state()

    _, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    return ProjectResponse(project=project)


@app.patch("/api/projects/{project_id}", response_model=ProjectResponse, tags=["Projects"])
async def update_project(project_id: str, updates: ProjectUpdate):
    """
    Update a project (partial update).

    - Path param: project_id
    - Body: Fields to update
    - Returns: Updated project
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Apply updates
    project_dict = project.model_dump()
    for key, value in updates.model_dump(exclude_unset=True).items():
        project_dict[key] = value

    updated_project = Project.model_validate(project_dict)
    state.projects[idx] = updated_project

    # Save state
    storage.save_state(state, create_backup=False)

    return ProjectResponse(project=updated_project)


@app.delete("/api/projects/{project_id}", response_model=MessageResponse, tags=["Projects"])
async def delete_project(project_id: str):
    """
    Delete a project.

    - Path param: project_id
    - Returns: Confirmation message
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Remove from projects list
    state.projects.pop(idx)

    # Remove from project order
    if project_id in state.ui_state.project_order:
        state.ui_state.project_order.remove(project_id)

    # Remove from locked projects
    if project_id in state.ui_state.locked_projects:
        del state.ui_state.locked_projects[project_id]

    # Save state
    storage.save_state(state, create_backup=False)

    return MessageResponse(message=f"Project '{project_id}' deleted", id=project_id)


# --- Project Order Endpoint ---

@app.patch("/api/ui/project-order", response_model=MessageResponse, tags=["UI"])
async def update_project_order(order_data: ProjectOrderUpdate):
    """
    Update the project display order.

    - Body: { project_order: [...] }
    - Returns: Confirmation message
    """
    storage = get_storage()
    state = storage.load_state()

    # Validate all project IDs exist
    existing_ids = {p.id for p in state.projects}
    for pid in order_data.project_order:
        if pid not in existing_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Project '{pid}' does not exist"
            )

    state.ui_state.project_order = order_data.project_order

    # Save state
    storage.save_state(state, create_backup=False)

    return MessageResponse(message="Project order updated")


# --- Task CRUD Endpoints ---

@app.post("/api/projects/{project_id}/tasks", response_model=TaskResponse, tags=["Tasks"])
async def create_task(project_id: str, task_data: TaskCreate):
    """
    Create a new task (milestone) in a project.

    - Path param: project_id
    - Body: Task data
    - Returns: Created task
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Generate new task ID
    task_id = generate_id("task")

    # Create task with defaults
    new_task = Task(
        id=task_id,
        title=task_data.title,
        details=task_data.details,
        status=task_data.status or TaskStatus(),
        priority=task_data.priority,
        tags=task_data.tags,
        color=task_data.color,
        schedule=task_data.schedule,
        people=task_data.people,
        notes=task_data.notes,
        subtasks=[]
    )

    # Add to project milestones
    project.milestones.append(new_task)

    # Save state
    storage.save_state(state, create_backup=False)

    return TaskResponse(task=new_task)


@app.patch("/api/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse, tags=["Tasks"])
async def update_task(project_id: str, task_id: str, updates: TaskUpdate):
    """
    Update a task (top-level milestone only).

    - Path param: project_id, task_id
    - Body: Fields to update
    - Returns: Updated task
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Find and update task
    task_found = False
    updated_task = None
    for i, task in enumerate(project.milestones):
        if task.id == task_id:
            task_dict = task.model_dump()
            for key, value in updates.model_dump(exclude_unset=True).items():
                task_dict[key] = value
            updated_task = Task.model_validate(task_dict)
            project.milestones[i] = updated_task
            task_found = True
            break

    if not task_found:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    # Save state
    storage.save_state(state, create_backup=False)

    return TaskResponse(task=updated_task)


@app.delete("/api/projects/{project_id}/tasks/{task_id}", response_model=MessageResponse, tags=["Tasks"])
async def delete_task(project_id: str, task_id: str):
    """
    Delete a task (top-level milestone only).

    - Path param: project_id, task_id
    - Returns: Confirmation message
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Find and delete task
    original_count = len(project.milestones)
    project.milestones = [t for t in project.milestones if t.id != task_id]

    if len(project.milestones) == original_count:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    # Save state
    storage.save_state(state, create_backup=False)

    return MessageResponse(message=f"Task '{task_id}' deleted", id=task_id)


# --- Task Node Endpoints (for nested subtasks) ---

@app.post("/api/projects/{project_id}/task-node", response_model=TaskResponse, tags=["Tasks"])
async def create_task_node(project_id: str, request: TaskNodeCreateRequest):
    """
    Create a task at a nested path (for subtasks).

    - Path param: project_id
    - Body: { parent_path: [...], node: {...} }
    - Returns: Created task
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Validate parent path exists (if provided)
    if request.parent_path:
        parent_task = find_task_by_path(project.milestones, request.parent_path)
        if not parent_task:
            raise HTTPException(
                status_code=404,
                detail=f"Parent path {request.parent_path} not found"
            )

    # Generate new task ID
    task_id = generate_id("task")

    # Create task
    new_task = Task(
        id=task_id,
        title=request.node.title,
        details=request.node.details,
        status=request.node.status or TaskStatus(),
        priority=request.node.priority,
        tags=request.node.tags,
        color=request.node.color,
        schedule=request.node.schedule,
        people=request.node.people,
        notes=request.node.notes,
        subtasks=[]
    )

    # Add to path
    project.milestones = add_task_to_path(project.milestones, request.parent_path, new_task)

    # Update state
    state.projects[idx] = project

    # Save state
    storage.save_state(state, create_backup=False)

    return TaskResponse(task=new_task)


@app.patch("/api/projects/{project_id}/task-node", response_model=TaskResponse, tags=["Tasks"])
async def update_task_node(project_id: str, request: TaskNodeUpdateRequest):
    """
    Update a task at a nested path.

    - Path param: project_id
    - Body: { path: [...], patch: {...} }
    - Returns: Updated task
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Validate path exists
    task = find_task_by_path(project.milestones, request.path)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task path {request.path} not found")

    # Update task
    project.milestones = update_task_by_path(project.milestones, request.path, request.patch)

    # Get updated task
    updated_task = find_task_by_path(project.milestones, request.path)

    # Update state
    state.projects[idx] = project

    # Save state
    storage.save_state(state, create_backup=False)

    return TaskResponse(task=updated_task)


@app.delete("/api/projects/{project_id}/task-node", response_model=MessageResponse, tags=["Tasks"])
async def delete_task_node(project_id: str, request: TaskNodeDeleteRequest):
    """
    Delete a task at a nested path.

    - Path param: project_id
    - Body: { path: [...] }
    - Returns: Confirmation message
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    # Validate path exists
    task = find_task_by_path(project.milestones, request.path)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task path {request.path} not found")

    task_id = request.path[-1] if request.path else None

    # Delete task
    project.milestones = delete_task_by_path(project.milestones, request.path)

    # Update state
    state.projects[idx] = project

    # Save state
    storage.save_state(state, create_backup=False)

    return MessageResponse(message="Task deleted", id=task_id)


# --- Notebook/Description Endpoints ---

@app.patch("/api/projects/{project_id}/notebook", response_model=MessageResponse, tags=["Projects"])
async def update_notebook(project_id: str, notebook: dict):
    """
    Update a project's notebook.

    - Path param: project_id
    - Body: { notebook: "..." }
    - Returns: Confirmation message
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    if "notebook" not in notebook:
        raise HTTPException(status_code=400, detail="notebook field is required")

    project.notebook = notebook["notebook"]

    # Save state
    storage.save_state(state, create_backup=False)

    return MessageResponse(message="Notebook updated")


@app.patch("/api/projects/{project_id}/description", response_model=MessageResponse, tags=["Projects"])
async def update_description(project_id: str, description: dict):
    """
    Update a project's detailed description.

    - Path param: project_id
    - Body: { detailed_description: "..." }
    - Returns: Confirmation message
    """
    storage = get_storage()
    state = storage.load_state()

    idx, project = find_project_by_id(state, project_id)

    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found")

    if "detailed_description" not in description:
        raise HTTPException(status_code=400, detail="detailed_description field is required")

    project.detailed_description = description["detailed_description"]

    # Save state
    storage.save_state(state, create_backup=False)

    return MessageResponse(message="Description updated")
