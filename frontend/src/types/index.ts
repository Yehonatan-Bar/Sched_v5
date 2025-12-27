// Status types
export type StatusType = 'not_started' | 'in_progress' | 'stuck' | 'done' | 'waiting_for';

export interface Status {
  type: StatusType;
  waiting_for: string | null;
}

// Schedule types
export type ScheduleMode = 'range' | 'point';

export interface ScheduleRange {
  mode: 'range';
  start_iso: string;
  end_iso: string;
}

export interface SchedulePoint {
  mode: 'point';
  point_iso: string;
}

export type Schedule = ScheduleRange | SchedulePoint;

// Task (Milestone / Subtask) - recursive structure
export interface Task {
  id: string;
  title: string;
  details: string;
  status: Status;
  priority: number;
  tags: string[];
  color: string;
  schedule: Schedule | null;
  people: string[];
  notes: string;
  subtasks: Task[];
}

// Time range for project
export interface TimeRange {
  start_iso: string;
  end_iso: string;
  is_user_defined: boolean;
}

// Project
export interface Project {
  id: string;
  title: string;
  short_description: string;
  detailed_description: string;
  notebook: string;
  tags: string[];
  color: string;
  time_range: TimeRange;
  milestones: Task[];
}

// Backup entry
export interface Backup {
  id: string;
  created_at_iso: string;
  reason: string;
  file_path: string;
}

// App settings
export interface AppSettings {
  timezone: string;
  date_format: string;
  rtl: boolean;
  theme: 'light' | 'dark' | 'system';
}

// UI state - locked projects tracking
export interface LockedProject {
  locked_until_epoch_ms: number;
}

// Undo entry
export interface UndoEntry {
  timestamp: number;
  data: AppData;
}

export interface UIState {
  project_order: string[];
  locked_projects: Record<string, LockedProject>;
  undo: {
    stack: UndoEntry[];
    redo_stack: UndoEntry[];
  };
}

// Full app data structure (matches JSON schema)
export interface AppData {
  schema_version: number;
  app: AppSettings;
  ui_state: UIState;
  projects: Project[];
  backups: Backup[];
}

// Default values
export const createDefaultStatus = (): Status => ({
  type: 'not_started',
  waiting_for: null,
});

export const createDefaultTimeRange = (): TimeRange => {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1);

  return {
    start_iso: now.toISOString(),
    end_iso: endDate.toISOString(),
    is_user_defined: false,
  };
};

export const createDefaultTask = (id: string): Task => ({
  id,
  title: '',
  details: '',
  status: createDefaultStatus(),
  priority: 1,
  tags: [],
  color: 'auto',
  schedule: null,
  people: [],
  notes: '',
  subtasks: [],
});

export const createDefaultProject = (id: string): Project => ({
  id,
  title: '',
  short_description: '',
  detailed_description: '',
  notebook: '',
  tags: [],
  color: 'auto',
  time_range: createDefaultTimeRange(),
  milestones: [],
});

export const createDefaultAppData = (): AppData => ({
  schema_version: 1,
  app: {
    timezone: 'Asia/Jerusalem',
    date_format: 'DD/MM/YY',
    rtl: true,
    theme: 'system',
  },
  ui_state: {
    project_order: [],
    locked_projects: {},
    undo: {
      stack: [],
      redo_stack: [],
    },
  },
  projects: [],
  backups: [],
});
