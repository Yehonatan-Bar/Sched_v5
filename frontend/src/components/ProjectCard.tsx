import { useCallback, useState, useRef, useEffect, CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Project, Schedule } from '../types';
import { useAppStore } from '../store/useAppStore';
import Timeline, { ZoomLevel } from './Timeline';
import Modal from './Modal';

const ZOOM_LEVELS: ZoomLevel[] = ['months', 'weeks', 'days', 'hours', 'minutes'];

// Constants for visual effects
const MIN_OPACITY = 0.35;
const MIN_SCALE = 0.85;
const EFFECT_DECAY_RATE = 0.08; // How much each index reduces opacity/scale

interface ProjectCardProps {
  project: Project;
  index: number;
  totalCount: number;
  isLocked: boolean;
  onLock: () => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isFocused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

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

function DragHandleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="5" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="19" r="1" fill="currentColor" />
      <circle cx="15" cy="5" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

function DescriptionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function NotebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export default function ProjectCard({
  project,
  index,
  totalCount: _totalCount,
  isLocked,
  onLock,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isFocused,
  onFocus,
  onBlur,
  onKeyDown,
}: ProjectCardProps) {
  const updateProject = useAppStore((state) => state.updateProject);
  const deleteProject = useAppStore((state) => state.deleteProject);
  const updateTask = useAppStore((state) => state.updateTask);

  // Handler for timeline schedule updates
  const handleTaskScheduleUpdate = useCallback(
    (taskId: string, schedule: Schedule) => {
      updateTask(project.id, [taskId], { schedule });
    },
    [project.id, updateTask]
  );

  // Handler for timeline task updates (details, people, notes)
  const handleTaskUpdate = useCallback(
    (taskId: string, updates: Partial<import('../types').Task>) => {
      updateTask(project.id, [taskId], updates);
    },
    [project.id, updateTask]
  );

  const [titleFocused, setTitleFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouched, setIsTouched] = useState(false);

  // Local state for inputs to prevent losing focus on every keystroke
  const [localTitle, setLocalTitle] = useState(project.title);
  const [localDescription, setLocalDescription] = useState(project.short_description);
  const [localDetailedDescription, setLocalDetailedDescription] = useState(project.detailed_description);
  const [localNotebook, setLocalNotebook] = useState(project.notebook);

  // Sync local state when project prop changes (e.g., from undo/redo)
  useEffect(() => {
    setLocalTitle(project.title);
  }, [project.title]);

  useEffect(() => {
    setLocalDescription(project.short_description);
  }, [project.short_description]);

  useEffect(() => {
    setLocalDetailedDescription(project.detailed_description);
  }, [project.detailed_description]);

  useEffect(() => {
    setLocalNotebook(project.notebook);
  }, [project.notebook]);

  // Modal states
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showNotebookModal, setShowNotebookModal] = useState(false);

  // Zoom state for timeline
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('weeks');

  const handleZoomIn = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      setZoomLevel(ZOOM_LEVELS[currentIndex + 1]);
    }
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      setZoomLevel(ZOOM_LEVELS[currentIndex - 1]);
    }
  }, [zoomLevel]);

  const cardRef = useRef<HTMLDivElement>(null);
  const touchTimeoutRef = useRef<number | null>(null);

  // Clear touch timeout on unmount
  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, []);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalTitle(e.target.value);
    },
    []
  );

  const handleTitleBlur = useCallback(() => {
    setTitleFocused(false);
    if (localTitle !== project.title) {
      updateProject(project.id, { title: localTitle });
    }
  }, [localTitle, project.title, project.id, updateProject]);

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalDescription(e.target.value);
    },
    []
  );

  const handleDescriptionBlur = useCallback(() => {
    setDescFocused(false);
    if (localDescription !== project.short_description) {
      updateProject(project.id, { short_description: localDescription });
    }
  }, [localDescription, project.short_description, project.id, updateProject]);

  const handleDelete = useCallback(() => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק פרויקט זה?')) {
      deleteProject(project.id);
    }
  }, [project.id, deleteProject]);

  const handleDetailedDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalDetailedDescription(e.target.value);
    },
    []
  );

  const handleDetailedDescriptionBlur = useCallback(() => {
    if (localDetailedDescription !== project.detailed_description) {
      updateProject(project.id, { detailed_description: localDetailedDescription });
    }
  }, [localDetailedDescription, project.detailed_description, project.id, updateProject]);

  const handleNotebookChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalNotebook(e.target.value);
    },
    []
  );

  const handleNotebookBlur = useCallback(() => {
    if (localNotebook !== project.notebook) {
      updateProject(project.id, { notebook: localNotebook });
    }
  }, [localNotebook, project.notebook, project.id, updateProject]);

  // Calculate visual effects based on index
  // Items lower in the list become more transparent and smaller
  const calculateEffects = useCallback(() => {
    // If locked, hovered, touched, or focused, show at full size/opacity
    if (isLocked || isHovered || isTouched || isFocused) {
      return { opacity: 1, scale: 1 };
    }

    // Calculate decay based on position
    const decay = index * EFFECT_DECAY_RATE;
    const opacity = Math.max(MIN_OPACITY, 1 - decay);
    const scale = Math.max(MIN_SCALE, 1 - decay * 0.5);

    return { opacity, scale };
  }, [index, isLocked, isHovered, isTouched, isFocused]);

  const { opacity, scale } = calculateEffects();

  // Handle card click to lock
  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't lock if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a')
      ) {
        return;
      }
      onLock();
    },
    [onLock]
  );

  // Mobile touch handlers
  const handleTouchStart = useCallback(() => {
    // Clear any existing timeout
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
    }
    setIsTouched(true);
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Keep touched state for a brief moment, then clear
    touchTimeoutRef.current = window.setTimeout(() => {
      setIsTouched(false);
    }, 300);
  }, []);

  const milestonesCount = project.milestones.length;
  const completedCount = project.milestones.filter((m) => m.status.type === 'done').length;

  // Dynamic styles
  const cardStyle: CSSProperties = {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: `2px solid ${isFocused ? 'var(--accent-primary)' : isLocked ? 'var(--accent-success)' : 'var(--border-light)'}`,
    padding: 'var(--spacing-lg)',
    transition: 'all var(--transition-normal)',
    cursor: isDragging ? 'grabbing' : 'pointer',
    opacity: isDragging ? 0.5 : opacity,
    transform: `scale(${isDragging ? 0.98 : scale})`,
    transformOrigin: 'center center',
    position: 'relative',
    outline: 'none',
    // Allow vertical scroll on touch devices, prevent horizontal scroll
    touchAction: 'pan-y',
    // GPU acceleration for smooth animations
    willChange: isDragging ? 'transform, opacity' : 'auto',
  };

  const dragHandleStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px', // Touch-friendly size
    height: '44px', // Touch-friendly size
    borderRadius: 'var(--radius-md)',
    backgroundColor: isDragging ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
    color: isDragging ? 'var(--text-inverse)' : 'var(--text-secondary)',
    border: '2px dashed',
    borderColor: isDragging ? 'var(--accent-primary)' : 'var(--border-medium)',
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: 'all var(--transition-fast)',
    flexShrink: 0,
    // Touch-friendly: prevent accidental scroll while dragging
    touchAction: 'none',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--spacing-sm)',
    marginBottom: 'var(--spacing-md)',
  };

  const titleSectionStyle: CSSProperties = {
    flex: 1,
  };

  const titleStyle: CSSProperties = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-xs)',
    border: 'none',
    background: titleFocused ? 'var(--bg-primary)' : 'none',
    width: '100%',
    padding: 'var(--spacing-xs)',
    borderRadius: 'var(--radius-sm)',
    ...(titleFocused && {
      border: '1px solid var(--border-medium)',
    }),
  };

  const descriptionStyle: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
    border: 'none',
    background: descFocused ? 'var(--bg-primary)' : 'none',
    width: '100%',
    padding: 'var(--spacing-xs)',
    borderRadius: 'var(--radius-sm)',
    resize: 'none',
    ...(descFocused && {
      border: '1px solid var(--border-medium)',
    }),
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  };

  const actionsRowStyle: CSSProperties = {
    display: 'flex',
    gap: 'var(--spacing-sm)',
  };

  const iconButtonStyle: CSSProperties = {
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
  };

  const deleteButtonStyle: CSSProperties = {
    ...iconButtonStyle,
    backgroundColor: 'transparent',
    color: 'var(--accent-danger)',
    border: '1px solid var(--accent-danger)',
  };

  const footerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'var(--spacing-md)',
    paddingTop: 'var(--spacing-md)',
    borderTop: '1px solid var(--border-light)',
  };

  const statsStyle: CSSProperties = {
    display: 'flex',
    gap: 'var(--spacing-lg)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-muted)',
  };

  const lockIndicatorStyle: CSSProperties = {
    position: 'absolute',
    top: 'var(--spacing-sm)',
    left: 'var(--spacing-sm)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--accent-success)',
    opacity: isLocked ? 1 : 0,
    transition: 'opacity var(--transition-fast)',
  };

  return (
    <div
      ref={cardRef}
      style={cardStyle}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="listitem"
      aria-label={`פרויקט: ${project.title || 'ללא שם'}`}
      data-project-id={project.id}
    >
      {/* Lock indicator */}
      <span style={lockIndicatorStyle} aria-hidden={!isLocked}>
        🔒
      </span>

      <div style={headerStyle}>
        {/* Drag handle - larger touch target for mobile */}
        <div
          style={dragHandleStyle}
          title="גרור לסידור מחדש (או השתמש ב-Ctrl+חצים)"
          aria-label={`ידית גרירה עבור ${project.title || 'פרויקט ללא שם'}. גרור לסידור מחדש או השתמש ב-Ctrl+חצים.`}
          role="button"
          aria-grabbed={isDragging}
          tabIndex={-1}
        >
          <DragHandleIcon />
          {isDragging && (
            <span
              style={{
                position: 'absolute',
                bottom: '-20px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--accent-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              גורר...
            </span>
          )}
        </div>

        <div style={titleSectionStyle}>
          <input
            type="text"
            value={localTitle}
            onChange={handleTitleChange}
            onFocus={() => setTitleFocused(true)}
            onBlur={handleTitleBlur}
            placeholder="שם הפרויקט..."
            style={titleStyle}
            onClick={(e) => e.stopPropagation()}
          />
          <textarea
            value={localDescription}
            onChange={handleDescriptionChange}
            onFocus={() => setDescFocused(true)}
            onBlur={handleDescriptionBlur}
            placeholder="תיאור קצר..."
            style={descriptionStyle}
            rows={2}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div style={actionsStyle}>
          <div style={actionsRowStyle}>
            <button
              style={deleteButtonStyle}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              title="מחק פרויקט"
            >
              <TrashIcon />
            </button>
            <Link
              to={`/project/${project.id}`}
              style={iconButtonStyle}
              title="פתח פרויקט"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowIcon />
            </Link>
            <button
              style={iconButtonStyle}
              onClick={(e) => {
                e.stopPropagation();
                setShowNotebookModal(true);
              }}
              title="פתח פנקס טיוטות"
            >
              <NotebookIcon />
            </button>
            <button
              style={iconButtonStyle}
              onClick={(e) => {
                e.stopPropagation();
                setShowDescriptionModal(true);
              }}
              title="הצג תיאור מפורט"
            >
              <DescriptionIcon />
            </button>
          </div>
          {/* Zoom controls - positioned under action buttons */}
          {project.time_range && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
            }}>
              <button
                onClick={handleZoomIn}
                disabled={ZOOM_LEVELS.indexOf(zoomLevel) === ZOOM_LEVELS.length - 1}
                title="התקרב"
                aria-label="התקרב"
                style={{
                  width: '28px',
                  height: '28px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: ZOOM_LEVELS.indexOf(zoomLevel) === ZOOM_LEVELS.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: ZOOM_LEVELS.indexOf(zoomLevel) === ZOOM_LEVELS.length - 1 ? 0.4 : 1,
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 600,
                }}
              >
                +
              </button>
              <span style={{
                minWidth: '50px',
                textAlign: 'center',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--text-secondary)',
              }}>
                {zoomLevel}
              </span>
              <button
                onClick={handleZoomOut}
                disabled={ZOOM_LEVELS.indexOf(zoomLevel) === 0}
                title="התרחק"
                aria-label="התרחק"
                style={{
                  width: '28px',
                  height: '28px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: ZOOM_LEVELS.indexOf(zoomLevel) === 0 ? 'not-allowed' : 'pointer',
                  opacity: ZOOM_LEVELS.indexOf(zoomLevel) === 0 ? 0.4 : 1,
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 600,
                }}
              >
                −
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timeline - only show if project has time_range */}
      {project.time_range && (
        <Timeline
          timeRange={project.time_range}
          tasks={project.milestones}
          isLocked={isLocked}
          onTaskScheduleUpdate={handleTaskScheduleUpdate}
          onTaskUpdate={handleTaskUpdate}
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
        />
      )}

      <div style={footerStyle}>
        <div style={statsStyle}>
          <span>{milestonesCount} משימות</span>
          <span>{completedCount} הושלמו</span>
        </div>
      </div>

      {/* Description Modal */}
      <Modal
        isOpen={showDescriptionModal}
        onClose={() => setShowDescriptionModal(false)}
        title="תיאור מפורט"
        size="lg"
      >
        <textarea
          value={localDetailedDescription}
          onChange={handleDetailedDescriptionChange}
          onBlur={handleDetailedDescriptionBlur}
          placeholder="הוסף תיאור מפורט לפרויקט זה..."
          style={{
            width: '100%',
            minHeight: '300px',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-md)',
            resize: 'vertical',
            lineHeight: 1.6,
          }}
        />
      </Modal>

      {/* Notebook Modal */}
      <Modal
        isOpen={showNotebookModal}
        onClose={() => setShowNotebookModal(false)}
        title="פנקס טיוטות"
        size="lg"
      >
        <textarea
          value={localNotebook}
          onChange={handleNotebookChange}
          onBlur={handleNotebookBlur}
          placeholder="השתמש בשטח זה להערות, טיוטות ורעיונות..."
          style={{
            width: '100%',
            minHeight: '400px',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-medium)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-md)',
            resize: 'vertical',
            lineHeight: 1.6,
            fontFamily: 'inherit',
          }}
        />
      </Modal>
    </div>
  );
}
