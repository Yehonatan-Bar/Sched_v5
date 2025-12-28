import { useEffect, useCallback, useRef, CSSProperties, ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 'var(--spacing-md)',
    overflow: 'auto', // Allow scrolling if modal is taller than viewport
  },
  modal: {
    backgroundColor: 'var(--bg-primary)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--spacing-md) var(--spacing-lg)',
    borderBottom: '1px solid var(--border-light)',
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    fontSize: 'var(--font-size-lg)',
  },
  content: {
    padding: 'var(--spacing-lg)',
    overflowY: 'auto',
    flex: 1,
    minHeight: 0, // Required for flex child to scroll properly
  },
};

const sizeStyles: Record<string, CSSProperties> = {
  sm: { width: '100%', maxWidth: '400px' },
  md: { width: '100%', maxWidth: '600px' },
  lg: { width: '100%', maxWidth: '800px' },
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Handle click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Track if we've already focused on open
  const hasFocusedRef = useRef(false);

  // Reset focus tracking when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasFocusedRef.current = false;
    }
  }, [isOpen]);

  // Set up keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      // Focus the modal only on initial open, not on every re-render
      if (!hasFocusedRef.current) {
        modalRef.current?.focus();
        hasFocusedRef.current = true;
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        style={{ ...styles.modal, ...sizeStyles[size] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
      >
        {title && (
          <div style={styles.header}>
            <h2 id="modal-title" style={styles.title}>
              {title}
            </h2>
            <button
              style={styles.closeButton}
              onClick={onClose}
              aria-label="סגור חלון"
              title="סגור (Esc)"
            >
              &times;
            </button>
          </div>
        )}
        <div style={styles.content}>{children}</div>
      </div>
    </div>
  );
}
