import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

function BreadcrumbItem({ item, last }) {
  const content = item.to
    ? <Link to={item.to} className="rounded-sm hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary">{item.label}</Link>
    : item.href
      ? <a href={item.href} className="rounded-sm hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary">{item.label}</a>
      : item.label;

  return (
    <li className={`flex min-w-0 items-center gap-1.5 ${last ? 'text-text-primary' : 'text-text-muted'}`}>
      {content}
    </li>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  className = '',
}) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {breadcrumbs?.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={`${item.label}-${index}`}>
                  {index > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-muted" />}
                  <BreadcrumbItem item={item} last={index === breadcrumbs.length - 1} />
                </React.Fragment>
              ))}
            </ol>
          </nav>
        )}
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
