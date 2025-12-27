import { useCallback } from 'react';
import { useAppStore, useOrderedProjects } from '../store/useAppStore';
import ProjectCard from '../components/ProjectCard';

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  } as const,
  header: {
    marginBottom: 'var(--spacing-xl)',
  } as const,
  title: {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)',
  } as const,
  subtitle: {
    fontSize: 'var(--font-size-md)',
    color: 'var(--text-secondary)',
  } as const,
  projectList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)',
  } as const,
  emptyState: {
    textAlign: 'center',
    padding: 'var(--spacing-xl)',
    color: 'var(--text-muted)',
  } as const,
  emptyIcon: {
    width: '64px',
    height: '64px',
    marginBottom: 'var(--spacing-md)',
    opacity: 0.5,
  } as const,
  emptyText: {
    fontSize: 'var(--font-size-lg)',
    marginBottom: 'var(--spacing-sm)',
  } as const,
  emptySubtext: {
    fontSize: 'var(--font-size-sm)',
  } as const,
  addButton: {
    position: 'fixed',
    bottom: 'var(--spacing-xl)',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    border: 'none',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-lg)',
    transition: 'all var(--transition-fast)',
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 300,
  } as const,
};

function FolderIcon() {
  return (
    <svg
      style={styles.emptyIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function MainPage() {
  const projects = useOrderedProjects();
  const addProject = useAppStore((state) => state.addProject);

  const handleAddProject = useCallback(() => {
    addProject();
  }, [addProject]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Projects</h1>
        <p style={styles.subtitle}>
          {projects.length === 0
            ? 'Get started by creating your first project'
            : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {projects.length === 0 ? (
        <div style={styles.emptyState}>
          <FolderIcon />
          <p style={styles.emptyText}>No projects yet</p>
          <p style={styles.emptySubtext}>
            Click the + button below to create your first project
          </p>
        </div>
      ) : (
        <div style={styles.projectList}>
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      )}

      <button
        style={styles.addButton}
        onClick={handleAddProject}
        aria-label="Add new project"
        title="Add new project"
      >
        +
      </button>
    </div>
  );
}
