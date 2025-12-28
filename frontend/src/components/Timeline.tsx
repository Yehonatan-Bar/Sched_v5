import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Task, Schedule, TimeRange } from '../types';
import Modal from './Modal';

// Zoom levels from widest to narrowest
export type ZoomLevel = 'months' | 'weeks' | 'days' | 'hours' | 'minutes';
const ZOOM_LEVELS: ZoomLevel[] = ['months', 'weeks', 'days', 'hours', 'minutes'];

// Pixels per unit at each zoom level
// Configured so each time unit has enough pixels for consecutive tick display
const ZOOM_CONFIGS: Record<ZoomLevel, { msPerPixel: number; tickInterval: number; format: string; minTickSpacing: number }> = {
  months: { msPerPixel: 86400000 * 7, tickInterval: 86400000 * 30, format: 'month', minTickSpacing: 50 },    // ~11 months visible, ~55px/month
  weeks: { msPerPixel: 86400000, tickInterval: 86400000 * 7, format: 'week', minTickSpacing: 45 },           // ~7 weeks visible, ~86px/week
  days: { msPerPixel: 86400000 / 40, tickInterval: 86400000, format: 'day', minTickSpacing: 35 },            // ~15 days visible, 40px/day
  hours: { msPerPixel: 3600000 / 40, tickInterval: 3600000, format: 'hour', minTickSpacing: 35 },            // ~15 hours visible, 40px/hour
  minutes: { msPerPixel: 60000 / 35, tickInterval: 60000, format: 'minute', minTickSpacing: 30 },            // ~17 minutes visible, 35px/minute
};

// Touch gesture configuration
const TOUCH_MOVE_THRESHOLD = 10; // Pixels before we consider it a drag
const TOUCH_LONG_PRESS_MS = 300; // Time for long press to activate drag

// Color palette for tasks
const TASK_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

interface TimelineProps {
  timeRange: TimeRange;
  tasks: Task[];
  isLocked: boolean;
  onTaskScheduleUpdate?: (taskId: string, schedule: Schedule) => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
  zoomLevel?: ZoomLevel;
  onZoomChange?: (level: ZoomLevel) => void;
}

// Time adjustment amounts per zoom level (in milliseconds)
const ZOOM_TIME_ADJUSTMENTS: Record<ZoomLevel, number> = {
  months: 86400000 * 30,  // 1 month
  weeks: 86400000 * 7,    // 1 week
  days: 86400000,         // 1 day
  hours: 3600000,         // 1 hour
  minutes: 60000,         // 1 minute
};

// Touch state interface
interface TouchState {
  taskId: string;
  mode: 'move' | 'resize-start' | 'resize-end';
  startTouchX: number;
  startTouchY: number;
  originalSchedule: Schedule;
  isActive: boolean; // True after long press or threshold exceeded
}

interface TaskBar {
  task: Task;
  startX: number;
  endX: number;
  row: number;
  color: string;
  isPoint: boolean;
}

// Calculate task position on timeline
function getTaskPosition(
  task: Task,
  timelineStart: number,
  msPerPixel: number,
  timelineWidth: number
): { startX: number; endX: number; isPoint: boolean } | null {
  if (!task.schedule) return null;

  if (task.schedule.mode === 'range') {
    const taskStart = new Date(task.schedule.start_iso).getTime();
    const taskEnd = new Date(task.schedule.end_iso).getTime();
    const startX = timelineWidth - (taskStart - timelineStart) / msPerPixel;
    const endX = timelineWidth - (taskEnd - timelineStart) / msPerPixel;
    return { startX: Math.min(startX, endX), endX: Math.max(startX, endX), isPoint: false };
  } else {
    const pointTime = new Date(task.schedule.point_iso).getTime();
    const x = timelineWidth - (pointTime - timelineStart) / msPerPixel;
    return { startX: x - 4, endX: x + 4, isPoint: true };
  }
}

// Assign rows to overlapping tasks
function assignRows(taskBars: Omit<TaskBar, 'row'>[]): TaskBar[] {
  const sorted = [...taskBars].sort((a, b) => a.startX - b.startX);
  const rows: { endX: number }[] = [];

  return sorted.map((bar) => {
    let assignedRow = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].endX <= bar.startX) {
        assignedRow = i;
        rows[i].endX = bar.endX;
        return { ...bar, row: assignedRow };
      }
    }
    assignedRow = rows.length;
    rows.push({ endX: bar.endX });
    return { ...bar, row: assignedRow };
  });
}

// Month names for display
const MONTH_NAMES = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
const DAY_NAMES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

// Format date based on zoom level format type
function formatDate(date: Date, format: string): string {
  switch (format) {
    case 'month':
      // Show month name and year: "Jan '25"
      return `${MONTH_NAMES[date.getMonth()]} '${date.getFullYear().toString().slice(-2)}`;
    case 'week':
      // Show day/month: "15/1"
      return `${date.getDate()}/${date.getMonth() + 1}`;
    case 'day':
      // Show day name then date for RTL: "א' 28" (Sunday 28)
      return `${DAY_NAMES[date.getDay()]}׳ ${date.getDate()}`;
    case 'hour':
      // Show just hour: "14:00"
      return `${date.getHours()}:00`;
    case 'minute':
      // Show hour:minutes format for each consecutive minute
      return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    default:
      return date.toLocaleTimeString();
  }
}

// Generate tick positions with calendar-aware consecutive intervals
function generateTicks(
  timelineStart: number,
  timelineEnd: number,
  _tickInterval: number, // Not used - kept for interface compatibility
  format: string,
  timelineWidth: number,
  msPerPixel: number,
  minTickSpacing: number
): { x: number; label: string }[] {
  const ticks: { x: number; label: string }[] = [];

  // Get the first tick aligned to the appropriate calendar boundary
  const startDate = new Date(timelineStart);
  let currentDate: Date;

  switch (format) {
    case 'month':
      // Align to start of month
      currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      break;
    case 'week':
      // Align to start of week (Sunday)
      currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() - currentDate.getDay());
      currentDate.setHours(0, 0, 0, 0);
      break;
    case 'day':
      // Align to start of day
      currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      break;
    case 'hour':
      // Align to start of hour
      currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startDate.getHours());
      break;
    case 'minute':
      // Align to start of minute
      currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startDate.getHours(), startDate.getMinutes());
      break;
    default:
      currentDate = new Date(startDate);
  }

  // Function to advance to next calendar unit
  const advanceDate = (date: Date): Date => {
    const newDate = new Date(date);
    switch (format) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'hour':
        newDate.setHours(newDate.getHours() + 1);
        break;
      case 'minute':
        newDate.setMinutes(newDate.getMinutes() + 1);
        break;
    }
    return newDate;
  };

  // Generate all consecutive ticks within the visible range
  // Use minTickSpacing to filter overlapping labels after generation
  let tickCount = 0;
  let lastAddedX: number | null = null;

  while (currentDate.getTime() <= timelineEnd && tickCount < 100) {
    const time = currentDate.getTime();

    if (time >= timelineStart) {
      const x = timelineWidth - (time - timelineStart) / msPerPixel;
      if (x >= 0 && x <= timelineWidth) {
        // Check if this tick is far enough from the last one
        const shouldAdd = lastAddedX === null || Math.abs(x - lastAddedX) >= minTickSpacing;
        if (shouldAdd) {
          ticks.push({ x, label: formatDate(currentDate, format) });
          lastAddedX = x;
          tickCount++;
        }
      }
    }

    currentDate = advanceDate(currentDate);

    // Safety limit
    if (tickCount > 100) break;
  }

  return ticks;
}

// Info Icon SVG component
function InfoIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// Navigation Arrow Icons
function ChevronLeftIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function Timeline({
  timeRange,
  tasks,
  isLocked,
  onTaskScheduleUpdate,
  onTaskUpdate,
  zoomLevel: controlledZoomLevel,
  onZoomChange,
}: TimelineProps) {
  const [internalZoomLevel, setInternalZoomLevel] = useState<ZoomLevel>('weeks');

  // Use controlled or internal state
  const zoomLevel = controlledZoomLevel ?? internalZoomLevel;
  const setZoomLevel = onZoomChange ?? setInternalZoomLevel;
  const [isHoveringTimeline, setIsHoveringTimeline] = useState(false);
  const [panOffset, setPanOffset] = useState(0);
  const [containerWidth, setContainerWidth] = useState(600);

  // Timeline panning state
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);
  const didPanRef = useRef(false);
  const [dragState, setDragState] = useState<{
    taskId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    startMouseX: number;
    originalSchedule: Schedule;
  } | null>(null);

  // Touch drag state for mobile
  const [touchState, setTouchState] = useState<TouchState | null>(null);
  const touchTimeoutRef = useRef<number | null>(null);

  // Keyboard-focused task for arrow key navigation
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  // Level 2: Expanded task state
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Task details modal state
  const [detailsModalTask, setDetailsModalTask] = useState<Task | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Get zoom config for current level (needed before effects that use it)
  const zoomConfig = ZOOM_CONFIGS[zoomLevel];

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close expanded task on Escape
      if (e.key === 'Escape') {
        if (expandedTaskId) {
          setExpandedTaskId(null);
        }
        if (focusedTaskId) {
          setFocusedTaskId(null);
        }
        return;
      }

      // Shift+Arrow to move focused task on timeline
      if (e.shiftKey && focusedTaskId && isLocked && onTaskScheduleUpdate) {
        const task = tasks.find(t => t.id === focusedTaskId);
        if (!task?.schedule) return;

        const moveAmount = zoomConfig.tickInterval / 4; // Move by 1/4 of tick interval

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          // RTL: ArrowLeft moves to future, ArrowRight moves to past
          const direction = e.key === 'ArrowLeft' ? 1 : -1;
          const deltaMs = direction * moveAmount;

          if (task.schedule.mode === 'range') {
            const newStart = new Date(task.schedule.start_iso).getTime() + deltaMs;
            const newEnd = new Date(task.schedule.end_iso).getTime() + deltaMs;
            onTaskScheduleUpdate(focusedTaskId, {
              mode: 'range',
              start_iso: new Date(newStart).toISOString(),
              end_iso: new Date(newEnd).toISOString(),
            });
          } else if (task.schedule.mode === 'point') {
            const newPoint = new Date(task.schedule.point_iso).getTime() + deltaMs;
            onTaskScheduleUpdate(focusedTaskId, {
              mode: 'point',
              point_iso: new Date(newPoint).toISOString(),
            });
          }
        }
      }

      // Tab/Arrow to navigate between tasks when timeline is focused
      if (!e.shiftKey && isLocked && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const visibleTasks = tasks.filter(t => t.schedule);
        if (visibleTasks.length === 0) return;

        const currentIndex = focusedTaskId
          ? visibleTasks.findIndex(t => t.id === focusedTaskId)
          : -1;

        let newIndex: number;
        if (e.key === 'ArrowUp') {
          newIndex = currentIndex <= 0 ? visibleTasks.length - 1 : currentIndex - 1;
        } else {
          newIndex = currentIndex >= visibleTasks.length - 1 ? 0 : currentIndex + 1;
        }
        setFocusedTaskId(visibleTasks[newIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedTaskId, focusedTaskId, isLocked, tasks, zoomConfig.tickInterval, onTaskScheduleUpdate]);

  // Clear touch timeout on unmount
  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, []);

  const width = containerWidth;

  // Timeline dimensions
  const AXIS_HEIGHT = 30;
  const TASK_AREA_START = AXIS_HEIGHT + 10;
  const BAR_HEIGHT = 24;
  const BAR_GAP = 8;
  const LABEL_AREA_HEIGHT = 80; // Increased for people names
  const SUB_TIMELINE_HEIGHT = 100; // Height for Level 2 sub-timeline

  const timelineStart = new Date(timeRange.start_iso).getTime();
  const timelineEnd = new Date(timeRange.end_iso).getTime();

  // Center on current date (clamped to timeline range)
  // Use Jerusalem timezone for "now" calculation
  const now = Date.now();
  // Clamp "now" to be within the timeline range
  const clampedNow = Math.max(timelineStart, Math.min(timelineEnd, now));

  const visibleDuration = width * zoomConfig.msPerPixel;
  const centerTime = clampedNow + panOffset;
  const visibleStart = centerTime - visibleDuration / 2;
  const visibleEnd = centerTime + visibleDuration / 2;

  // Find expanded task
  const expandedTask = useMemo(() => {
    if (!expandedTaskId) return null;
    return tasks.find(t => t.id === expandedTaskId) || null;
  }, [tasks, expandedTaskId]);

  // Get sorted scheduled tasks for navigation (sorted by time, RTL so future is left)
  const sortedScheduledTasks = useMemo(() => {
    return tasks
      .filter(t => t.schedule)
      .map(t => {
        const time = t.schedule!.mode === 'range'
          ? new Date(t.schedule!.start_iso).getTime()
          : new Date(t.schedule!.point_iso).getTime();
        return { task: t, time };
      })
      .sort((a, b) => a.time - b.time); // Past to future
  }, [tasks]);

  // Current navigation index based on panOffset/centerTime
  const currentNavIndex = useMemo(() => {
    if (sortedScheduledTasks.length === 0) return -1;
    // Find the task closest to the center of the visible timeline
    let closestIdx = 0;
    let closestDist = Math.abs(sortedScheduledTasks[0].time - centerTime);
    for (let i = 1; i < sortedScheduledTasks.length; i++) {
      const dist = Math.abs(sortedScheduledTasks[i].time - centerTime);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [sortedScheduledTasks, centerTime]);

  // Navigate to a specific task (center it on the timeline)
  const navigateToTask = useCallback((taskIndex: number) => {
    if (taskIndex < 0 || taskIndex >= sortedScheduledTasks.length) return;
    const targetTime = sortedScheduledTasks[taskIndex].time;
    // Calculate the panOffset needed to center on this task
    // centerTime = clampedNow + panOffset, so panOffset = targetTime - clampedNow
    const newPanOffset = targetTime - clampedNow;
    setPanOffset(newPanOffset);
    // Also set focus to this task
    setFocusedTaskId(sortedScheduledTasks[taskIndex].task.id);
  }, [sortedScheduledTasks, clampedNow]);

  // Navigate to next task (future direction - left in RTL)
  const navigateToNextTask = useCallback(() => {
    if (currentNavIndex < sortedScheduledTasks.length - 1) {
      navigateToTask(currentNavIndex + 1);
    }
  }, [currentNavIndex, sortedScheduledTasks.length, navigateToTask]);

  // Navigate to previous task (past direction - right in RTL)
  const navigateToPrevTask = useCallback(() => {
    if (currentNavIndex > 0) {
      navigateToTask(currentNavIndex - 1);
    }
  }, [currentNavIndex, navigateToTask]);

  // Generate task bars
  const { taskBars, leftHints, rightHints } = useMemo(() => {
    const bars: Omit<TaskBar, 'row'>[] = [];
    const leftHintTasks: { task: Task; color: string }[] = [];
    const rightHintTasks: { task: Task; color: string }[] = [];

    tasks.forEach((task, index) => {
      if (!task.schedule) return;

      const color = task.color === 'auto' ? TASK_COLORS[index % TASK_COLORS.length] : task.color;
      const pos = getTaskPosition(task, visibleStart, zoomConfig.msPerPixel, width);

      if (!pos) return;

      if (pos.endX >= 0 && pos.startX <= width) {
        bars.push({
          task,
          startX: Math.max(0, pos.startX),
          endX: Math.min(width, pos.endX),
          color,
          isPoint: pos.isPoint,
        });
      } else if (pos.endX < 0) {
        leftHintTasks.push({ task, color });
      } else if (pos.startX > width) {
        rightHintTasks.push({ task, color });
      }
    });

    return {
      taskBars: assignRows(bars),
      leftHints: leftHintTasks,
      rightHints: rightHintTasks,
    };
  }, [tasks, visibleStart, zoomConfig.msPerPixel, width]);

  // Generate axis ticks
  const ticks = useMemo(() => {
    return generateTicks(
      visibleStart,
      visibleEnd,
      zoomConfig.tickInterval,
      zoomConfig.format,
      width,
      zoomConfig.msPerPixel,
      zoomConfig.minTickSpacing
    );
  }, [visibleStart, visibleEnd, zoomConfig, width]);

  // Calculate total height
  const maxRow = taskBars.reduce((max, bar) => Math.max(max, bar.row), -1);
  const taskAreaHeight = (maxRow + 1) * (BAR_HEIGHT + BAR_GAP) || BAR_HEIGHT;
  const subTimelineOffset = expandedTaskId ? SUB_TIMELINE_HEIGHT : 0;
  const totalHeight = TASK_AREA_START + taskAreaHeight + LABEL_AREA_HEIGHT + subTimelineOffset;

  // Handle wheel for zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!isLocked || !isHoveringTimeline) return;

      e.preventDefault();
      const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
      if (e.deltaY > 0 && currentIndex > 0) {
        setZoomLevel(ZOOM_LEVELS[currentIndex - 1]);
      } else if (e.deltaY < 0 && currentIndex < ZOOM_LEVELS.length - 1) {
        setZoomLevel(ZOOM_LEVELS[currentIndex + 1]);
      }
    },
    [isLocked, isHoveringTimeline, zoomLevel]
  );

  // Handle timeline panning - start
  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      // Only start panning on direct timeline background clicks
      const target = e.target as SVGElement;
      if (target.tagName === 'svg' || target.tagName === 'line' || target.tagName === 'polygon') {
        e.preventDefault();
        setIsPanning(true);
        setPanStartX(e.clientX);
        setPanStartOffset(panOffset);
        didPanRef.current = false;
      }
    },
    [panOffset]
  );

  // Handle timeline panning - move
  useEffect(() => {
    if (!isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - panStartX;
      // Mark as panned if moved more than 5 pixels
      if (Math.abs(deltaX) > 5) {
        didPanRef.current = true;
      }
      // RTL: dragging right moves to future (increases offset)
      const deltaMs = deltaX * zoomConfig.msPerPixel;
      setPanOffset(panStartOffset + deltaMs);
    };

    const handleMouseUp = () => {
      setIsPanning(false);
      // Reset didPan after a short delay to block click event
      setTimeout(() => {
        didPanRef.current = false;
      }, 50);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, panStartX, panStartOffset, zoomConfig.msPerPixel]);

  // Handle timeline panning - touch support
  const [touchPanState, setTouchPanState] = useState<{ startX: number; startOffset: number } | null>(null);

  const handlePanTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Only start panning on direct timeline background touches
      const target = e.target as SVGElement;
      if (target.tagName === 'svg' || target.tagName === 'line' || target.tagName === 'polygon') {
        const touch = e.touches[0];
        setTouchPanState({ startX: touch.clientX, startOffset: panOffset });
      }
    },
    [panOffset]
  );

  useEffect(() => {
    if (!touchPanState) return;

    const handleTouchMoveForPan = (e: TouchEvent) => {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchPanState.startX;

      // Only prevent default if horizontal movement is significant
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
        didPanRef.current = true;
        const deltaMs = deltaX * zoomConfig.msPerPixel;
        setPanOffset(touchPanState.startOffset + deltaMs);
      }
    };

    const handleTouchEndForPan = () => {
      setTouchPanState(null);
      // Reset didPan after a short delay to block click event
      setTimeout(() => {
        didPanRef.current = false;
      }, 50);
    };

    window.addEventListener('touchmove', handleTouchMoveForPan, { passive: false });
    window.addEventListener('touchend', handleTouchEndForPan);
    window.addEventListener('touchcancel', handleTouchEndForPan);

    return () => {
      window.removeEventListener('touchmove', handleTouchMoveForPan);
      window.removeEventListener('touchend', handleTouchEndForPan);
      window.removeEventListener('touchcancel', handleTouchEndForPan);
    };
  }, [touchPanState, zoomConfig.msPerPixel]);

  // Handle task click for Level 2 expansion
  const handleTaskClick = useCallback(
    (e: React.MouseEvent, task: Task) => {
      e.stopPropagation();
      // Toggle expanded state
      if (expandedTaskId === task.id) {
        setExpandedTaskId(null);
      } else if (task.subtasks && task.subtasks.length > 0) {
        setExpandedTaskId(task.id);
      }
    },
    [expandedTaskId]
  );

  // Handle click outside to close expanded task
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      // Skip if we just finished panning
      if (didPanRef.current) {
        return;
      }
      // Check if click is on SVG background (not on task bars)
      const target = e.target as SVGElement;
      if (target.tagName === 'svg' || target.tagName === 'line' || target.tagName === 'polygon') {
        setExpandedTaskId(null);
      }
    },
    []
  );

  // Handle expanding/shrinking individual task schedule
  const handleExpandTask = useCallback((e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (!onTaskScheduleUpdate || !task.schedule || task.schedule.mode !== 'range') return;
    const adjustment = ZOOM_TIME_ADJUSTMENTS[zoomLevel];
    const newEnd = new Date(task.schedule.end_iso).getTime() + adjustment;
    onTaskScheduleUpdate(task.id, {
      mode: 'range',
      start_iso: task.schedule.start_iso,
      end_iso: new Date(newEnd).toISOString(),
    });
  }, [onTaskScheduleUpdate, zoomLevel]);

  const handleShrinkTask = useCallback((e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    if (!onTaskScheduleUpdate || !task.schedule || task.schedule.mode !== 'range') return;
    const adjustment = ZOOM_TIME_ADJUSTMENTS[zoomLevel];
    const currentStart = new Date(task.schedule.start_iso).getTime();
    const currentEnd = new Date(task.schedule.end_iso).getTime();
    const newEnd = currentEnd - adjustment;
    // Don't shrink past the start (keep at least one unit)
    if (newEnd <= currentStart) return;
    onTaskScheduleUpdate(task.id, {
      mode: 'range',
      start_iso: task.schedule.start_iso,
      end_iso: new Date(newEnd).toISOString(),
    });
  }, [onTaskScheduleUpdate, zoomLevel]);

  // Handle drag start (mouse)
  const handleTaskMouseDown = useCallback(
    (e: React.MouseEvent, task: Task, mode: 'move' | 'resize-start' | 'resize-end') => {
      if (!task.schedule || !isLocked) return;
      e.preventDefault();
      e.stopPropagation();

      setDragState({
        taskId: task.id,
        mode,
        startMouseX: e.clientX,
        originalSchedule: { ...task.schedule },
      });
      setFocusedTaskId(task.id);
    },
    [isLocked]
  );

  // Handle touch start for mobile drag
  const handleTaskTouchStart = useCallback(
    (e: React.TouchEvent, task: Task, mode: 'move' | 'resize-start' | 'resize-end') => {
      if (!task.schedule || !isLocked) return;

      const touch = e.touches[0];

      // Set initial touch state (not active yet)
      setTouchState({
        taskId: task.id,
        mode,
        startTouchX: touch.clientX,
        startTouchY: touch.clientY,
        originalSchedule: { ...task.schedule },
        isActive: false,
      });
      setFocusedTaskId(task.id);

      // Start long press timer to activate drag
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
      touchTimeoutRef.current = window.setTimeout(() => {
        setTouchState(prev => prev ? { ...prev, isActive: true } : null);
      }, TOUCH_LONG_PRESS_MS);
    },
    [isLocked]
  );

  // Handle touch move for mobile drag
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!touchState || !onTaskScheduleUpdate) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchState.startTouchX;
      const deltaY = touch.clientY - touchState.startTouchY;

      // Check if we've exceeded the movement threshold
      if (!touchState.isActive) {
        if (Math.abs(deltaX) > TOUCH_MOVE_THRESHOLD || Math.abs(deltaY) > TOUCH_MOVE_THRESHOLD) {
          // If vertical movement is greater, let the page scroll
          if (Math.abs(deltaY) > Math.abs(deltaX)) {
            setTouchState(null);
            if (touchTimeoutRef.current) {
              clearTimeout(touchTimeoutRef.current);
            }
            return;
          }
          // Horizontal movement - activate drag
          setTouchState(prev => prev ? { ...prev, isActive: true } : null);
          if (touchTimeoutRef.current) {
            clearTimeout(touchTimeoutRef.current);
          }
        } else {
          return; // Wait for threshold
        }
      }

      // Prevent scroll while dragging
      e.preventDefault();

      const deltaMs = -deltaX * zoomConfig.msPerPixel;
      const snapInterval = zoomConfig.tickInterval / 4;
      const snappedDeltaMs = Math.round(deltaMs / snapInterval) * snapInterval;

      const original = touchState.originalSchedule;
      if (original.mode === 'range') {
        let newStart = new Date(original.start_iso).getTime();
        let newEnd = new Date(original.end_iso).getTime();

        if (touchState.mode === 'move') {
          newStart += snappedDeltaMs;
          newEnd += snappedDeltaMs;
        } else if (touchState.mode === 'resize-start') {
          newStart += snappedDeltaMs;
          if (newStart >= newEnd) newStart = newEnd - snapInterval;
        } else if (touchState.mode === 'resize-end') {
          newEnd += snappedDeltaMs;
          if (newEnd <= newStart) newEnd = newStart + snapInterval;
        }

        onTaskScheduleUpdate(touchState.taskId, {
          mode: 'range',
          start_iso: new Date(newStart).toISOString(),
          end_iso: new Date(newEnd).toISOString(),
        });
      } else if (original.mode === 'point') {
        const newPoint = new Date(original.point_iso).getTime() + snappedDeltaMs;
        onTaskScheduleUpdate(touchState.taskId, {
          mode: 'point',
          point_iso: new Date(newPoint).toISOString(),
        });
      }
    },
    [touchState, zoomConfig, onTaskScheduleUpdate]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setTouchState(null);
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
    }
  }, []);

  // Set up touch listeners
  useEffect(() => {
    if (!touchState) return;

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [touchState, handleTouchMove, handleTouchEnd]);

  // Handle drag
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !onTaskScheduleUpdate) return;

      const deltaX = e.clientX - dragState.startMouseX;
      const deltaMs = -deltaX * zoomConfig.msPerPixel;
      const snapInterval = zoomConfig.tickInterval / 4;
      const snappedDeltaMs = Math.round(deltaMs / snapInterval) * snapInterval;

      const original = dragState.originalSchedule;
      if (original.mode === 'range') {
        let newStart = new Date(original.start_iso).getTime();
        let newEnd = new Date(original.end_iso).getTime();

        if (dragState.mode === 'move') {
          newStart += snappedDeltaMs;
          newEnd += snappedDeltaMs;
        } else if (dragState.mode === 'resize-start') {
          newStart += snappedDeltaMs;
          if (newStart >= newEnd) newStart = newEnd - snapInterval;
        } else if (dragState.mode === 'resize-end') {
          newEnd += snappedDeltaMs;
          if (newEnd <= newStart) newEnd = newStart + snapInterval;
        }

        onTaskScheduleUpdate(dragState.taskId, {
          mode: 'range',
          start_iso: new Date(newStart).toISOString(),
          end_iso: new Date(newEnd).toISOString(),
        });
      } else if (original.mode === 'point') {
        const newPoint = new Date(original.point_iso).getTime() + snappedDeltaMs;
        onTaskScheduleUpdate(dragState.taskId, {
          mode: 'point',
          point_iso: new Date(newPoint).toISOString(),
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, zoomConfig, onTaskScheduleUpdate]);

  // Open task details modal
  const handleOpenDetails = useCallback((e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    setDetailsModalTask(task);
  }, []);

  // Local state for modal inputs to prevent focus loss
  const [localDetails, setLocalDetails] = useState('');
  const [localNotes, setLocalNotes] = useState('');
  const [localPeopleInput, setLocalPeopleInput] = useState('');

  // Sync local state when modal opens with a new task
  useEffect(() => {
    if (detailsModalTask) {
      setLocalDetails(detailsModalTask.details);
      setLocalNotes(detailsModalTask.notes);
      setLocalPeopleInput(detailsModalTask.people.join(', '));
    }
  }, [detailsModalTask?.id]); // Only sync when task changes

  // Handle task details update - only update local state on change, save on blur
  const handleDetailsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalDetails(e.target.value);
    },
    []
  );

  const handleDetailsBlur = useCallback(() => {
    if (!detailsModalTask || !onTaskUpdate) return;
    onTaskUpdate(detailsModalTask.id, { details: localDetails });
  }, [detailsModalTask, onTaskUpdate, localDetails]);

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLocalNotes(e.target.value);
    },
    []
  );

  const handleNotesBlur = useCallback(() => {
    if (!detailsModalTask || !onTaskUpdate) return;
    onTaskUpdate(detailsModalTask.id, { notes: localNotes });
  }, [detailsModalTask, onTaskUpdate, localNotes]);

  const handlePeopleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalPeopleInput(e.target.value);
    },
    []
  );

  const handlePeopleBlur = useCallback(() => {
    if (!detailsModalTask || !onTaskUpdate) return;
    const people = localPeopleInput.split(',').map(p => p.trim()).filter(p => p);
    onTaskUpdate(detailsModalTask.id, { people });
  }, [detailsModalTask, onTaskUpdate, localPeopleInput]);

  // Check if currently dragging (mouse or touch) or panning
  const isDragging = dragState !== null || (touchState?.isActive ?? false) || isPanning || touchPanState !== null;

  // Styles
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    marginTop: 'var(--spacing-md)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-light)',
    // Prevent scroll conflicts on mobile - allow vertical scroll unless dragging
    touchAction: isDragging ? 'none' : 'pan-y',
    // GPU acceleration for smooth animations
    willChange: isDragging ? 'transform' : 'auto',
    // Cursor for panning
    cursor: isPanning ? 'grabbing' : 'grab',
  };

  const keyboardHintStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 'var(--spacing-xs)',
    left: 'var(--spacing-xs)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-secondary)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    zIndex: 10,
    opacity: focusedTaskId ? 1 : 0,
    transition: 'opacity var(--transition-fast)',
  };

  const navButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
  };

  const navButtonDisabledStyle: React.CSSProperties = {
    ...navButtonStyle,
    opacity: 0.4,
    cursor: 'not-allowed',
  };

  const navContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-md)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    marginBottom: 'var(--spacing-xs)',
  };

  const navInfoStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
    minWidth: '120px',
    textAlign: 'center',
  };

  // Render sub-timeline for expanded task (Level 2)
  const renderSubTimeline = () => {
    if (!expandedTask || !expandedTask.subtasks || expandedTask.subtasks.length === 0) return null;

    const subTasks = expandedTask.subtasks.filter(st => st.schedule);
    if (subTasks.length === 0) return null;

    const subStartY = TASK_AREA_START + taskAreaHeight + LABEL_AREA_HEIGHT;

    // Use parent task's schedule for sub-timeline time range
    let subTimeRange = { start_iso: timeRange.start_iso, end_iso: timeRange.end_iso };
    if (expandedTask.schedule) {
      if (expandedTask.schedule.mode === 'range') {
        subTimeRange = {
          start_iso: expandedTask.schedule.start_iso,
          end_iso: expandedTask.schedule.end_iso,
        };
      }
    }

    const subStart = new Date(subTimeRange.start_iso).getTime();
    const subEnd = new Date(subTimeRange.end_iso).getTime();
    const subDuration = subEnd - subStart;
    const subMsPerPixel = subDuration / (width - 40);

    return (
      <g>
        {/* Sub-timeline background */}
        <rect
          x={0}
          y={subStartY}
          width={width}
          height={SUB_TIMELINE_HEIGHT}
          fill="var(--bg-secondary)"
          opacity={0.8}
        />
        {/* Sub-timeline axis */}
        <line
          x1={20}
          y1={subStartY + 20}
          x2={width - 20}
          y2={subStartY + 20}
          stroke="var(--border-medium)"
          strokeWidth={1}
        />
        {/* Sub-task bars */}
        {subTasks.map((subTask, idx) => {
          const color = subTask.color === 'auto' ? TASK_COLORS[(idx + 4) % TASK_COLORS.length] : subTask.color;
          const pos = getTaskPosition(subTask, subStart, subMsPerPixel, width - 40);
          if (!pos) return null;

          const barY = subStartY + 30;
          const barWidth = pos.endX - pos.startX;
          const centerX = pos.startX + barWidth / 2 + 20;

          return (
            <g key={subTask.id}>
              {pos.isPoint ? (
                <circle
                  cx={centerX}
                  cy={barY + 10}
                  r={6}
                  fill={color}
                />
              ) : (
                <rect
                  x={pos.startX + 20}
                  y={barY}
                  width={barWidth}
                  height={20}
                  rx={3}
                  fill={color}
                />
              )}
              {/* Sub-task label */}
              <text
                x={centerX}
                y={barY + 45}
                textAnchor="middle"
                fontSize="10"
                fill={color}
              >
                {subTask.title || 'ללא שם'}
              </text>
              {/* People names for subtask (Level 3) */}
              {subTask.people && subTask.people.length > 0 && (
                <text
                  x={centerX}
                  y={barY + 58}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--text-muted)"
                >
                  {subTask.people.join(', ')}
                </text>
              )}
              {/* Waiting-for indicator */}
              {subTask.status.type === 'waiting_for' && subTask.status.waiting_for && (
                <text
                  x={centerX}
                  y={barY + 70}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--status-waiting)"
                >
                  ממתין ל: {subTask.status.waiting_for}
                </text>
              )}
            </g>
          );
        })}
        {/* Close hint */}
        <text
          x={width - 10}
          y={subStartY + 12}
          textAnchor="end"
          fontSize="10"
          fill="var(--text-muted)"
        >
          לחץ מחוץ או ESC לסגירה
        </text>
      </g>
    );
  };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onMouseEnter={() => setIsHoveringTimeline(true)}
      onMouseLeave={() => setIsHoveringTimeline(false)}
      onWheel={handleWheel}
      role="application"
      aria-label="ציר זמן. השתמש בחיצים לניווט בין משימות, Shift+חץ להזזת המשימה הנבחרת."
    >
      <span style={keyboardHintStyle} aria-live="polite">
        Shift + חץ להזזת המשימה
      </span>

      {/* Task Navigation Bar */}
      {sortedScheduledTasks.length > 0 && (
        <div style={navContainerStyle}>
          {/* Right arrow - goes to previous/past task (RTL) */}
          <button
            style={currentNavIndex <= 0 ? navButtonDisabledStyle : navButtonStyle}
            onClick={navigateToPrevTask}
            disabled={currentNavIndex <= 0}
            title="משימה קודמת"
            aria-label="משימה קודמת"
          >
            <ChevronRightIcon size={20} />
          </button>

          {/* Current task info */}
          <span style={navInfoStyle}>
            {currentNavIndex >= 0 && sortedScheduledTasks[currentNavIndex] ? (
              <>
                <strong>{currentNavIndex + 1}</strong> / {sortedScheduledTasks.length}
                {' · '}
                {sortedScheduledTasks[currentNavIndex].task.title || 'ללא שם'}
              </>
            ) : (
              `${sortedScheduledTasks.length} משימות`
            )}
          </span>

          {/* Left arrow - goes to next/future task (RTL) */}
          <button
            style={currentNavIndex >= sortedScheduledTasks.length - 1 ? navButtonDisabledStyle : navButtonStyle}
            onClick={navigateToNextTask}
            disabled={currentNavIndex >= sortedScheduledTasks.length - 1}
            title="משימה הבאה"
            aria-label="משימה הבאה"
          >
            <ChevronLeftIcon size={20} />
          </button>
        </div>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={totalHeight}
        style={{ display: 'block', cursor: isPanning ? 'grabbing' : 'grab' }}
        onClick={handleContainerClick}
        onMouseDown={handlePanStart}
        onTouchStart={handlePanTouchStart}
      >
        {/* Timeline axis line */}
        <line
          x1={0}
          y1={AXIS_HEIGHT}
          x2={width}
          y2={AXIS_HEIGHT}
          stroke="var(--border-medium)"
          strokeWidth={2}
        />

        {/* Arrow heads */}
        <polygon
          points={`0,${AXIS_HEIGHT} 10,${AXIS_HEIGHT - 5} 10,${AXIS_HEIGHT + 5}`}
          fill="var(--border-medium)"
        />
        <polygon
          points={`${width},${AXIS_HEIGHT} ${width - 10},${AXIS_HEIGHT - 5} ${width - 10},${AXIS_HEIGHT + 5}`}
          fill="var(--border-medium)"
        />

        {/* Axis ticks */}
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={tick.x}
              y1={AXIS_HEIGHT - 5}
              x2={tick.x}
              y2={AXIS_HEIGHT + 5}
              stroke="var(--border-medium)"
              strokeWidth={1}
            />
            <text
              x={tick.x}
              y={AXIS_HEIGHT - 10}
              textAnchor="middle"
              fontSize="11"
              fontWeight="500"
              fill="var(--text-secondary)"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Task bars */}
        {taskBars.map((bar) => {
          const y = TASK_AREA_START + bar.row * (BAR_HEIGHT + BAR_GAP);
          const barWidth = bar.endX - bar.startX;
          const labelY = TASK_AREA_START + taskAreaHeight + 12 + bar.row * 22;
          const barCenterX = bar.startX + barWidth / 2;

          // Level 2: Dim non-expanded tasks when one is expanded
          const isExpanded = bar.task.id === expandedTaskId;
          const isDimmed = expandedTaskId !== null && !isExpanded;
          const hasSubtasks = bar.task.subtasks && bar.task.subtasks.length > 0;
          const isFocused = bar.task.id === focusedTaskId;
          const isBeingDragged = (dragState?.taskId === bar.task.id) || (touchState?.taskId === bar.task.id && touchState.isActive);
          const opacity = isDimmed ? 0.3 : 1;

          return (
            <g
              key={bar.task.id}
              opacity={opacity}
              role="button"
              aria-label={`משימה: ${bar.task.title || 'ללא שם'}. ${bar.task.schedule?.mode === 'range' ? 'משימה עם טווח' : 'משימה נקודתית'}. ${isFocused ? 'בפוקוס. השתמש ב-Shift+חץ להזזה.' : ''}`}
              tabIndex={isLocked ? 0 : -1}
              onFocus={() => setFocusedTaskId(bar.task.id)}
            >
              {/* Focus indicator */}
              {isFocused && (
                <rect
                  x={bar.startX - 4}
                  y={y - 4}
                  width={barWidth + 8}
                  height={BAR_HEIGHT + 8}
                  rx={6}
                  fill="none"
                  stroke="var(--accent-primary)"
                  strokeWidth={2}
                  strokeDasharray="4,2"
                  style={{
                    animation: 'pulse 1.5s ease-in-out infinite',
                    pointerEvents: 'none',
                  }}
                />
              )}
              {/* Drag indicator */}
              {isBeingDragged && (
                <rect
                  x={bar.startX - 2}
                  y={y - 2}
                  width={barWidth + 4}
                  height={BAR_HEIGHT + 4}
                  rx={5}
                  fill="none"
                  stroke="var(--accent-warning)"
                  strokeWidth={2}
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {/* Task bar */}
              {bar.isPoint ? (
                <circle
                  cx={barCenterX}
                  cy={y + BAR_HEIGHT / 2}
                  r={isBeingDragged ? 10 : 8}
                  fill={bar.color}
                  style={{
                    cursor: isLocked ? 'move' : hasSubtasks ? 'pointer' : 'default',
                    transition: 'r 0.15s ease',
                  }}
                  onMouseDown={(e) => handleTaskMouseDown(e, bar.task, 'move')}
                  onTouchStart={(e) => handleTaskTouchStart(e, bar.task, 'move')}
                  onClick={(e) => handleTaskClick(e, bar.task)}
                />
              ) : (
                <>
                  <rect
                    x={bar.startX}
                    y={y}
                    width={barWidth}
                    height={BAR_HEIGHT}
                    rx={4}
                    fill={bar.color}
                    style={{
                      cursor: isLocked ? 'move' : hasSubtasks ? 'pointer' : 'default',
                      transition: 'transform 0.15s ease',
                      transform: isBeingDragged ? 'scale(1.02)' : 'scale(1)',
                      transformOrigin: 'center',
                    }}
                    onMouseDown={(e) => handleTaskMouseDown(e, bar.task, 'move')}
                    onTouchStart={(e) => handleTaskTouchStart(e, bar.task, 'move')}
                    onClick={(e) => handleTaskClick(e, bar.task)}
                  />
                  {/* Expanded indicator */}
                  {isExpanded && (
                    <rect
                      x={bar.startX - 2}
                      y={y - 2}
                      width={barWidth + 4}
                      height={BAR_HEIGHT + 4}
                      rx={6}
                      fill="none"
                      stroke={bar.color}
                      strokeWidth={2}
                      opacity={0.6}
                    />
                  )}
                  {/* Subtasks indicator */}
                  {hasSubtasks && !isExpanded && (
                    <circle
                      cx={bar.startX + 8}
                      cy={y + 8}
                      r={5}
                      fill="white"
                      stroke={bar.color}
                      strokeWidth={1}
                    />
                  )}
                  {hasSubtasks && !isExpanded && (
                    <text
                      x={bar.startX + 8}
                      y={y + 11}
                      textAnchor="middle"
                      fontSize="8"
                      fill={bar.color}
                      fontWeight={600}
                    >
                      {bar.task.subtasks.length}
                    </text>
                  )}
                  {/* Resize handles - larger touch targets on mobile */}
                  {isLocked && barWidth > 20 && (
                    <>
                      <rect
                        x={bar.endX - 12}
                        y={y - 4}
                        width={16}
                        height={BAR_HEIGHT + 8}
                        fill="transparent"
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={(e) => handleTaskMouseDown(e, bar.task, 'resize-start')}
                        onTouchStart={(e) => handleTaskTouchStart(e, bar.task, 'resize-start')}
                      />
                      <rect
                        x={bar.startX - 4}
                        y={y - 4}
                        width={16}
                        height={BAR_HEIGHT + 8}
                        fill="transparent"
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={(e) => handleTaskMouseDown(e, bar.task, 'resize-end')}
                        onTouchStart={(e) => handleTaskTouchStart(e, bar.task, 'resize-end')}
                      />
                      {/* Visual resize handles for desktop */}
                      <rect
                        x={bar.endX - 3}
                        y={y + 4}
                        width={2}
                        height={BAR_HEIGHT - 8}
                        rx={1}
                        fill="rgba(255,255,255,0.6)"
                        style={{ pointerEvents: 'none' }}
                      />
                      <rect
                        x={bar.startX + 1}
                        y={y + 4}
                        width={2}
                        height={BAR_HEIGHT - 8}
                        rx={1}
                        fill="rgba(255,255,255,0.6)"
                        style={{ pointerEvents: 'none' }}
                      />
                    </>
                  )}
                  {/* +/- buttons for expanding/shrinking task range */}
                  {isLocked && barWidth > 50 && (
                    <>
                      {/* Shrink button (-) on left side (RTL: end of task) */}
                      <g
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => handleShrinkTask(e, bar.task)}
                      >
                        <circle
                          cx={bar.endX - 14}
                          cy={y + BAR_HEIGHT / 2}
                          r={8}
                          fill="rgba(255,255,255,0.9)"
                        />
                        <text
                          x={bar.endX - 14}
                          y={y + BAR_HEIGHT / 2 + 4}
                          textAnchor="middle"
                          fontSize="14"
                          fontWeight="bold"
                          fill={bar.color}
                          style={{ pointerEvents: 'none' }}
                        >
                          −
                        </text>
                      </g>
                      {/* Expand button (+) on right side (RTL: start of task) */}
                      <g
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => handleExpandTask(e, bar.task)}
                      >
                        <circle
                          cx={bar.startX + 14}
                          cy={y + BAR_HEIGHT / 2}
                          r={8}
                          fill="rgba(255,255,255,0.9)"
                        />
                        <text
                          x={bar.startX + 14}
                          y={y + BAR_HEIGHT / 2 + 4}
                          textAnchor="middle"
                          fontSize="14"
                          fontWeight="bold"
                          fill={bar.color}
                          style={{ pointerEvents: 'none' }}
                        >
                          +
                        </text>
                      </g>
                    </>
                  )}
                </>
              )}

              {/* Task details icon */}
              <g
                style={{ cursor: 'pointer' }}
                onClick={(e) => handleOpenDetails(e, bar.task)}
              >
                <circle
                  cx={barCenterX + (bar.isPoint ? 14 : barWidth / 2 - 14)}
                  cy={y + BAR_HEIGHT / 2}
                  r={8}
                  fill="rgba(255,255,255,0.9)"
                />
                <foreignObject
                  x={barCenterX + (bar.isPoint ? 6 : barWidth / 2 - 22)}
                  y={y + BAR_HEIGHT / 2 - 6}
                  width={16}
                  height={16}
                >
                  <div style={{ color: bar.color }}>
                    <InfoIcon size={12} />
                  </div>
                </foreignObject>
              </g>

              {/* Connecting line to label */}
              <line
                x1={barCenterX}
                y1={y + BAR_HEIGHT}
                x2={barCenterX}
                y2={labelY - 4}
                stroke={bar.color}
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.6}
              />

              {/* Task label */}
              <text
                x={barCenterX}
                y={labelY}
                textAnchor="middle"
                fontSize="11"
                fill={bar.color}
                fontWeight={500}
              >
                {bar.task.title || 'ללא שם'}
              </text>

              {/* Level 3: People names */}
              {bar.task.people && bar.task.people.length > 0 && (
                <text
                  x={barCenterX}
                  y={labelY + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--text-muted)"
                >
                  {bar.task.people.slice(0, 3).join(', ')}
                  {bar.task.people.length > 3 ? ` +${bar.task.people.length - 3}` : ''}
                </text>
              )}

              {/* Level 3: Waiting-for status */}
              {bar.task.status.type === 'waiting_for' && bar.task.status.waiting_for && (
                <text
                  x={barCenterX}
                  y={labelY + (bar.task.people && bar.task.people.length > 0 ? 26 : 14)}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--status-waiting)"
                  fontWeight={500}
                >
                  ממתין ל: {bar.task.status.waiting_for}
                </text>
              )}
            </g>
          );
        })}

        {/* "Now" indicator */}
        {(() => {
          const now = Date.now();
          if (now >= visibleStart && now <= visibleEnd) {
            const nowX = width - (now - visibleStart) / zoomConfig.msPerPixel;
            return (
              <line
                x1={nowX}
                y1={0}
                x2={nowX}
                y2={totalHeight}
                stroke="var(--accent-danger)"
                strokeWidth={2}
                strokeDasharray="4,4"
                opacity={0.7}
              />
            );
          }
          return null;
        })()}

        {/* Left hints */}
        {leftHints.length > 0 && (
          <g>
            <rect
              x={0}
              y={TASK_AREA_START}
              width={24}
              height={taskAreaHeight}
              fill="var(--bg-secondary)"
              opacity={0.9}
            />
            <polygon
              points={`4,${TASK_AREA_START + taskAreaHeight / 2} 12,${TASK_AREA_START + taskAreaHeight / 2 - 8} 12,${TASK_AREA_START + taskAreaHeight / 2 + 8}`}
              fill="var(--text-muted)"
            />
            <text
              x={16}
              y={TASK_AREA_START + taskAreaHeight / 2 + 4}
              fontSize="10"
              fill="var(--text-muted)"
              fontWeight={600}
            >
              {leftHints.length}
            </text>
            {leftHints.slice(0, 3).map((hint, i) => (
              <circle
                key={hint.task.id}
                cx={8}
                cy={TASK_AREA_START + taskAreaHeight + 8 + i * 10}
                r={3}
                fill={hint.color}
              />
            ))}
          </g>
        )}

        {/* Right hints */}
        {rightHints.length > 0 && (
          <g>
            <rect
              x={width - 24}
              y={TASK_AREA_START}
              width={24}
              height={taskAreaHeight}
              fill="var(--bg-secondary)"
              opacity={0.9}
            />
            <polygon
              points={`${width - 4},${TASK_AREA_START + taskAreaHeight / 2} ${width - 12},${TASK_AREA_START + taskAreaHeight / 2 - 8} ${width - 12},${TASK_AREA_START + taskAreaHeight / 2 + 8}`}
              fill="var(--text-muted)"
            />
            <text
              x={width - 20}
              y={TASK_AREA_START + taskAreaHeight / 2 + 4}
              fontSize="10"
              fill="var(--text-muted)"
              fontWeight={600}
            >
              {rightHints.length}
            </text>
            {rightHints.slice(0, 3).map((hint, i) => (
              <circle
                key={hint.task.id}
                cx={width - 8}
                cy={TASK_AREA_START + taskAreaHeight + 8 + i * 10}
                r={3}
                fill={hint.color}
              />
            ))}
          </g>
        )}

        {/* Level 2: Sub-timeline */}
        {renderSubTimeline()}
      </svg>

      {/* Task Details Modal */}
      <Modal
        isOpen={detailsModalTask !== null}
        onClose={() => setDetailsModalTask(null)}
        title={`פרטי משימה: ${detailsModalTask?.title || 'ללא שם'}`}
        size="md"
      >
        {detailsModalTask && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {/* Details */}
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                תיאור מפורט
              </label>
              <textarea
                value={localDetails}
                onChange={handleDetailsChange}
                onBlur={handleDetailsBlur}
                placeholder="הוסף תיאור מפורט..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* People */}
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                אנשים (מופרדים בפסיק)
              </label>
              <input
                type="text"
                value={localPeopleInput}
                onChange={handlePeopleChange}
                onBlur={handlePeopleBlur}
                placeholder="למשל, יוסי, שרה, דוד"
                style={{
                  width: '100%',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-xs)', display: 'block' }}>
                הערות
              </label>
              <textarea
                value={localNotes}
                onChange={handleNotesChange}
                onBlur={handleNotesBlur}
                placeholder="הוסף הערות..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Status display */}
            <div style={{
              padding: 'var(--spacing-sm)',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
            }}>
              <strong>סטטוס:</strong> {detailsModalTask.status.type.replace('_', ' ')}
              {detailsModalTask.status.type === 'waiting_for' && detailsModalTask.status.waiting_for && (
                <span style={{ color: 'var(--status-waiting)' }}> ({detailsModalTask.status.waiting_for})</span>
              )}
            </div>

            {/* Subtasks count */}
            {detailsModalTask.subtasks && detailsModalTask.subtasks.length > 0 && (
              <div style={{
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
              }}>
                <strong>תתי-משימות:</strong> {detailsModalTask.subtasks.length} תת-משימות
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
