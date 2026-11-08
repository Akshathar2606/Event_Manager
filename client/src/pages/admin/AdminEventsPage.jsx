import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Calendar, Loader2, Users } from 'lucide-react';
import { eventService, extractErrorMessage } from '../../services/eventService';

const EVENT_FILTERS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' }
];

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
};

export default function AdminEventsPage() {
  const [activeFilter, setActiveFilter] = useState('upcoming');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const response = await eventService.getEvents({ status: activeFilter, limit: 100 });
      setEvents(response.data || []);
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Failed to load events.'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    const refreshEvents = () => fetchEvents(false);
    const timer = setInterval(refreshEvents, 60_000);
    window.addEventListener('focus', refreshEvents);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshEvents);
    };
  }, [fetchEvents]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border bg-surface p-6 shadow-xs">
        <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">Event Management</h1>
        <p className="mt-1 text-sm text-text-muted">
          Review event schedules, lifecycle status, venue assignments, and attendee history.
        </p>
      </header>

      <nav aria-label="Filter events by lifecycle" className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-border bg-surface p-4 shadow-xs">
        {EVENT_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
            aria-pressed={activeFilter === filter.id}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeFilter === filter.id
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-text-secondary hover:bg-surface-subtle'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={fetchEvents} className="ml-auto font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-xs">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-rose-600" />
          <p className="text-xs font-medium text-text-muted">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center shadow-xs">
          <p className="font-semibold text-text-primary">No {activeFilter} events found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const venue = typeof event.venue === 'object' && event.venue ? event.venue : null;
            return (
              <article key={event.id} className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                        {event.category}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-semibold capitalize text-text-secondary">
                        {event.lifecycleStatus || event.status}
                      </span>
                    </div>
                    <h2 className="mt-2 truncate text-base font-bold text-text-primary">{event.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-text-muted" />
                        {formatDate(event.startDateTime)}
                      </span>
                      <span>{venue?.name || 'Venue Unassigned'}{venue?.location ? ` · ${venue.location}` : ''}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-text-muted" />
                        {event.registeredCount || 0} / {event.capacity} attendees
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/organizer/events/${event.id}/attendees`}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <Users className="h-3.5 w-3.5" />
                    View Attendees
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
