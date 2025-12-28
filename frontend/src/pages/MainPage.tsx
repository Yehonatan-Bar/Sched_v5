import { useCallback, useState, useRef, CSSProperties } from 'react';
import { useAppStore, useOrderedProjects } from '../store/useAppStore';
import { useProjectLock } from '../hooks/useProjectLock';
import ProjectCard from '../components/ProjectCard';

function FolderIcon() {
  return (
    <svg
      style={{
        width: '64px',
        height: '64px',
        marginBottom: 'var(--spacing-md)',
        opacity: 0.5,
      }}
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
  const reorderProjects = useAppStore((state) => state.reorderProjects);

  // Lock state management
  const { lockProject, isProjectLocked } = useProjectLock();

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Focus state for keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Ref for the project list container
  const listRef = useRef<HTMLDivElement>(null);

  const handleAddProject = useCallback(() => {
    addProject();
  }, [addProject]);

  // Drag handlers
  const handleDragStart = useCallback(
    (index: number) => (e: React.DragEvent) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));

      // Create a custom drag image (optional)
      const target = e.currentTarget as HTMLElement;
      if (target) {
        e.dataTransfer.setDragImage(target, target.offsetWidth / 2, 20);
      }
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    },
    []
  );

  const handleDrop = useCallback(
    (dropIndex: number) => (e: React.DragEvent) => {
      e.preventDefault();

      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }

      // Calculate new order
      const newOrder = projects.map((p) => p.id);
      const [movedId] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(dropIndex, 0, movedId);

      reorderProjects(newOrder);

      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, projects, reorderProjects]
  );

  // Keyboard navigation handlers
  const handleKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent) => {
      const key = e.key;

      if (key === 'ArrowUp' || key === 'ArrowDown') {
        e.preventDefault();

        const newIndex = key === 'ArrowUp' ? index - 1 : index + 1;

        // Check bounds
        if (newIndex < 0 || newIndex >= projects.length) return;

        // If Ctrl/Cmd is pressed, move the item
        if (e.ctrlKey || e.metaKey) {
          const newOrder = projects.map((p) => p.id);
          const [movedId] = newOrder.splice(index, 1);
          newOrder.splice(newIndex, 0, movedId);
          reorderProjects(newOrder);
          setFocusedIndex(newIndex);

          // Focus the moved card after reorder
          setTimeout(() => {
            const cards = listRef.current?.querySelectorAll('[data-project-id]');
            if (cards && cards[newIndex]) {
              (cards[newIndex] as HTMLElement).focus();
            }
          }, 0);
        } else {
          // Just move focus
          setFocusedIndex(newIndex);
          const cards = listRef.current?.querySelectorAll('[data-project-id]');
          if (cards && cards[newIndex]) {
            (cards[newIndex] as HTMLElement).focus();
          }
        }
      }

      // Enter to lock
      if (key === 'Enter') {
        lockProject(projects[index].id);
      }
    },
    [projects, reorderProjects, lockProject]
  );

  const handleFocus = useCallback(
    (index: number) => () => {
      setFocusedIndex(index);
    },
    []
  );

  const handleBlur = useCallback(() => {
    // Delay clearing focus to handle focus moving between cards
    setTimeout(() => {
      const activeElement = document.activeElement;
      if (!listRef.current?.contains(activeElement)) {
        setFocusedIndex(null);
      }
    }, 0);
  }, []);

  // Styles
  const containerStyle: CSSProperties = {
    maxWidth: '800px',
    margin: '0 auto',
    paddingBottom: '100px', // Space for floating button
  };

  const headerStyle: CSSProperties = {
    marginBottom: 'var(--spacing-xl)',
  };

  const titleStyle: CSSProperties = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)',
  };

  const subtitleStyle: CSSProperties = {
    fontSize: 'var(--font-size-md)',
    color: 'var(--text-secondary)',
  };

  const projectListStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-md)',
  };

  const emptyStateStyle: CSSProperties = {
    textAlign: 'center',
    padding: 'var(--spacing-xl)',
    color: 'var(--text-muted)',
  };

  const emptyTextStyle: CSSProperties = {
    fontSize: 'var(--font-size-lg)',
    marginBottom: 'var(--spacing-sm)',
  };

  const emptySubtextStyle: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
  };

  const addButtonStyle: CSSProperties = {
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
    zIndex: 100,
  };

  const keyboardHintStyle: CSSProperties = {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-muted)',
    marginTop: 'var(--spacing-md)',
    textAlign: 'center',
  };

  const dropIndicatorStyle: CSSProperties = {
    height: '4px',
    backgroundColor: 'var(--accent-primary)',
    borderRadius: 'var(--radius-full)',
    margin: '4px 0',
    transition: 'opacity var(--transition-fast)',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>פרויקטים_v5</h1>
        <p style={subtitleStyle}>
          {projects.length === 0
            ? 'התחל ביצירת הפרויקט הראשון שלך'
            : `${projects.length} פרויקטים`}
        </p>
      </div>

      {projects.length === 0 ? (
        <div style={emptyStateStyle}>
          <FolderIcon />
          <p style={emptyTextStyle}>אין פרויקטים עדיין</p>
          <p style={emptySubtextStyle}>
            לחץ על כפתור + למטה כדי ליצור את הפרויקט הראשון שלך
          </p>
        </div>
      ) : (
        <>
          <div
            ref={listRef}
            style={projectListStyle}
            role="list"
            aria-label="רשימת פרויקטים"
          >
            {projects.map((project, index) => (
              <div key={project.id}>
                {/* Drop indicator above */}
                {dragOverIndex === index && draggedIndex !== null && draggedIndex > index && (
                  <div style={dropIndicatorStyle} />
                )}

                <ProjectCard
                  project={project}
                  index={index}
                  totalCount={projects.length}
                  isLocked={isProjectLocked(project.id)}
                  onLock={() => lockProject(project.id)}
                  isDragging={draggedIndex === index}
                  onDragStart={handleDragStart(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  isFocused={focusedIndex === index}
                  onFocus={handleFocus(index)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown(index)}
                />

                {/* Drop indicator below */}
                {dragOverIndex === index && draggedIndex !== null && draggedIndex < index && (
                  <div style={dropIndicatorStyle} />
                )}
              </div>
            ))}
          </div>

          <p style={keyboardHintStyle}>
            טיפ: השתמש בחיצי המקלדת לניווט, Ctrl+חץ לסידור מחדש
          </p>
        </>
      )}

      <button
        style={addButtonStyle}
        onClick={handleAddProject}
        aria-label="הוסף פרויקט חדש"
        title="הוסף פרויקט חדש"
      >
        +
      </button>
    </div>
  );
}
