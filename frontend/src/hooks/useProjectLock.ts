import { useState, useCallback, useEffect } from 'react';

const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Hook to manage project lock state.
 * A project becomes "locked" (full size, no opacity) when clicked.
 * Lock expires after 1 hour from the last click or on page refresh.
 * This is in-memory only (not persisted).
 */
export function useProjectLock() {
  const [lockedProjects, setLockedProjects] = useState<Map<string, number>>(new Map());

  // Clean up expired locks
  const cleanupExpiredLocks = useCallback(() => {
    const now = Date.now();
    setLockedProjects((current) => {
      const newMap = new Map<string, number>();
      current.forEach((expiresAt, projectId) => {
        if (expiresAt > now) {
          newMap.set(projectId, expiresAt);
        }
      });
      return newMap;
    });
  }, []);

  // Set up periodic cleanup
  useEffect(() => {
    const interval = setInterval(cleanupExpiredLocks, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [cleanupExpiredLocks]);

  // Lock a project (called on click)
  const lockProject = useCallback((projectId: string) => {
    const expiresAt = Date.now() + LOCK_DURATION_MS;
    setLockedProjects((current) => {
      const newMap = new Map(current);
      newMap.set(projectId, expiresAt);
      return newMap;
    });
  }, []);

  // Unlock a project manually
  const unlockProject = useCallback((projectId: string) => {
    setLockedProjects((current) => {
      const newMap = new Map(current);
      newMap.delete(projectId);
      return newMap;
    });
  }, []);

  // Check if a project is currently locked
  const isProjectLocked = useCallback(
    (projectId: string): boolean => {
      const expiresAt = lockedProjects.get(projectId);
      if (!expiresAt) return false;
      return expiresAt > Date.now();
    },
    [lockedProjects]
  );

  // Get all locked project IDs
  const getLockedProjectIds = useCallback((): string[] => {
    const now = Date.now();
    const locked: string[] = [];
    lockedProjects.forEach((expiresAt, projectId) => {
      if (expiresAt > now) {
        locked.push(projectId);
      }
    });
    return locked;
  }, [lockedProjects]);

  return {
    lockProject,
    unlockProject,
    isProjectLocked,
    getLockedProjectIds,
    lockedProjects,
  };
}
