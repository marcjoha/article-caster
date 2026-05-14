'use client';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="card" style={{ padding: '2rem', width: '100%', maxWidth: '500px', position: 'relative', textAlign: 'left' }}>
        <h2 style={{ marginTop: 0, color: '#ef4444' }}>{title}</h2>
        <p style={{ marginBottom: '2rem', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            className="btn"
            style={{ backgroundColor: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)' }}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn"
            style={{ backgroundColor: '#ef4444' }}
            disabled={isLoading}
          >
            {isLoading ? `${confirmLabel.replace(/e$/, '')}ing...` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
