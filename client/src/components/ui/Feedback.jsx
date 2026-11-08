import React, { useEffect, useId, useRef } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  Info,
  Loader2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Button } from './Button';

export function EmptyState({
  icon: Icon = CircleHelp,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center px-5 py-12 text-center ${className}`}>
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-lavender text-primary">
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {description && <p className="mt-1 max-w-md text-sm leading-relaxed text-text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading...', className = '' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 px-5 py-12 text-text-muted ${className}`}
    >
      <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin text-primary motion-reduce:animate-none" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function Skeleton({ variant = 'text', className = '', width, height, ...props }) {
  const variantClasses = {
    text: 'h-4 w-full rounded-md',
    title: 'h-6 w-2/3 rounded-md',
    avatar: 'h-10 w-10 rounded-full',
    card: 'min-h-32 w-full rounded-card',
    control: 'h-10 w-full rounded-control',
  };
  const style = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };

  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-surface-muted motion-reduce:animate-none ${variantClasses[variant] || variantClasses.text} ${className}`}
      style={style}
      {...props}
    />
  );
}

const alertVariants = {
  success: {
    icon: CheckCircle2,
    classes: 'border-success-200 bg-success-50 text-success-800',
  },
  warning: {
    icon: TriangleAlert,
    classes: 'border-warning-200 bg-warning-50 text-warning-800',
  },
  error: {
    icon: AlertCircle,
    classes: 'border-error-200 bg-error-50 text-error-800',
  },
  info: {
    icon: Info,
    classes: 'border-info-200 bg-info-50 text-info-800',
  },
};

export function Alert({
  variant = 'info',
  title,
  className = '',
  onDismiss,
  children,
  ...props
}) {
  const alert = alertVariants[variant] || alertVariants.info;
  const Icon = alert.icon;

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-card border p-4 text-sm ${alert.classes} ${className}`}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss message"
          onClick={onDismiss}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-75 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  confirmLoading = false,
  confirmDisabled = false,
  onConfirm,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const closeDialog = () => {
    if (onOpenChange) onOpenChange(false);
    else dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange?.(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
      className="w-[calc(100%-2rem)] max-w-lg rounded-panel border border-border bg-surface p-0 text-text-primary shadow-2xl backdrop:bg-overlay/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">{title}</h2>
            {description && <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-text-muted">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={closeDialog}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-background hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={closeDialog}>{cancelLabel}</Button>
          <Button
            variant={confirmVariant}
            loading={confirmLoading}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
