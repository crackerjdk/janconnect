import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onCancel();
      }}
      className="m-auto w-full max-w-md rounded-xl border border-[#E2E6EC] bg-white p-6 text-[#111827] shadow-xl backdrop:bg-slate-950/40"
    >
      <h3 className="font-display text-lg font-semibold text-[#0F2942]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">{description}</p>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#E2E6EC] rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap ${
            destructive ? 'bg-red-700 hover:bg-red-800' : 'bg-[#0F2942] hover:bg-[#163A5C]'
          } disabled:opacity-60`}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
