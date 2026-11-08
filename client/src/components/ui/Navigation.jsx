import React, { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export function Tabs({
  tabs,
  value,
  onChange,
  label = 'Sections',
  className = '',
}) {
  const generatedId = useId().replace(/:/g, '');
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.value === value));

  const handleKeyDown = (event) => {
    const enabledTabs = tabs.filter((tab) => !tab.disabled);
    if (!enabledTabs.length) return;
    const currentIndex = enabledTabs.findIndex((tab) => tab.value === value);
    let nextIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % enabledTabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = enabledTabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = enabledTabs[nextIndex];
    onChange?.(nextTab.value);
    document.getElementById(`${generatedId}-tab-${nextTab.value}`)?.focus();
  };

  const activeTab = tabs.find((tab) => tab.value === value);

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="relative flex max-w-full gap-1 overflow-x-auto border-b border-border scrollbar-none"
      >
        {tabs.map((tab) => {
          const selected = tab.value === value;
          const tabId = `${generatedId}-tab-${tab.value}`;
          return (
            <button
              key={tab.value}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tabId}-panel`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange?.(tab.value)}
              className={`relative inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-control px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 ${
                selected ? 'text-primary' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.icon && <tab.icon aria-hidden="true" className="h-4 w-4" />}
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-text-muted">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
        <span
          aria-hidden="true"
          className="absolute bottom-0 h-0.5 bg-primary transition-transform duration-normal motion-reduce:transition-none"
          style={{
            left: 0,
            width: `${tabs.length ? 100 / tabs.length : 0}%`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      </div>
      {activeTab && (
        <div
          id={`${generatedId}-tab-${activeTab.value}-panel`}
          role="tabpanel"
          aria-labelledby={`${generatedId}-tab-${activeTab.value}`}
          tabIndex={0}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary"
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  className = '',
  label = 'Pagination',
}) {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);
  const safePage = Math.min(safeTotalPages, Math.max(1, Number(page) || 1));

  if (safeTotalPages <= 1) return null;

  return (
    <nav aria-label={label} className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <p className="text-sm text-text-muted" aria-live="polite">
        Page <span className="font-semibold text-text-primary">{safePage}</span> of{' '}
        <span className="font-semibold text-text-primary">{safeTotalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label="Go to previous page"
          disabled={safePage <= 1}
          onClick={() => onPageChange?.(safePage - 1)}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Go to next page"
          disabled={safePage >= safeTotalPages}
          onClick={() => onPageChange?.(safePage + 1)}
        >
          Next
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
