import { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject, useAppStore } from '../store/useAppStore';
import { Task, StatusType } from '../types';

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  } as const,
  header: {
    marginBottom: 'var(--spacing-xl)',
  } as const,
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    marginBottom: 'var(--spacing-md)',
    fontSize: 'var(--font-size-sm)',
  } as const,
  title: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)',
  } as const,
  description: {
    fontSize: 'var(--font-size-md)',
    color: 'var(--text-secondary)',
  } as const,
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  } as const,
  taskItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--spacing-md)',
    padding: 'var(--spacing-md)',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-light)',
  } as const,
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginTop: '4px',
    flexShrink: 0,
  } as const,
  taskContent: {
    flex: 1,
  } as const,
  taskTitle: {
    fontSize: 'var(--font-size-md)',
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-xs)',
    border: 'none',
    background: 'none',
    width: '100%',
    padding: 0,
  } as const,
  taskMeta: {
    display: 'flex',
    gap: 'var(--spacing-md)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-muted)',
  } as const,
  subtaskList: {
    marginTop: 'var(--spacing-sm)',
    marginInlineStart: 'var(--spacing-lg)',
    paddingInlineStart: 'var(--spacing-md)',
    borderInlineStart: '2px solid var(--border-light)',
  } as const,
  emptyState: {
    textAlign: 'center',
    padding: 'var(--spacing-xl)',
    color: 'var(--text-muted)',
  } as const,
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
  } as const,
  notFound: {
    textAlign: 'center',
    padding: 'var(--spacing-xl)',
  } as const,
  notFoundTitle: {
    fontSize: 'var(--font-size-xl)',
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)',
  } as const,
  notFoundText: {
    color: 'var(--text-muted)',
    marginBottom: 'var(--spacing-md)',
  } as const,
  deleteButton: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'transparent',
    color: 'var(--accent-danger)',
    border: 'none',
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'opacity var(--transition-fast)',
  } as const,
};

const statusColors: Record<StatusType, string> = {
  not_started: 'var(--status-not-started)',
  in_progress: 'var(--status-in-progress)',
  stuck: 'var(--status-stuck)',
  done: 'var(--status-done)',
  waiting_for: 'var(--status-waiting)',
};

const statusLabels: Record<StatusType, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  stuck: 'Stuck',
  done: 'Done',
  waiting_for: 'Waiting',
};

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
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

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateTask(projectId, path, { title: e.target.value });
    },
    [projectId, path, updateTask]
  );

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      deleteTask(projectId, path);
    }
  }, [projectId, path, deleteTask]);

  const handleAddSubtask = useCallback(() => {
    addTask(projectId, path);
  }, [projectId, path, addTask]);

  const statusColor = statusColors[task.status.type];
  const statusLabel = statusLabels[task.status.type];

  return (
    <div>
      <div style={styles.taskItem}>
        <div
          style={{
            ...styles.statusDot,
            backgroundColor: statusColor,
          }}
          title={statusLabel}
        />
        <div style={styles.taskContent}>
          <input
            type="text"
            value={task.title}
            onChange={handleTitleChange}
            placeholder="Task title..."
            style={styles.taskTitle}
          />
          <div style={styles.taskMeta}>
            <span>{statusLabel}</span>
            {task.status.waiting_for && <span>({task.status.waiting_for})</span>}
            {task.subtasks.length > 0 && (
              <span>{task.subtasks.length} subtasks</span>
            )}
          </div>
        </div>
        <button style={styles.deleteButton} onClick={handleDelete} title="Delete task">
          x
        </button>
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
          + Add subtask
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
          <h2 style={styles.notFoundTitle}>Project not found</h2>
          <p style={styles.notFoundText}>
            The project you're looking for doesn't exist.
          </p>
          <Link to="/" style={styles.backLink}>
            <BackIcon />
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Link to="/" style={styles.backLink}>
          <BackIcon />
          Back to projects
        </Link>
        <h1 style={styles.title}>{project.title || 'Untitled Project'}</h1>
        {project.short_description && (
          <p style={styles.description}>{project.short_description}</p>
        )}
      </div>

      {project.milestones.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No tasks yet. Add your first task to get started.</p>
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
        + Add task
      </button>
    </div>
  );
}
