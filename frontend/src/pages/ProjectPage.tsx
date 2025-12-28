import { useCallback, useState, useRef, useEffect, CSSProperties } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject, useAppStore } from '../store/useAppStore';
import {
  Task,
  StatusType,
  Status,
  STATUS_OPTIONS,
  validateWaitingFor,
  ValidationError,
  Schedule,
} from '../types';
import DurationPicker from '../components/DurationPicker';

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    paddingBottom: 'var(--spacing-xl)',
  },
  header: {
    marginBottom: 'var(--spacing-xl)',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    marginBottom: 'var(--spacing-md)',
    fontSize: 'var(--font-size-sm)',
  },
  title: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)',
  },
  description: {
    fontSize: 'var(--font-size-md)',
    color: 'var(--text-secondary)',
  },
  statsBar: {
    display: 'flex',
    gap: 'var(--spacing-lg)',
    padding: 'var(--spacing-md)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 'var(--spacing-lg)',
    fontSize: 'var(--font-size-sm)',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  statDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  },
  taskItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
    padding: 'var(--spacing-md)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-light)',
  },
  taskHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--spacing-md)',
  },
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginTop: '4px',
    flexShrink: 0,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 'var(--font-size-md)',
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-xs)',
    border: 'none',
    background: 'none',
    width: '100%',
    padding: 'var(--spacing-xs)',
    borderRadius: 'var(--radius-sm)',
  },
  taskTitleFocused: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-medium)',
  },
  taskMeta: {
    display: 'flex',
    gap: 'var(--spacing-md)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-muted)',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  statusSelect: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    cursor: 'pointer',
  },
  waitingForInput: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    width: '120px',
  },
  subtaskList: {
    marginTop: 'var(--spacing-sm)',
    marginInlineStart: 'var(--spacing-lg)',
    paddingInlineStart: 'var(--spacing-md)',
    borderInlineStart: '2px solid var(--border-light)',
  },
  emptyState: {
    textAlign: 'center',
    padding: 'var(--spacing-xl)',
    color: 'var(--text-muted)',
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 'var(--spacing-md)',
    marginTop: 'var(--spacing-md)',
    borderRadius: 'var(--radius-md)',
    border: '2px dashed var(--border-medium)',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  },
  notFound: {
    textAlign: 'center',
    padding: 'var(--spacing-xl)',
  },
  notFoundTitle: {
    fontSize: 'var(--font-size-xl)',
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)',
  },
  notFoundText: {
    color: 'var(--text-muted)',
    marginBottom: 'var(--spacing-md)',
  },
  deleteButton: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: 'var(--accent-danger)',
    border: 'none',
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'opacity var(--transition-fast)',
  },
  errorMessage: {
    color: 'var(--accent-danger)',
    fontSize: 'var(--font-size-sm)',
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: 'var(--radius-sm)',
    marginTop: 'var(--spacing-xs)',
  },
  expandSection: {
    marginTop: 'var(--spacing-sm)',
    paddingTop: 'var(--spacing-sm)',
    borderTop: '1px solid var(--border-light)',
  },
  detailsTextarea: {
    width: '100%',
    padding: 'var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-light)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    resize: 'vertical',
    minHeight: '60px',
    marginTop: 'var(--spacing-xs)',
  },
  peopleInput: {
    width: '100%',
    padding: 'var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-light)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    marginTop: 'var(--spacing-xs)',
  },
  fieldLabel: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-muted)',
    fontWeight: 500,
    marginTop: 'var(--spacing-sm)',
    display: 'block',
  },
  toggleButton: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 'var(--font-size-xs)',
    transition: 'all var(--transition-fast)',
  },
  peopleTag: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-secondary)',
    marginInlineEnd: 'var(--spacing-xs)',
  },
  scheduleInfo: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-muted)',
    marginTop: 'var(--spacing-xs)',
  },
};

const statusColors: Record<StatusType, string> = {
  not_started: 'var(--status-not-started)',
  in_progress: 'var(--status-in-progress)',
  stuck: 'var(--status-stuck)',
  done: 'var(--status-done)',
  waiting_for: 'var(--status-waiting)',
};

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// Helper to format date for display
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

// Count all tasks recursively
function countTasks(tasks: Task[]): { total: number; byStatus: Record<StatusType, number> } {
  let total = 0;
  const byStatus: Record<StatusType, number> = {
    not_started: 0,
    in_progress: 0,
    stuck: 0,
    done: 0,
    waiting_for: 0,
  };

  function countRecursive(taskList: Task[]) {
    for (const task of taskList) {
      total++;
      byStatus[task.status.type]++;
      if (task.subtasks && task.subtasks.length > 0) {
        countRecursive(task.subtasks);
      }
    }
  }

  countRecursive(tasks);
  return { total, byStatus };
}

interface TaskItemProps {
  task: Task;
  projectId: string;
  path: string[];
  depth?: number;
}

function TaskItem({ task, projectId, path, depth = 0 }: TaskItemProps) {
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const addTask = useAppStore((state) => state.addTask);

  const [titleFocused, setTitleFocused] = useState(false);
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [expanded, setExpanded] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Local state for inputs to prevent losing focus on every keystroke
  const [localTitle, setLocalTitle] = useState(task.title);
  const [localWaitingFor, setLocalWaitingFor] = useState(task.status.waiting_for || '');
  const [localDetails, setLocalDetails] = useState(task.details);
  const [localNotes, setLocalNotes] = useState(task.notes);
  const [localPeople, setLocalPeople] = useState(task.people.join(', '));

  // Sync local state when task prop changes (e.g., from undo/redo)
  useEffect(() => {
    setLocalTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    setLocalWaitingFor(task.status.waiting_for || '');
  }, [task.status.waiting_for]);

  useEffect(() => {
    setLocalDetails(task.details);
  }, [task.details]);

  useEffect(() => {
    setLocalNotes(task.notes);
  }, [task.notes]);

  useEffect(() => {
    setLocalPeople(task.people.join(', '));
  }, [task.people]);

  useEffect(() => {
    const error = validateWaitingFor(task.status);
    setValidationError(error);
  }, [task.status]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalTitle(e.target.value);
    },
    []
  );

  const handleTitleBlur = useCallback(() => {
    setTitleFocused(false);
    if (localTitle !== task.title) {
      updateTask(projectId, path, { title: localTitle });
    }
  }, [localTitle, task.title, projectId, path, updateTask]);

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newStatus: Status = {
        type: e.target.value as StatusType,
        waiting_for: e.target.value === 'waiting_for' ? task.status.waiting_for || '' : null,
      };
      updateTask(projectId, path, { status: newStatus });
    },
    [projectId, path, updateTask, task.status.waiting_for]
  );

  const handleWaitingForChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalWaitingFor(e.target.value);
    },
    []
  );

  const handleWaitingForBlur = useCallback(() => {
    if (localWaitingFor !== (task.status.waiting_for || '')) {
      const newStatus: Status = {
        type: 'waiting_for',
        waiting_for: localWaitingFor,
      };
      updateTask(projectId, path, { status: newStatus });
    }
  }, [localWaitingFor, task.status.waiting_for, projectId, path, updateTask]);

  const handleDetailsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalDetails(e.target.value);
    },
    []
  );

  const handleDetailsBlur = useCallback(() => {
    if (localDetails !== task.details) {
      updateTask(projectId, path, { details: localDetails });
    }
  }, [localDetails, task.details, projectId, path, updateTask]);

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalNotes(e.target.value);
    },
    []
  );

  const handleNotesBlur = useCallback(() => {
    if (localNotes !== task.notes) {
      updateTask(projectId, path, { notes: localNotes });
    }
  }, [localNotes, task.notes, projectId, path, updateTask]);

  const handlePeopleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalPeople(e.target.value);
    },
    []
  );

  const handlePeopleBlur = useCallback(() => {
    const people = localPeople.split(',').map(p => p.trim()).filter(p => p);
    const currentPeople = task.people.join(', ');
    if (localPeople !== currentPeople) {
      updateTask(projectId, path, { people });
    }
  }, [localPeople, task.people, projectId, path, updateTask]);

  const handleScheduleChange = useCallback((schedule: Schedule | null) => {
    updateTask(projectId, path, { schedule });
  }, [projectId, path, updateTask]);

  const handleDelete = useCallback(() => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק משימה זו?')) {
      deleteTask(projectId, path);
    }
  }, [projectId, path, deleteTask]);

  const handleAddSubtask = useCallback(() => {
    addTask(projectId, path);
  }, [projectId, path, addTask]);

  const statusColor = statusColors[task.status.type];

  return (
    <div>
      <div style={styles.taskItem}>
        <div style={styles.taskHeader}>
          <div
            style={{
              ...styles.statusDot,
              backgroundColor: statusColor,
            }}
            title={STATUS_OPTIONS.find((s) => s.value === task.status.type)?.label}
          />
          <div style={styles.taskContent}>
            <input
              ref={titleRef}
              type="text"
              value={localTitle}
              onChange={handleTitleChange}
              onFocus={() => setTitleFocused(true)}
              onBlur={handleTitleBlur}
              placeholder="כותרת המשימה..."
              style={{
                ...styles.taskTitle,
                ...(titleFocused ? styles.taskTitleFocused : {}),
              }}
            />
            <div style={styles.taskMeta}>
              <select
                value={task.status.type}
                onChange={handleStatusChange}
                style={styles.statusSelect}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {task.status.type === 'waiting_for' && (
                <input
                  type="text"
                  value={localWaitingFor}
                  onChange={handleWaitingForChange}
                  onBlur={handleWaitingForBlur}
                  placeholder="שם האדם..."
                  style={styles.waitingForInput}
                />
              )}

              {task.subtasks.length > 0 && (
                <span>{task.subtasks.length} תתי-משימות</span>
              )}

              {task.people && task.people.length > 0 && (
                <div>
                  {task.people.map((person, idx) => (
                    <span key={idx} style={styles.peopleTag}>{person}</span>
                  ))}
                </div>
              )}

              <button
                style={{ ...styles.toggleButton, marginInlineStart: 'auto' }}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'כווץ' : 'פרטים'}
              </button>
            </div>

            {/* Schedule info */}
            {task.schedule && (
              <div style={styles.scheduleInfo}>
                {task.schedule.mode === 'range' ? (
                  <>תזמון: {formatDate(task.schedule.start_iso)} - {formatDate(task.schedule.end_iso)}</>
                ) : (
                  <>תאריך: {formatDate(task.schedule.point_iso)}</>
                )}
              </div>
            )}

            {validationError && (
              <div style={styles.errorMessage}>{validationError.message}</div>
            )}

            {/* Expanded section */}
            {expanded && (
              <div style={styles.expandSection}>
                <label style={styles.fieldLabel}>משך זמן ותזמון</label>
                <DurationPicker
                  schedule={task.schedule}
                  onChange={handleScheduleChange}
                />

                <label style={styles.fieldLabel}>תיאור מפורט</label>
                <textarea
                  value={localDetails}
                  onChange={handleDetailsChange}
                  onBlur={handleDetailsBlur}
                  placeholder="הוסף תיאור מפורט..."
                  style={styles.detailsTextarea}
                />

                <label style={styles.fieldLabel}>אנשים (מופרדים בפסיק)</label>
                <input
                  type="text"
                  value={localPeople}
                  onChange={handlePeopleChange}
                  onBlur={handlePeopleBlur}
                  placeholder="למשל, יוסי, שרה, דוד"
                  style={styles.peopleInput}
                />

                <label style={styles.fieldLabel}>הערות</label>
                <textarea
                  value={localNotes}
                  onChange={handleNotesChange}
                  onBlur={handleNotesBlur}
                  placeholder="הוסף הערות..."
                  style={styles.detailsTextarea}
                />
              </div>
            )}
          </div>
          <button style={styles.deleteButton} onClick={handleDelete} title="מחק משימה">
            &times;
          </button>
        </div>
      </div>

      {task.subtasks.length > 0 && (
        <div style={styles.subtaskList}>
          {task.subtasks.map((subtask) => (
            <TaskItem
              key={subtask.id}
              task={subtask}
              projectId={projectId}
              path={[...path, subtask.id]}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {depth < 3 && (
        <button
          style={{
            ...styles.addButton,
            marginInlineStart: depth > 0 ? 'var(--spacing-lg)' : 0,
          }}
          onClick={handleAddSubtask}
        >
          + הוסף תת-משימה
        </button>
      )}
    </div>
  );
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProject(projectId ?? '');
  const addTask = useAppStore((state) => state.addTask);

  const handleAddTask = useCallback(() => {
    if (projectId) {
      addTask(projectId);
    }
  }, [projectId, addTask]);

  if (!project) {
    return (
      <div style={styles.container}>
        <div style={styles.notFound}>
          <h2 style={styles.notFoundTitle as CSSProperties}>הפרויקט לא נמצא</h2>
          <p style={styles.notFoundText as CSSProperties}>
            הפרויקט שחיפשת לא קיים.
          </p>
          <Link to="/" style={styles.backLink}>
            <BackIcon />
            חזרה לפרויקטים
          </Link>
        </div>
      </div>
    );
  }

  const taskStats = countTasks(project.milestones);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Link to="/" style={styles.backLink}>
          <BackIcon />
          חזרה לפרויקטים
        </Link>
        <h1 style={styles.title}>{project.title || 'פרויקט ללא שם'}</h1>
        {project.short_description && (
          <p style={styles.description}>{project.short_description}</p>
        )}
      </div>

      {/* Task statistics bar */}
      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <strong>{taskStats.total}</strong> משימות סה"כ
        </div>
        <div style={styles.statItem}>
          <span style={{ ...styles.statDot, backgroundColor: 'var(--status-done)' }} />
          <span>{taskStats.byStatus.done} הושלמו</span>
        </div>
        <div style={styles.statItem}>
          <span style={{ ...styles.statDot, backgroundColor: 'var(--status-in-progress)' }} />
          <span>{taskStats.byStatus.in_progress} בתהליך</span>
        </div>
        <div style={styles.statItem}>
          <span style={{ ...styles.statDot, backgroundColor: 'var(--status-stuck)' }} />
          <span>{taskStats.byStatus.stuck} תקועות</span>
        </div>
        {taskStats.byStatus.waiting_for > 0 && (
          <div style={styles.statItem}>
            <span style={{ ...styles.statDot, backgroundColor: 'var(--status-waiting)' }} />
            <span>{taskStats.byStatus.waiting_for} ממתינות</span>
          </div>
        )}
      </div>

      {project.milestones.length === 0 ? (
        <div style={styles.emptyState}>
          <p>אין משימות עדיין. הוסף את המשימה הראשונה שלך כדי להתחיל.</p>
        </div>
      ) : (
        <div style={styles.taskList}>
          {project.milestones.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              projectId={project.id}
              path={[task.id]}
            />
          ))}
        </div>
      )}

      <button style={styles.addButton} onClick={handleAddTask}>
        + הוסף משימה
      </button>
    </div>
  );
}
