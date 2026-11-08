import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays } from 'lucide-react';

const platformLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#who-its-for', label: "Who It's For" },
  { href: '#about', label: 'About EventFlow' },
];

function FooterAnchor({ href, children }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-8 items-center text-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary"
    >
      {children}
    </a>
  );
}

export default function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface px-4 pb-8 pt-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <a href="#home" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary" aria-label="EventFlow home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary">
              <CalendarDays aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-text-primary">EventFlow</span>
          </a>
          <p className="mt-4 max-w-sm text-sm leading-6 text-text-muted">
            Plan smarter, coordinate effortlessly, and bring every part of your event together in one workspace.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary">Explore</h2>
          <ul className="mt-3 space-y-1">
            {platformLinks.map(({ href, label }) => (
              <li key={href}><FooterAnchor href={href}>{label}</FooterAnchor></li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary">Your workspace</h2>
          <ul className="mt-3 space-y-1">
            <li>
              <Link to="/login" className="inline-flex min-h-8 items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary">
                Login <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </li>
            <li>
              <Link to="/register" className="inline-flex min-h-8 items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary">
                Register <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-border pt-5 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} EventFlow. All rights reserved.</p>
        <p>Thoughtful tools for better event coordination.</p>
      </div>
    </footer>
  );
}
