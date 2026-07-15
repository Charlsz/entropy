import Button from './ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl border border-entropy-border bg-entropy-panel p-6 shadow-subtle animate-enter"
      >
        <h2 id="confirm-title" className="text-lg font-semibold tracking-[-0.02em] text-entropy-text">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-entropy-muted">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" className="min-h-10 px-4 py-2 text-sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            className={[
              'min-h-10 px-4 py-2 text-sm',
              danger
                ? 'border-red-400 bg-red-500 text-white hover:border-red-300 hover:bg-red-400'
                : ''
            ].join(' ')}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
