import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../types';
import { useAppStore } from '../store/useAppStore';

const styles = {
  card: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-light)',
    padding: 'var(--spacing-lg)',
    transition: 'all var(--transition-fast)',
    cursor: 'pointer',
  } as const,
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-md)',
  } as const,
  titleSection: {
    flex: 1,
  } as const,
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-xs)',
    border: 'none',
    background: 'none',
    width: '100%',
    padding: 'var(--spacing-xs)',
    borderRadius: 'var(--radius-sm)',
  } as const,
  titleEditable: {
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-medium)',
  } as const,
  description: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
    border: 'none',
    background: 'none',
    width: '100%',
    padding: 'var(--spacing-xs)',
    borderRadius: 'var(--radius-sm)',
    resize: 'none',
  } as const,
  actions: {
    display: 'flex',
    gap: 'var(--spacing-sm)',
  } as const,
  iconButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    textDecoration: 'none',
  } as const,
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'var(--spacing-md)',
    paddingTop: 'var(--spacing-md)',
    borderTop: '1px solid var(--border-light)',
  } as const,
  stats: {
    display: 'flex',
    gap: 'var(--spacing-lg)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-muted)',
  } as const,
  deleteButton: {
    backgroundColor: 'transparent',
    color: 'var(--accent-danger)',
    border: '1px solid var(--accent-danger)',
  } as const,
};

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

interface ProjectCardProps {
  project: Project;
  index: number;
}

export default function ProjectCard({ project, index }: ProjectCardProps) {
  const updateProject = useAppStore((state) => state.updateProject);
  const deleteProject = useAppStore((state) => state.deleteProject);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateProject(project.id, { title: e.target.value });
    },
    [project.id, updateProject]
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateProject(project.id, { short_description: e.target.value });
    },
    [project.id, updateProject]
  );

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      deleteProject(project.id);
    }
  }, [project.id, deleteProject]);

  // Calculate opacity based on index (items further down are more transparent)
  const opacity = Math.max(0.4, 1 - index * 0.1);

  const milestonesCount = project.milestones.length;
  const completedCount = project.milestones.filter((m) => m.status.type === 'done').length;

  return (
    <div
      style={{
        ...styles.card,
        opacity,
      }}
    >
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <input
            type="text"
            value={project.title}
            onChange={handleTitleChange}
            placeholder="Project name..."
            style={styles.title}
            onClick={(e) => e.stopPropagation()}
          />
          <textarea
            value={project.short_description}
            onChange={handleDescriptionChange}
            placeholder="Short description..."
            style={styles.description}
            rows={2}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div style={styles.actions}>
          <Link
            to={`/project/${project.id}`}
            style={styles.iconButton}
            title="Open project"
          >
            <ArrowIcon />
          </Link>
          <button
            style={{ ...styles.iconButton, ...styles.deleteButton }}
            onClick={handleDelete}
            title="Delete project"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div style={styles.footer}>
        <div style={styles.stats}>
          <span>{milestonesCount} tasks</span>
          <span>{completedCount} completed</span>
        </div>
      </div>
    </div>
  );
}
