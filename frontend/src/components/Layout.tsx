import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore, useIsDirty, useIsSaving } from '../store/useAppStore';
import ThemeToggle from './ThemeToggle';

// Conflict detection polling interval (check every 30 seconds)
const CONFLICT_CHECK_INTERVAL = 30000;

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  } as const,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--spacing-md) var(--spacing-lg)',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-light)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  } as const,
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
  } as const,
  logoText: {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textDecoration: 'none',
  } as const,
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
  } as const,
  saveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--accent-primary)',
    color: 'var(--text-inverse)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    border: 'none',
  } as const,
  saveButtonDisabled: {
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
  } as const,
  dirtyIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-warning)',
  } as const,
  undoRedoButtons: {
    display: 'flex',
    gap: 'var(--spacing-xs)',
  } as const,
  undoRedoButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  } as const,
  undoRedoButtonDisabled: {
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
    opacity: 0.5,
  } as const,
  main: {
    flex: 1,
    padding: 'var(--spacing-lg)',
  } as const,
  conflictBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--spacing-sm) var(--spacing-lg)',
    backgroundColor: 'var(--accent-warning)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)',
    gap: 'var(--spacing-md)',
  } as const,
  conflictButton: {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: 'none',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
  } as const,
  dirtyBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--accent-warning)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 500,
    animation: 'pulse 2s ease-in-out infinite',
  } as const,
};

function UndoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </svg>
  );
}

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const isDirty = useIsDirty();
  const isSaving = useIsSaving();
  const { save, undo, redo, canUndo, canRedo, savedState, loadState } = useAppStore();

  // Conflict detection state
  const [hasConflict, setHasConflict] = useState(false);
  const [serverSchemaVersion, setServerSchemaVersion] = useState<number | null>(null);

  // Check for conflicts (another tab saved changes)
  useEffect(() => {
    if (!savedState) return;

    const checkForConflicts = async () => {
      try {
        const response = await fetch('/api/state');
        if (response.ok) {
          const serverState = await response.json();
          // Compare schema_version to detect external changes
          if (serverSchemaVersion !== null && serverState.schema_version !== serverSchemaVersion) {
            setHasConflict(true);
          }
          setServerSchemaVersion(serverState.schema_version);
        }
      } catch (error) {
        // Network error - don't show conflict
        console.error('Failed to check for conflicts:', error);
      }
    };

    // Initial check
    checkForConflicts();

    // Periodic check
    const interval = setInterval(checkForConflicts, CONFLICT_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [savedState, serverSchemaVersion]);

  // Handle reload from server
  const handleReloadFromServer = useCallback(async () => {
    try {
      const response = await fetch('/api/state');
      if (response.ok) {
        const serverState = await response.json();
        loadState(serverState);
        setHasConflict(false);
        setServerSchemaVersion(serverState.schema_version);
      }
    } catch (error) {
      console.error('Failed to reload from server:', error);
    }
  }, [loadState]);

  // Dismiss conflict warning
  const handleDismissConflict = useCallback(() => {
    setHasConflict(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving) return;
    try {
      await save();
      setHasConflict(false); // Clear conflict on successful save
    } catch (error) {
      console.error('Failed to save:', error);
      // In a real app, show a toast notification
    }
  }, [isDirty, isSaving, save]);

  const handleUndo = useCallback(() => {
    if (canUndo()) undo();
  }, [canUndo, undo]);

  const handleRedo = useCallback(() => {
    if (canRedo()) redo();
  }, [canRedo, redo]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    },
    [handleSave, handleUndo, handleRedo]
  );

  // Register keyboard shortcuts
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleKeyDown);
  }

  const isUndoDisabled = !canUndo();
  const isRedoDisabled = !canRedo();
  const isSaveDisabled = !isDirty || isSaving;

  return (
    <div style={styles.container}>
      {/* Conflict warning banner */}
      {hasConflict && (
        <div style={styles.conflictBanner} role="alert">
          <span>
            בוצעו שינויים בלשונית אחרת. השינויים שלך עלולים לדרוס אותם.
          </span>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <button
              style={styles.conflictButton}
              onClick={handleReloadFromServer}
              title="בטל את השינויים שלך וטען את הגרסה האחרונה"
            >
              טען מחדש
            </button>
            <button
              style={styles.conflictButton}
              onClick={handleDismissConflict}
              title="שמור את השינויים שלך (ידרסו בשמירה)"
            >
              התעלם
            </button>
          </div>
        </div>
      )}
      <header style={styles.header}>
        <div style={styles.logo}>
          <Link to="/" style={styles.logoText}>
            Sched
          </Link>
          {isDirty && (
            <div style={styles.dirtyBadge} title="יש שינויים שלא נשמרו">
              <div style={styles.dirtyIndicator} />
              <span>לא נשמר</span>
            </div>
          )}
        </div>

        <div style={styles.actions}>
          <div style={styles.undoRedoButtons}>
            <button
              style={{
                ...styles.undoRedoButton,
                ...(isUndoDisabled ? styles.undoRedoButtonDisabled : {}),
              }}
              onClick={handleUndo}
              disabled={isUndoDisabled}
              aria-label="בטל (Ctrl+Z)"
              title="בטל (Ctrl+Z)"
            >
              <UndoIcon />
            </button>
            <button
              style={{
                ...styles.undoRedoButton,
                ...(isRedoDisabled ? styles.undoRedoButtonDisabled : {}),
              }}
              onClick={handleRedo}
              disabled={isRedoDisabled}
              aria-label="בצע שוב (Ctrl+Y)"
              title="בצע שוב (Ctrl+Y)"
            >
              <RedoIcon />
            </button>
          </div>

          <button
            style={{
              ...styles.saveButton,
              ...(isSaveDisabled ? styles.saveButtonDisabled : {}),
            }}
            onClick={handleSave}
            disabled={isSaveDisabled}
            aria-label="שמור (Ctrl+S)"
            title="שמור (Ctrl+S)"
          >
            {isSaving ? 'שומר...' : 'שמור'}
          </button>

          <ThemeToggle />
        </div>
      </header>

      <main style={styles.main}>{children}</main>
    </div>
  );
}
