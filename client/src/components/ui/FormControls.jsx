import React, { cloneElement, isValidElement, useId } from 'react';
import { Search, X } from 'lucide-react';

const controlClasses = 'min-h-10 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-focus-primary/20 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-70 aria-[invalid=true]:border-error aria-[invalid=true]:focus:ring-error/20';

export function Input({ className = '', ...props }) {
  return <input className={`${controlClasses} ${className}`} {...props} />;
}

export function Textarea({ className = '', rows = 4, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`${controlClasses} min-h-24 resize-y ${className}`}
      {...props}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${controlClasses} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function SearchField({
  className = '',
  value,
  onClear,
  'aria-label': ariaLabel = 'Search',
  ...props
}) {
  return (
    <div className={`relative ${className}`}>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      <Input
        type="search"
        value={value}
        aria-label={ariaLabel}
        className={`pl-9 ${onClear && value ? 'pr-10' : ''}`}
        {...props}
      />
      {onClear && value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-background hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function FormField({
  id,
  htmlFor,
  label,
  required = false,
  description,
  error,
  className = '',
  children,
}) {
  const generatedId = useId();
  const controlId = htmlFor || id || (isValidElement(children) ? children.props.id : undefined) || generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || controlId,
        required: required || children.props.required,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
      })
    : children;

  return (
    <div className={`min-w-0 space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={controlId} className="inline-flex items-center gap-1 text-sm font-medium text-text-primary">
          {label}
          {required && <span aria-hidden="true" className="text-error">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      {control}
      {description && <p id={descriptionId} className="text-xs leading-relaxed text-text-muted">{description}</p>}
      {error && <p id={errorId} role="alert" className="text-xs font-medium text-error">{error}</p>}
    </div>
  );
}
