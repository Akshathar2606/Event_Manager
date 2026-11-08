import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  Check,
  Compass,
  Layers3,
  MapPin,
  ShieldCheck,
  Sparkles,
  Ticket,
  UtensilsCrossed,
  UsersRound,
  Workflow,
} from 'lucide-react';

const features = [
  {
    icon: CalendarDays,
    title: 'Event Management',
    description: 'Create events, shape the details, manage schedules, and follow each event through its lifecycle.',
    tone: 'bg-lavender text-primary',
  },
  {
    icon: Building2,
    title: 'Venue Management',
    description: 'Explore venue information and facilities, then coordinate a booking request for your event.',
    tone: 'bg-info-50 text-info-700',
  },
  {
    icon: CalendarCheck2,
    title: 'Booking Workflows',
    description: 'Submit venue requests and keep track of their review and booking status in one place.',
    tone: 'bg-accent/10 text-accent-text',
  },
  {
    icon: Ticket,
    title: 'Registrations & Attendees',
    description: 'Let participants discover events and register, while organizers keep attendee information close at hand.',
    tone: 'bg-success-50 text-success-700',
  },
  {
    icon: UtensilsCrossed,
    title: 'Catering Coordination',
    description: 'Browse catering packages, send event requests, and manage responses between organizers and vendors.',
    tone: 'bg-warning-50 text-warning-700',
  },
  {
    icon: Workflow,
    title: 'Event Lifecycle',
    description: 'Keep upcoming, ongoing, completed, and cancelled events distinguishable across event views.',
    tone: 'bg-secondary/10 text-secondary',
  },
];

const steps = [
  {
    number: '01',
    title: 'Create',
    description: 'Set up your event, share the essentials, and define the schedule and requirements.',
    icon: CalendarDays,
  },
  {
    number: '02',
    title: 'Organise',
    description: 'Coordinate venues, booking decisions, attendee registrations, and catering requests.',
    icon: Layers3,
  },
  {
    number: '03',
    title: 'Celebrate',
    description: 'Keep the right event details and people connected as the day arrives and history builds.',
    icon: Sparkles,
  },
];

const audiences = [
  {
    icon: CalendarDays,
    title: 'Organizers',
    description: 'Create events and coordinate venues, bookings, attendees, and catering activities.',
    tone: 'bg-lavender text-primary',
  },
  {
    icon: UtensilsCrossed,
    title: 'Vendors',
    description: 'Maintain a catering profile, manage food packages, and respond to incoming event requests.',
    tone: 'bg-warning-50 text-warning-700',
  },
  {
    icon: Compass,
    title: 'Participants',
    description: 'Discover published events, manage registrations, and revisit event information.',
    tone: 'bg-success-50 text-success-700',
  },
  {
    icon: ShieldCheck,
    title: 'Administrators',
    description: 'Oversee event operations, venue information, booking requests, and user access.',
    tone: 'bg-info-50 text-info-700',
  },
];

function SectionHeading({ eyebrow, title, description, centered = false }) {
  return (
    <div className={`max-w-2xl ${centered ? 'mx-auto text-center' : ''}`}>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-secondary">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.035em] text-text-primary sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description && <p className="mt-4 text-base leading-7 text-text-secondary">{description}</p>}
    </div>
  );
}

export default function LandingSections() {
  return (
    <>
      <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8" data-reveal>
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <SectionHeading
              eyebrow="The EventFlow platform"
              title="Everything You Need to Bring Events to Life."
              description="From the first event details to the people and services that make it happen, keep the moving parts connected."
            />
            <a href="#how-it-works" className="inline-flex min-h-10 items-center gap-2 self-start text-sm font-semibold text-primary transition-colors hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-primary md:self-auto">
              See how it works <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description, tone }) => (
              <article
                key={title}
                className="group rounded-card border border-border bg-surface p-6 shadow-xs transition-all duration-normal hover:-translate-y-1 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold tracking-tight text-text-primary">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
                <span aria-hidden="true" className="mt-5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-text-muted transition-all group-hover:translate-x-1 group-hover:border-primary/30 group-hover:text-primary">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 border-y border-border bg-surface px-4 py-20 sm:px-6 sm:py-24 lg:px-8" data-reveal>
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            centered
            eyebrow="A clearer way to plan"
            title="From Planning to Celebration."
            description="A connected flow helps each stakeholder know what to do next, without scattering the event across disconnected tools."
          />
          <div className="relative mt-14 grid gap-8 md:grid-cols-3 md:gap-6">
            <div aria-hidden="true" className="absolute left-[17%] right-[17%] top-7 hidden border-t border-dashed border-secondary/30 md:block" />
            {steps.map(({ number, title, description, icon: Icon }) => (
              <article key={number} className="relative flex gap-4 md:flex-col md:items-center md:text-center">
                <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-secondary/20 bg-lavender text-primary shadow-xs">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <div className="md:mt-2">
                  <p className="text-xs font-bold tracking-[0.14em] text-secondary">{number} — {title.toUpperCase()}</p>
                  <h3 className="mt-2 text-xl font-bold tracking-tight text-text-primary">{title} with clarity.</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="who-its-for" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8" data-reveal>
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Made for the whole team"
            title="One Platform. Every Event Stakeholder."
            description="Role-specific workspaces bring organizers, vendors, participants, and administrators into the same event ecosystem."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {audiences.map(({ icon: Icon, title, description, tone }) => (
              <article key={title} className="rounded-card border border-border bg-surface p-6 shadow-xs transition-all duration-normal hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-text-primary">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-text-muted">
            Public registration is available for participants and organizers. Administrator and vendor access follows the existing account authorization process.
          </p>
        </div>
      </section>

      <section id="about" className="scroll-mt-24 border-y border-border bg-surface px-4 py-20 sm:px-6 sm:py-24 lg:px-8" data-reveal>
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="Why EventFlow"
              title="Event Management Without the Chaos."
              description="EventFlow brings the operational details into one place, so teams can spend less time chasing updates and more time making the event matter."
            />
            <ul className="mt-8 space-y-4">
              {[
                'Centralise event details and schedules.',
                'Keep venue booking requests and decisions organised.',
                'Connect organizers, attendees, and catering vendors.',
                'See lifecycle information in role-specific workspaces.',
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm leading-6 text-text-secondary">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700">
                    <Check aria-hidden="true" className="h-3 w-3" />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-gradient-to-br from-lavender via-transparent to-accent/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-background p-5 shadow-xl shadow-primary/5 sm:p-7">
              <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Connected operations</p>
                  <h3 className="mt-1 text-lg font-bold text-text-primary">One event, many details.</h3>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
                  <Workflow aria-hidden="true" className="h-5 w-5" />
                </span>
              </div>
              <div className="relative mt-5 space-y-3">
                <div aria-hidden="true" className="absolute bottom-8 left-[1.125rem] top-8 border-l border-dashed border-secondary/30" />
                {[
                  { icon: CalendarDays, title: 'Event details', detail: 'Schedule, status, and information', tone: 'bg-lavender text-primary' },
                  { icon: MapPin, title: 'Venue coordination', detail: 'Availability and booking workflow', tone: 'bg-info-50 text-info-700' },
                  { icon: UsersRound, title: 'People and registrations', detail: 'Participant and attendee records', tone: 'bg-success-50 text-success-700' },
                  { icon: UtensilsCrossed, title: 'Catering requests', detail: 'Packages, vendors, and responses', tone: 'bg-warning-50 text-warning-700' },
                ].map(({ icon: Icon, title, detail, tone }) => (
                  <div key={title} className="relative flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5">
                    <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{detail}</p>
                    </div>
                    <Check aria-hidden="true" className="ml-auto h-4 w-4 shrink-0 text-success" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="get-started" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-24 lg:px-8" data-reveal>
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-secondary px-6 py-12 text-center shadow-xl shadow-primary/20 sm:px-12 sm:py-16 lg:px-20">
          <div aria-hidden="true" className="absolute -right-20 -top-32 h-80 w-80 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -bottom-48 -left-20 h-96 w-96 rounded-full border border-white/10" />
          <div className="relative mx-auto max-w-3xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/70">Make room for what matters</p>
            <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.035em] text-white sm:text-5xl">
              Your Next Great Event Starts Here.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/80">
              Bring your people, plans and possibilities together with EventFlow.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              Get Started Today
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
