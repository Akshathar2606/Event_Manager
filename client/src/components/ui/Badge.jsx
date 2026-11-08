import React from 'react';

const badgeVariants = {
  primary: 'border-primary/15 bg-primary/10 text-primary',
  secondary: 'border-secondary/15 bg-lavender text-secondary',
  accent: 'border-accent/20 bg-accent/10 text-accent-text',
  success: 'border-success-200 bg-success-50 text-success-800',
  warning: 'border-warning-200 bg-warning-50 text-warning-800',
  error: 'border-error-200 bg-error-50 text-error-800',
  info: 'border-info-200 bg-info-50 text-info-800',
  neutral: 'border-border bg-background text-text-secondary',
};

const statusVariants = {
  upcoming: 'info',
  ongoing: 'success',
  completed: 'neutral',
  pending: 'warning',
  approved: 'success',
  published: 'success',
  rejected: 'error',
  cancelled: 'neutral',
  canceled: 'neutral',
  draft: 'secondary',
};

export function Badge({ variant, status, className = '', children, ...props }) {
  const resolvedVariant = variant || statusVariants[String(status || '').toLowerCase()] || 'neutral';

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${badgeVariants[resolvedVariant] || badgeVariants.neutral} ${className}`}
      {...props}
    >
      {children ?? status}
    </span>
  );
}
