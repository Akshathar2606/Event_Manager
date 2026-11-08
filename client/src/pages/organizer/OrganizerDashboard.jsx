import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Users,
  UtensilsCrossed
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { cateringRequestService } from '../../services/cateringRequestService';
import { eventService, extractErrorMessage } from '../../services/eventService';
import EventActivityTimeline from '../../components/events/EventActivityTimeline';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  LoadingState,
  PageHeader,
  Skeleton
} from '../../components/ui';

const EVENT_PAGE_SIZE = 100;
const ACTIVITY_EVENT_LIMIT = 8;
const ACTIVITY_PAGE_SIZE = 20;

const statisticCards = [
  { key: 'total', label: 'Total events', icon: CalendarDays, color: 'text-[#4C1D95]', iconBg: 'bg-purple-50' },
  { key: 'upcoming', label: 'Upcoming', icon: Clock3, color: 'text-[#7C3AED]', iconBg: 'bg-violet-50' },
  { key: 'ongoing', label: 'Ongoing', icon: Activity, color: 'text-[#EC4899]', iconBg: 'bg-pink-50' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-[#B77900]', iconBg: 'bg-amber-50' }
];

const getEventId = (event) => event?.id || event?._id;
const getLifecycleStatus = (event) => event?.lifecycleStatus || event?.status;

const formatDate = (value, options = {}) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Date to be confirmed';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  }).format(date);
};

const formatEventDate = (value) => formatDate(value, {
  hour: 'numeric',
  minute: '2-digit'
});

const getResponseTotal = (response) => {
  const total = Number(response?.pagination?.total);
  return Number.isFinite(total) && total >= 0
    ? total
    : (response?.data || []).length;
};

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getEventPages = async () => {
  const firstPage = await eventService.getEvents({
    organizer: 'me',
    page: 1,
    limit: EVENT_PAGE_SIZE
  });
  const pageCount = Math.max(1, Number(firstPage.pagination?.pages) || 1);
  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => eventService.getEvents({
      organizer: 'me',
      page: index + 2,
      limit: EVENT_PAGE_SIZE
    }))
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.data || []);
};

const getRecentEventActivity = async (events) => {
  const activeEvents = [...events]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .slice(0, ACTIVITY_EVENT_LIMIT);

  const activityResults = await Promise.allSettled(activeEvents.map(async (event) => {
    const eventId = getEventId(event);
    if (!eventId) return [];
    const firstPage = await eventService.getEventActivity(eventId, {
      page: 1,
      limit: ACTIVITY_PAGE_SIZE
    });
    const lastPage = Number(firstPage.pagination?.pages) || 1;
    const latestPage = lastPage > 1
      ? await eventService.getEventActivity(eventId, { page: lastPage, limit: ACTIVITY_PAGE_SIZE })
      : firstPage;
    return (latestPage.data || []).map((activity) => ({
      ...activity,
      eventId,
      eventTitle: event.title || 'Event'
    }));
  }));
  const activities = activityResults.flatMap((result) => (
    result.status === 'fulfilled' ? result.value : []
  ));
  const failedCount = activityResults.filter((result) => result.status === 'rejected').length;
  activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { activities: activities.slice(0, 8), failedCount };
};

function StatCard({ stat, count, loading }) {
  const Icon = stat.icon;
  return (
    <Card
      as={Link}
      to="/organizer/events"
      aria-label={`View My Events: ${stat.label}`}
      className="group min-w-0 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${stat.iconBg} ${stat.color}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <ChevronRight aria-hidden="true" className="mt-1 h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500" />
      </div>
      {loading ? (
        <Skeleton variant="title" className="mt-5 h-8 w-16" />
      ) : (
        <p className="mt-4 text-3xl font-bold tracking-tight text-text-primary">{count}</p>
      )}
      <p className="mt-1 text-sm font-medium text-text-muted">{stat.label}</p>
    </Card>
  );
}

function SectionHeading({ title, description, to, actionLabel }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight text-text-primary">{title}</h2>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {to && (
        <Link
          to={to}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#6D28D9] transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {actionLabel}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function DashboardError({ children, onRetry }) {
  return (
    <Alert variant="error" className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{children}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    </Alert>
  );
}

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [pendingBookingCount, setPendingBookingCount] = useState(0);
  const [pendingCateringCount, setPendingCateringCount] = useState(0);
  const [activities, setActivities] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [eventsError, setEventsError] = useState('');
  const [requestsError, setRequestsError] = useState('');
  const [activityError, setActivityError] = useState('');

  const loadDashboard = useCallback(async () => {
    setEventsLoading(true);
    setRequestsLoading(true);
    setActivityLoading(true);
    setEventsError('');
    setRequestsError('');
    setActivityError('');

    const requestsPromise = Promise.allSettled([
      bookingService.getBookings({ status: 'pending', limit: 100 }),
      cateringRequestService.getOrganizerCateringRequests({ status: 'pending', page: 1, limit: 100 })
    ]);
    const eventResult = await getEventPages()
      .then((data) => ({ status: 'fulfilled', data }))
      .catch((error) => ({ status: 'rejected', error }));
    let activityPromise = Promise.resolve(null);
    if (eventResult.status === 'fulfilled') {
      setEvents(eventResult.data);
      setEventsLoading(false);

      setActivityLoading(true);
      activityPromise = getRecentEventActivity(eventResult.data)
        .then((data) => ({ status: 'fulfilled', data }))
        .catch((error) => ({ status: 'rejected', error }));
    } else {
      setEvents([]);
      setEventsError(extractErrorMessage(eventResult.error, 'Your events could not be loaded.'));
      setEventsLoading(false);
      setActivities([]);
      setActivityError('Activity is unavailable until your events can be loaded.');
      setActivityLoading(false);
    }

    const [bookingsResult, cateringResult] = await requestsPromise;
    if (bookingsResult.status === 'fulfilled') {
      setPendingBookingCount(getResponseTotal(bookingsResult.value));
    } else {
      setPendingBookingCount(0);
      setRequestsError(extractErrorMessage(bookingsResult.reason, 'Pending venue requests could not be loaded.'));
    }
    if (cateringResult.status === 'fulfilled') {
      setPendingCateringCount(getResponseTotal(cateringResult.value));
    } else {
      setPendingCateringCount(0);
      setRequestsError((current) => current
        ? `${current} Pending catering requests could not be loaded.`
        : extractErrorMessage(cateringResult.reason, 'Pending catering requests could not be loaded.'));
    }
    setRequestsLoading(false);

    if (eventResult.status === 'fulfilled') {
      const activityResult = await activityPromise;
      if (activityResult.status === 'fulfilled') {
        setActivities(activityResult.data.activities);
        if (activityResult.data.failedCount > 0) {
          setActivityError('Some event activity could not be loaded. The list may be incomplete.');
        }
      } else {
        setActivities([]);
        setActivityError(extractErrorMessage(activityResult.error, 'Recent event activity could not be loaded.'));
      }
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const counts = useMemo(() => events.reduce((result, event) => {
    result.total += 1;
    const status = getLifecycleStatus(event);
    if (status === 'upcoming') result.upcoming += 1;
    if (status === 'ongoing') result.ongoing += 1;
    if (status === 'completed') result.completed += 1;
    return result;
  }, { total: 0, upcoming: 0, ongoing: 0, completed: 0 }), [events]);

  const upcomingEvents = useMemo(() => events
    .filter((event) => getLifecycleStatus(event) === 'upcoming')
    .sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime))
    .slice(0, 4), [events]);

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'Organizer';

  return (
    <div className="mx-auto w-full max-w-[1440px] min-w-0 space-y-8 pb-8">
      <section className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#4C1D95] via-[#6D28D9] to-[#EC4899] px-5 py-7 text-white shadow-lg shadow-violet-950/10 sm:px-8 sm:py-9 lg:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/4 h-56 w-56 rounded-full bg-pink-300/20 blur-3xl" />
        <div className="relative flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            eyebrow="Organizer workspace"
            title={`${getGreeting()}, ${firstName}!`}
            description={user?.organization
              ? `Here's what's happening with your events at ${user.organization}.`
              : "Here's what's happening with your events."}
            className="!items-start [&_h1]:text-white [&_p]:max-w-2xl [&_p]:text-violet-100 [&_h1]:text-3xl sm:[&_h1]:text-4xl [&_p]:text-sm sm:[&_p]:text-base"
          />
          <div className="flex shrink-0 flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            {user?.organization && (
              <Badge className="max-w-full truncate border-white/20 bg-white/10 text-white">
                {user.organization}
              </Badge>
            )}
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/organizer/events')}
              className="!border-white !bg-white !text-[#4C1D95] shadow-sm hover:!bg-violet-50 focus-visible:ring-white"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Create event
            </Button>
          </div>
        </div>
      </section>

      <section aria-label="Event statistics">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-text-primary">Your event overview</h2>
            <p className="mt-1 text-sm text-text-muted">A live snapshot of your managed events.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDashboard}
            loading={eventsLoading || requestsLoading}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        {eventsError ? (
          <DashboardError onRetry={loadDashboard}>{eventsError}</DashboardError>
        ) : (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statisticCards.map((stat) => (
              <StatCard
                key={stat.key}
                stat={stat}
                count={counts[stat.key]}
                loading={eventsLoading}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
        <section className="min-w-0 space-y-4">
          <SectionHeading
            title="Upcoming events"
            description="The next dates on your event calendar."
            to="/organizer/events"
            actionLabel="View all"
          />
          <Card className="min-w-0 overflow-hidden">
            {eventsLoading ? (
              <div role="status" aria-label="Loading upcoming events" className="space-y-3 p-4 sm:p-5">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="flex gap-4 rounded-2xl border border-border p-4">
                    <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton variant="title" />
                      <Skeleton className="w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : eventsError ? (
              <EmptyState
                icon={CircleAlert}
                title="Events unavailable"
                description="Retry to load your event calendar."
                action={<Button variant="outline" size="sm" onClick={loadDashboard}>Retry</Button>}
              />
            ) : upcomingEvents.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming events"
                description="Published events with an upcoming start date will appear here."
                action={<Button size="sm" onClick={() => navigate('/organizer/events')}><Plus aria-hidden="true" className="h-4 w-4" />Create event</Button>}
              />
            ) : (
              <div className="divide-y divide-border">
                {upcomingEvents.map((event) => {
                  const venue = typeof event.venue === 'object' && event.venue
                    ? event.venue.name
                    : '';
                  const eventId = getEventId(event);
                  return (
                    <article key={eventId} className="flex min-w-0 flex-col gap-4 p-4 transition-colors hover:bg-violet-50/40 sm:flex-row sm:items-center sm:px-5">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-50 text-[#6D28D9]">
                          <CalendarDays aria-hidden="true" className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h3 className="max-w-full truncate text-sm font-bold text-text-primary">{event.title || 'Untitled event'}</h3>
                            <Badge status={getLifecycleStatus(event)} />
                          </div>
                          <div className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                              {formatEventDate(event.startDateTime)}
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-pink-500" />
                              <span className="truncate">{venue || 'Venue not assigned'}</span>
                            </span>
                            {event.registeredCount !== null &&
                              event.registeredCount !== undefined &&
                              Number.isFinite(Number(event.registeredCount)) && (
                              <span className="inline-flex items-center gap-1.5">
                                <Users aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                                {Number(event.registeredCount)} registered
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Link
                        to="/organizer/events"
                        aria-label={`View ${event.title || 'event'} in My Events`}
                        className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 self-start rounded-lg border border-violet-200 px-3 text-xs font-semibold text-[#6D28D9] transition-colors hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:self-center"
                      >
                        View event
                        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        <section className="min-w-0 space-y-4">
          <SectionHeading title="Needs your attention" description="Requests that are waiting for a response." />
          <Card className="min-w-0">
            <CardContent className="space-y-3 pt-5">
              {requestsLoading ? (
                <div role="status" aria-label="Loading pending requests" className="space-y-3">
                  <Skeleton variant="card" className="min-h-20" />
                  <Skeleton variant="card" className="min-h-20" />
                </div>
              ) : (
                <>
                  {requestsError && <Alert variant="error">{requestsError}</Alert>}
                  {!requestsError && pendingBookingCount === 0 && pendingCateringCount === 0 ? (
                    <EmptyState
                      icon={CheckCircle2}
                      title="You're all caught up"
                      description="There are no pending venue or catering responses."
                      className="py-7"
                    />
                  ) : (
                    <>
                      {pendingBookingCount > 0 && (
                        <Link to="/organizer/bookings" className="group flex min-w-0 items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 transition-colors hover:border-amber-200 hover:bg-amber-50">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                            <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text-primary">Venue requests pending</span>
                            <span className="mt-0.5 block text-xs text-text-muted">Waiting for an administrator's decision</span>
                          </span>
                          <Badge variant="warning">{pendingBookingCount}</Badge>
                          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      )}
                      {pendingCateringCount > 0 && (
                        <Link to="/organizer/catering-requests" className="group flex min-w-0 items-center gap-3 rounded-2xl border border-pink-100 bg-pink-50/60 p-4 transition-colors hover:border-pink-200 hover:bg-pink-50">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-pink-600 shadow-sm">
                            <UtensilsCrossed aria-hidden="true" className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-text-primary">Catering responses pending</span>
                            <span className="mt-0.5 block text-xs text-text-muted">Awaiting a response from the vendor</span>
                          </span>
                          <Badge className="border-pink-200 bg-surface text-pink-700">{pendingCateringCount}</Badge>
                          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      )}
                    </>
                  )}
                  {requestsError && (
                    <Button size="sm" variant="outline" onClick={loadDashboard}>
                      <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <section className="space-y-4">
        <SectionHeading title="Quick actions" description="Jump straight into your next task." />
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card as={Link} to="/organizer/events" className="group flex min-w-0 items-center gap-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4C1D95] to-[#7C3AED] text-white shadow-sm">
              <Plus aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-text-primary">Create event</span>
              <span className="mt-0.5 block text-xs text-text-muted">Plan something new</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-violet-600" />
          </Card>
          <Card as={Link} to="/organizer/venues" className="group flex min-w-0 items-center gap-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-[#4C1D95]">
              <MapPin aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-text-primary">Find a venue</span>
              <span className="mt-0.5 block text-xs text-text-muted">Explore available spaces</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-violet-600" />
          </Card>
          <Card as={Link} to="/organizer/events" className="group flex min-w-0 items-center gap-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-[#BE185D]">
              <Users aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-text-primary">Manage guests</span>
              <span className="mt-0.5 block text-xs text-text-muted">Open an event attendee list</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-violet-600" />
          </Card>
          <Card as={Link} to="/organizer/catering" className="group flex min-w-0 items-center gap-4 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <UtensilsCrossed aria-hidden="true" className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-text-primary">Explore catering</span>
              <span className="mt-0.5 block text-xs text-text-muted">Browse menus and vendors</span>
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-1 group-hover:text-violet-600" />
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          title="Recent activity"
          description="Updates from your events, newest first."
          to="/organizer/events"
          actionLabel="My events"
        />
        <EventActivityTimeline
          activities={activities}
          loading={activityLoading}
          error={activityError}
          title="Recent activity"
          showCardHeader={false}
          emptyTitle="No recent activity"
          emptyDescription={events.length === 0
            ? 'Create an event to start seeing registrations and workflow updates here.'
            : 'Registrations and important event updates will appear here.'}
        />
      </section>
    </div>
  );
}
