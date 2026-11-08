import React from 'react';

const cardVariants = {
  default: 'border border-border bg-surface shadow-xs',
  interactive: 'border border-border bg-surface shadow-xs transition-all duration-normal hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md',
  statistic: 'border border-border bg-surface shadow-xs',
  feature: 'border border-border bg-surface shadow-xs transition-all duration-normal hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5',
  dashboard: 'border border-border bg-surface shadow-xs',
};

export function Card({
  as: Component = 'div',
  variant = 'default',
  className = '',
  children,
  ...props
}) {
  return (
    <Component
      className={`rounded-card ${cardVariants[variant] || cardVariants.default} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return <div className={`flex flex-col gap-1.5 p-5 sm:p-6 ${className}`} {...props}>{children}</div>;
}

export function CardTitle({ className = '', as: Component = 'h2', children, ...props }) {
  return <Component className={`text-base font-semibold tracking-tight text-text-primary ${className}`} {...props}>{children}</Component>;
}

export function CardDescription({ className = '', children, ...props }) {
  return <p className={`text-sm leading-relaxed text-text-muted ${className}`} {...props}>{children}</p>;
}

export function CardContent({ className = '', children, ...props }) {
  return <div className={`px-5 pb-5 sm:px-6 sm:pb-6 ${className}`} {...props}>{children}</div>;
}

export function CardFooter({ className = '', children, ...props }) {
  return <div className={`flex items-center gap-2 border-t border-border px-5 py-4 sm:px-6 ${className}`} {...props}>{children}</div>;
}
