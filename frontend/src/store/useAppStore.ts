import { create } from 'zustand';
import {
  AppData,
  Project,
  Task,
  createDefaultAppData,
  createDefaultProject,
} from '../types';

// Deep clone helper
const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// Generate unique ID
const generateId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface AppStore {
  // Saved state - last persisted to server
  savedState: AppData | null;

  // Working state - current in-memory state with pending changes
  workingState: AppData | null;

  // Computed: are there unsaved changes?
  isDirty: boolean;

  // Undo/Redo stacks (stored separately from app data for performance)
  undoStack: AppData[];
  redoStack: AppData[];

  // Loading state
  isLoading: boolean;
  isSaving: boolean;

  // Actions - State loading
  loadState: (data: AppData) => void;
  initializeEmpty: () => void;

  // Actions - Projects
  addProject: () => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  reorderProjects: (newOrder: string[]) => void;

  // Actions - Tasks
  addTask: (projectId: string, parentPath?: string[]) => void;
  updateTask: (projectId: string, taskPath: string[], updates: Partial<Task>) => void;
  deleteTask: (projectId: string, taskPath: string[]) => void;

  // Actions - Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Actions - Persistence
  save: () => Promise<void>;
  markSaved: () => void;

  // Internal helper to push to undo stack before changes
  _pushUndo: () => void;
}

// Find task by path in nested structure
const findTaskByPath = (tasks: Task[], path: string[]): Task | null => {
  if (path.length === 0) return null;

  const [currentId, ...restPath] = path;
  const task = tasks.find((t) => t.id === currentId);

  if (!task) return null;
  if (restPath.length === 0) return task;

  return findTaskByPath(task.subtasks, restPath);
};

// Update task by path in nested structure (immutable)
const updateTaskByPath = (
  tasks: Task[],
  path: string[],
  updates: Partial<Task>
): Task[] => {
  if (path.length === 0) return tasks;

  const [currentId, ...restPath] = path;

  return tasks.map((task) => {
    if (task.id !== currentId) return task;

    if (restPath.length === 0) {
      return { ...task, ...updates };
    }

    return {
      ...task,
      subtasks: updateTaskByPath(task.subtasks, restPath, updates),
    };
  });
};

// Delete task by path (immutable)
const deleteTaskByPath = (tasks: Task[], path: string[]): Task[] => {
  if (path.length === 0) return tasks;

  const [currentId, ...restPath] = path;

  if (restPath.length === 0) {
    return tasks.filter((t) => t.id !== currentId);
  }

  return tasks.map((task) => {
    if (task.id !== currentId) return task;

    return {
      ...task,
      subtasks: deleteTaskByPath(task.subtasks, restPath),
    };
  });
};

// Add task to parent (immutable)
const addTaskToParent = (
  tasks: Task[],
  parentPath: string[],
  newTask: Task
): Task[] => {
  if (parentPath.length === 0) {
    return [...tasks, newTask];
  }

  const [currentId, ...restPath] = parentPath;

  return tasks.map((task) => {
    if (task.id !== currentId) return task;

    if (restPath.length === 0) {
      return {
        ...task,
        subtasks: [...task.subtasks, newTask],
      };
    }

    return {
      ...task,
      subtasks: addTaskToParent(task.subtasks, restPath, newTask),
    };
  });
};

export const useAppStore = create<AppStore>((set, get) => ({
  savedState: null,
  workingState: null,
  isDirty: false,
  undoStack: [],
  redoStack: [],
  isLoading: false,
  isSaving: false,

  loadState: (data: AppData) => {
    set({
      savedState: deepClone(data),
      workingState: deepClone(data),
      isDirty: false,
      undoStack: [],
      redoStack: [],
      isLoading: false,
    });
  },

  initializeEmpty: () => {
    const defaultData = createDefaultAppData();
    set({
      savedState: deepClone(defaultData),
      workingState: deepClone(defaultData),
      isDirty: false,
      undoStack: [],
      redoStack: [],
    });
  },

  _pushUndo: () => {
    const { workingState, undoStack } = get();
    if (workingState) {
      set({
        undoStack: [...undoStack, deepClone(workingState)],
        redoStack: [], // Clear redo on new change
      });
    }
  },

  addProject: () => {
    const { workingState, _pushUndo } = get();
    if (!workingState) return;

    _pushUndo();

    const newId = generateId('proj');
    const newProject = createDefaultProject(newId);

    set({
      workingState: {
        ...workingState,
        projects: [...workingState.projects, newProject],
        ui_state: {
          ...workingState.ui_state,
          project_order: [...workingState.ui_state.project_order, newId],
        },
      },
      isDirty: true,
    });
  },

  updateProject: (id: string, updates: Partial<Project>) => {
    const { workingState, _pushUndo } = get();
    if (!workingState) return;

    _pushUndo();

    set({
      workingState: {
        ...workingState,
        projects: workingState.projects.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      },
      isDirty: true,
    });
  },

  deleteProject: (id: string) => {
    const { workingState, _pushUndo } = get();
    if (!workingState) return;

    _pushUndo();

    set({
      workingState: {
        ...workingState,
        projects: workingState.projects.filter((p) => p.id !== id),
        ui_state: {
          ...workingState.ui_state,
          project_order: workingState.ui_state.project_order.filter(
            (pid) => pid !== id
          ),
        },
      },
      isDirty: true,
    });
  },

  reorderProjects: (newOrder: string[]) => {
    const { workingState, _pushUndo } = get();
    if (!workingState) return;

    _pushUndo();

    set({
      workingState: {
        ...workingState,
        ui_state: {
          ...workingState.ui_state,
          project_order: newOrder,
        },
      },
      isDirty: true,
    });
  },

  addTask: (projectId: string, parentPath: string[] = []) => {
    const { workingState, _pushUndo } = get();
    if (!workingState) return;

    _pushUndo();

    const newId = generateId('task');
    const newTask: Task = {
      id: newId,
      title: '',
      details: '',
      status: { type: 'not_started', waiting_for: null },
      priority: 1,
      tags: [],
      color: 'auto',
      schedule: null,
      people: [],
      notes: '',
      subtasks: [],
    };

    set({
      workingState: {
        ...workingState,
        projects: workingState.projects.map((p) => {
          if (p.id !== projectId) return p;

          return {
            ...p,
            milestones: addTaskToParent(p.milestones, parentPath, newTask),
          };
        }),
      },
      isDirty: true,
    });
  },

  updateTask: (projectId: string, taskPath: string[], updates: Partial<Task>) => {
    const { workingState, _pushUndo } = get();
    if (!workingState) return;

    _pushUndo();

    set({
      workingState: {
        ...workingState,
        projects: workingState.projects.map((p) => {
          if (p.id !== projectId) return p;

          return {
            ...p,
            milestones: updateTaskByPath(p.milestones, taskPath, updates),
          };
        }),
      },
      isDirty: true,
    });
  },

  deleteTask: (projectId: string, taskPath: string[]) => {
    const { workingState, _pushUndo } = get();
    if (!workingState) return;

    _pushUndo();

    set({
      workingState: {
        ...workingState,
        projects: workingState.projects.map((p) => {
          if (p.id !== projectId) return p;

          return {
            ...p,
            milestones: deleteTaskByPath(p.milestones, taskPath),
          };
        }),
      },
      isDirty: true,
    });
  },

  undo: () => {
    const { undoStack, workingState, redoStack } = get();
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);

    set({
      workingState: previousState,
      undoStack: newUndoStack,
      redoStack: workingState ? [...redoStack, workingState] : redoStack,
      isDirty: true,
    });
  },

  redo: () => {
    const { redoStack, workingState, undoStack } = get();
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);

    set({
      workingState: nextState,
      redoStack: newRedoStack,
      undoStack: workingState ? [...undoStack, workingState] : undoStack,
      isDirty: true,
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  save: async () => {
    const { workingState } = get();
    if (!workingState) return;

    set({ isSaving: true });

    try {
      const response = await fetch('/api/state/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workingState),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      get().markSaved();
    } catch (error) {
      console.error('Save failed:', error);
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },

  markSaved: () => {
    const { workingState } = get();
    set({
      savedState: workingState ? deepClone(workingState) : null,
      isDirty: false,
      undoStack: [],
      redoStack: [],
    });
  },
}));

// Selector hooks for common use cases
export const useProjects = () => useAppStore((state) => state.workingState?.projects ?? []);
export const useProjectOrder = () => useAppStore((state) => state.workingState?.ui_state.project_order ?? []);
export const useIsDirty = () => useAppStore((state) => state.isDirty);
export const useIsSaving = () => useAppStore((state) => state.isSaving);

export const useProject = (id: string) =>
  useAppStore((state) => state.workingState?.projects.find((p) => p.id === id));

export const useOrderedProjects = () => {
  const projects = useProjects();
  const order = useProjectOrder();

  // Sort projects by order, unordered ones go to the end
  return [...projects].sort((a, b) => {
    const aIndex = order.indexOf(a.id);
    const bIndex = order.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
};
