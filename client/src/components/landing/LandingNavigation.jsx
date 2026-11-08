import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Menu, X } from 'lucide-react';

const navigationLinks = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'who-its-for', label: "Who It's For" },
  { id: 'about', label: 'About' },
];

function Brand({ onClick }) {
  return (
    <a
      href="#home"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label="EventFlow home"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
        <CalendarDays aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="text-lg font-extrabold tracking-tight text-text-primary">EventFlow</span>
    </a>
  );
}

export default function LandingNavigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 12);
    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });

    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const sections = navigationLinks
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visibleSections[0]) setActiveSection(visibleSections[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.15, 0.35, 0.6] }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen]);

  const closeMenu = () => setMobileOpen(false);

  const renderLinks = (mobile = false) => navigationLinks.map(({ id, label }) => (
    <a
      key={id}
      href={`#${id}`}
      onClick={mobile ? closeMenu : undefined}
      aria-current={activeSection === id ? 'location' : undefined}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary ${
        activeSection === id
          ? 'bg-lavender text-primary'
          : 'text-text-secondary hover:bg-background hover:text-text-primary'
      } ${mobile ? 'block w-full py-3 text-base' : ''}`}
    >
      {label}
    </a>
  ));

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-normal ${
        scrolled
          ? 'border-border bg-surface/95 shadow-xs backdrop-blur-xl'
          : 'border-transparent bg-background/80 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Brand onClick={closeMenu} />

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {renderLinks()}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <Link
            to="/login"
            className="rounded-control px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-background hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="inline-flex min-h-10 items-center gap-2 rounded-control bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-xs transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Get Started
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="landing-mobile-navigation"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-control border border-border bg-surface text-text-primary transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary lg:hidden"
        >
          {mobileOpen
            ? <X aria-hidden="true" className="h-5 w-5" />
            : <Menu aria-hidden="true" className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          id="landing-mobile-navigation"
          className="absolute inset-x-0 top-full max-h-[calc(100vh-4.5rem)] overflow-y-auto border-b border-border bg-surface px-4 pb-5 pt-3 shadow-lg sm:hidden"
        >
          <nav aria-label="Mobile navigation" className="space-y-1">
            {renderLinks(true)}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <Link
              to="/login"
              onClick={closeMenu}
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-border px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary"
            >
              Login
            </Link>
            <Link
              to="/register"
              onClick={closeMenu}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary"
            >
              Get Started
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
