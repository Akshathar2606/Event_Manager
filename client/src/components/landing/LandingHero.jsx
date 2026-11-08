import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  ClipboardCheck,
  MapPin,
  UtensilsCrossed,
  Users,
} from 'lucide-react';

const previewModules = [
  { icon: CalendarDays, label: 'Event planning', detail: 'Details and schedules', color: 'bg-lavender text-primary' },
  { icon: MapPin, label: 'Venue bookings', detail: 'Requests and decisions', color: 'bg-info-50 text-info-700' },
  { icon: Users, label: 'Registrations', detail: 'Attendees and tickets', color: 'bg-success-50 text-success-700' },
  { icon: UtensilsCrossed, label: 'Catering', detail: 'Packages and requests', color: 'bg-warning-50 text-warning-700' },
];

function WorkspacePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[34rem] lg:ml-auto">
      <div aria-hidden="true" className="landing-orb absolute -inset-12 rounded-full blur-3xl" />
      <div className="landing-grid absolute -inset-4 rounded-[2rem] opacity-70" aria-hidden="true" />
      <div className="relative rounded-[1.65rem] border border-border bg-surface p-3 shadow-2xl shadow-primary/10 sm:p-4">
        <div className="flex items-center justify-between border-b border-border px-2 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary">
              <CalendarCheck2 aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-text-primary">Event workspace</p>
              <p className="text-xs text-text-muted">Your plans, in one place</p>
            </div>
          </div>
          <span className="rounded-full border border-secondary/20 bg-lavender px-2.5 py-1 text-[10px] font-semibold text-secondary">
            PREVIEW
          </span>
        </div>

        <div className="grid gap-3 pt-3 sm:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Planning board</p>
                <h2 className="mt-1 text-base font-bold tracking-tight text-text-primary">Bring it all together</h2>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {previewModules.slice(0, 3).map(({ icon: Icon, label, detail, color }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}>
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-text-primary">{label}</p>
                    <p className="truncate text-[11px] text-text-muted">{detail}</p>
                  </div>
                  <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-success" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-text-primary">A connected workflow</p>
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-secondary" />
              </div>
              <div className="mt-4 space-y-3">
                {['Create your event', 'Coordinate the details', 'Welcome your attendees'].map((step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      index === 2 ? 'bg-accent/10 text-accent' : 'bg-lavender text-primary'
                    }`}>
                      0{index + 1}
                    </span>
                    <span className="text-xs font-medium text-text-secondary">{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-primary to-secondary p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-white/75">From planning to the day</p>
                  <p className="mt-1 text-sm font-bold">One shared workspace.</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                  <CalendarDays aria-hidden="true" className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                <span className="h-1.5 w-7 rounded-full bg-white/65" />
                <span className="h-1.5 w-1.5 rounded-full bg-white/45" />
              </div>
            </div>
          </div>
        </div>
        <p className="px-2 pt-3 text-[10px] text-text-muted">
          Illustrative preview · Features shown reflect available EventFlow workflows
        </p>
      </div>
    </div>
  );
}

export default function LandingHero() {
  return (
    <section id="home" className="relative scroll-mt-24 px-4 pb-20 pt-32 sm:px-6 sm:pb-24 sm:pt-36 lg:px-8 lg:pb-28 lg:pt-40">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-gradient-to-b from-lavender/70 via-background to-background" />
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
        <div className="max-w-2xl" data-reveal>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-surface/80 px-3.5 py-2 text-xs font-semibold text-secondary shadow-xs">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/10">
              <CalendarCheck2 aria-hidden="true" className="h-3 w-3" />
            </span>
            One workspace. Every moving part.
          </div>
          <h1 className="text-[2.7rem] font-extrabold leading-[1.06] tracking-[-0.045em] text-text-primary sm:text-6xl lg:text-[4.25rem]">
            Every Great Event Begins With{' '}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              EventFlow.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-text-secondary sm:text-lg sm:leading-8">
            Plan smarter. Coordinate effortlessly. Celebrate beautifully. Bring every part of your event together with one powerful event management platform.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-primary px-6 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Get Started
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control border border-border bg-surface px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-primary/30 hover:bg-lavender/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary"
            >
              Explore Features
              <ArrowDown aria-hidden="true" className="h-4 w-4 text-secondary" />
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-text-muted">
            <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="h-3.5 w-3.5 text-success" />Events and venues</span>
            <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="h-3.5 w-3.5 text-success" />Bookings and registrations</span>
            <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="h-3.5 w-3.5 text-success" />Catering coordination</span>
          </div>
        </div>

        <div data-reveal>
          <WorkspacePreview />
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-7xl border-t border-border/70 pt-6 sm:mt-20">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Designed for the people behind every successful event
        </p>
      </div>
    </section>
  );
}
